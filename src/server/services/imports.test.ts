import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { Types } from "mongoose";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";

vi.mock("../db", () => ({ connectDb: async () => {} }));

import { Account } from "../models/account";
import { Category } from "../models/category";
import { Transaction } from "../models/transaction";
import { assignName, createCounterparty, applyToExisting, mergeCounterparties, listCounterparties } from "./counterparties";
import { createPerson, timeline } from "./debts";
import { analyzeBatch, commitBatch, createPreview, getBatch, rollbackBatch, setOverride, ImportError } from "./imports";
import { createRule } from "./rules";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

// Datos inventados
const SAMPLE = [
  "INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE",
  "1.000,00;3.500,50;-1.515,00;2.985,50",
  "",
  "RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE",
  "01-05-2026;Rendimientos ;1001;0,50;1.000,50",
  "02-05-2026;Transferencia recibida Ana Gómez Ruiz;1002;3.500,00;4.500,50",
  "02-05-2026;Pago Spotify;1003;-100,00;4.400,50",
  "03-05-2026;Transferencia enviada Perez Juan Carlos;1004;-1.000,00;3.400,50",
  "03-05-2026;Transferencia enviada Tomás Ficticio;1005;-200,00;3.200,50",
  "04-05-2026;Dinero reservado Gastos;1006;-300,00;2.900,50",
  "04-05-2026;Pago EBANX S.A.;1007;-50,00;2.850,50",
  "05-05-2026;Devolución de pago EBANX S.A.;1007;50,00;2.900,50",
  "06-05-2026;Dinero retirado Gastos;1008;300,00;3.200,50",
  "07-05-2026;Compra Mercado Libre;1009;-215,00;2.985,50",
  "",
].join("\n");

const uid = String(new Types.ObjectId());

async function setup() {
  await Account.create({ userId: uid, name: "Mercado Pago", type: "mp" });
  const cats = await Category.insertMany(["Ocio", "Hogar"].map((name) => ({ userId: uid, name })));
  return { ocio: String(cats[0]._id), hogar: String(cats[1]._id) };
}

test("flujo completo: preview → asignar contraparte → confirmar → reimportar (dedupe) → rollback", async () => {
  const { ocio, hogar } = await setup();
  await createRule(uid, { pattern: "spotify", categoryId: ocio });
  const papa = await createPerson(uid, "Papá");
  await createCounterparty(uid, { displayName: "Papá", identifiers: [{ kind: "mp_name", value: "Ana Gómez Ruiz" }], mode: "debt", debtPersonId: papa._id });

  const id1 = await createPreview(uid, "mayo.csv", SAMPLE);
  const batch = (await getBatch(uid, id1))!;
  expect(batch.status).toBe("preview");
  expect(batch.validation?.ok).toBe(true);
  let a = await analyzeBatch(uid, batch);
  expect(a.counts).toMatchObject({ total: 10, new: 9, ignored: 1, duplicate: 0 });
  expect(a.unassigned.map((g) => g.name).sort()).toEqual(["Perez Juan Carlos", "Tomás Ficticio"]);
  expect(await Transaction.countDocuments({ userId: uid })).toBe(0); // nada importado todavía

  // FT-CPA-4: asignar una vez se aplica a todas las del lote
  await assignName(uid, "Perez Juan Carlos", { create: { displayName: "Juan · Peluquería", defaultCategoryId: hogar, label: "Peluquería" } });
  a = await analyzeBatch(uid, batch);
  expect(a.unassigned.map((g) => g.name)).toEqual(["Tomás Ficticio"]);
  expect(a.rows.find((r) => r.row.referenceId === "1004")).toMatchObject({ categoryId: hogar, categorySource: "counterparty", merchant: "Peluquería" });

  // override manual por fila
  await setOverride(uid, id1, "1009", hogar);

  const res = await commitBatch(uid, id1);
  expect(res).toEqual({ inserted: 9, skipped: 1 });
  const txs = await Transaction.find({ userId: uid }).lean();
  expect(txs).toHaveLength(9);
  expect(txs.find((t) => t.externalId === "1009")?.categoryId?.toString()).toBe(hogar);
  expect(txs.find((t) => t.externalId === "1006")).toMatchObject({ type: "transfer", internal: true });
  expect(txs.filter((t) => t.refund)).toHaveLength(1);
  expect(txs.every((t) => t.accountId)).toBe(true);
  // la transferencia de "Papá" generó un pago en Deudas
  const tl = await timeline(uid, papa._id);
  expect(tl.rows).toHaveLength(1);
  expect(tl.rows[0]).toMatchObject({ kind: "payment", amountCents: -350000 });
  await expect(commitBatch(uid, id1)).rejects.toThrow(ImportError);

  // Reimportar el mismo archivo: todo duplicado, nada se inserta
  const id2 = await createPreview(uid, "mayo-otra-vez.csv", SAMPLE);
  const a2 = await analyzeBatch(uid, (await getBatch(uid, id2))!);
  expect(a2.counts).toMatchObject({ new: 0, duplicate: 9, ignored: 1 });
  expect(await commitBatch(uid, id2)).toEqual({ inserted: 0, skipped: 10 });
  expect(await Transaction.countDocuments({ userId: uid })).toBe(9);

  // Rollback del primer lote
  expect(await rollbackBatch(uid, id1)).toBe(9);
  expect(await Transaction.countDocuments({ userId: uid })).toBe(0);
  const tl2 = await timeline(uid, papa._id);
  expect(tl2.balanceCents).toBe(0);
  expect(tl2.rows[0].voidReason).toMatch(/Rollback/);
  await expect(rollbackBatch(uid, id1)).rejects.toThrow(ImportError);

  // y se puede volver a importar
  const id3 = await createPreview(uid, "mayo.csv", SAMPLE);
  expect(await commitBatch(uid, id3)).toEqual({ inserted: 9, skipped: 1 });
});

test("archivo inválido no crea lote", async () => {
  await expect(createPreview(uid, "x.csv", "hola;mundo")).rejects.toThrow(ImportError);
});

test("rendimientos como ingreso (opción del lote)", async () => {
  await setup();
  const id = await createPreview(uid, "m.csv", SAMPLE);
  const { ImportBatch } = await import("../models/import");
  await ImportBatch.updateOne({ _id: id }, { $set: { "options.yields": "income" } });
  expect(await commitBatch(uid, id)).toEqual({ inserted: 10, skipped: 0 });
});

test("aplicar contraparte a movimientos ya importados y fusionar duplicadas", async () => {
  const { hogar } = await setup();
  const id = await createPreview(uid, "m.csv", SAMPLE);
  await commitBatch(uid, id);
  const cp = await createCounterparty(uid, { displayName: "Tomás", defaultCategoryId: hogar, identifiers: [{ kind: "mp_name", value: "Tomas Ficticio" }] });
  expect(await applyToExisting(uid, cp._id)).toBe(1);
  expect(await Transaction.countDocuments({ userId: uid, counterpartyId: cp._id, categoryId: hogar })).toBe(1);

  const dup = await createCounterparty(uid, { displayName: "Tomás F.", identifiers: [{ kind: "alias", value: "tomas.f" }] });
  await mergeCounterparties(uid, dup._id, cp._id);
  const list = await listCounterparties(uid);
  expect(list).toHaveLength(1);
  expect(list[0].identifiers.map((i) => i.value).sort()).toEqual(["Tomas Ficticio", "tomas.f"]);
});
