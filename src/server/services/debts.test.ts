import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { Types } from "mongoose";
import { dateOnly } from "@/lib/dates";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";
import { addEntry, createPerson, DebtError, overview, signedAmount, statementText, timeline, voidEntry } from "./debts";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const uid = String(new Types.ObjectId());
const pesos = (n: number) => n * 100;

test("caso papá: saldos corridos 285k → 55k → 45k → 95k → 108k → 68k → 163k", async () => {
  const p = await createPerson(uid, "Papá");
  const d = (day: number) => dateOnly(2026, 9, day);
  const add = (kind: Parameters<typeof addEntry>[1]["kind"], reason: string, amount: number, day: number, items?: { label: string; amountCents: number }[]) =>
    addEntry(uid, { personId: p._id, kind, reason, amountCents: amount ? pesos(amount) : undefined, date: d(day), items });

  await add("loan", "Deuda inicial septiembre", 285000, 1);
  await add("payment", "Me pasó", 230000, 5);
  await add("payment", "Me dio 10k", 10000, 9);
  await add("loan", "Pidió 50k hasta el sábado", 50000, 12);
  await add("paid_for", "Frazada", 13000, 15);
  await add("offset", "Me agarré 40k efectivo, médico", 40000, 20);
  await add("paid_for", "Pagué tarjeta: termotanque 35k + aire 60k", 0, 25, [
    { label: "Termotanque", amountCents: pesos(35000) },
    { label: "Aire acondicionado", amountCents: pesos(60000) },
  ]);

  const t = await timeline(uid, p._id);
  expect(t.rows.map((r) => r.balanceAfterCents / 100)).toEqual([285000, 55000, 45000, 95000, 108000, 68000, 163000]);
  expect(t.rows.map((r) => r.amountCents / 100)).toEqual([285000, -230000, -10000, 50000, 13000, -40000, 95000]);
  expect(t.balanceCents).toBe(pesos(163000));
  expect(t.rows[6].items).toHaveLength(2);

  const o = await overview(uid, dateOnly(2026, 10, 7));
  expect(o.totalCents).toBe(pesos(163000));
  expect(o.people[0]).toMatchObject({ name: "Papá", balanceCents: pesos(163000), ageDays: 17 }); // último pago: 20/09 (compensación)

  expect(statementText("Papá", t.rows)).toContain("Total adeudado: $ 163.000");
});

test("el motivo es obligatorio y el signo lo define el tipo", async () => {
  const p = await createPerson(uid, "Juan");
  await expect(addEntry(uid, { personId: p._id, kind: "loan", reason: "  ", amountCents: 100, date: new Date() })).rejects.toThrow(DebtError);
  expect(signedAmount("loan", 500)).toBe(500);
  expect(signedAmount("payment", 500)).toBe(-500);
  expect(signedAmount("offset", -500)).toBe(-500);
  expect(signedAmount("adjustment", -300)).toBe(-300);
  expect(() => signedAmount("loan", 0)).toThrow(DebtError);
});

test("anular con motivo: queda visible, no cuenta, no se anula dos veces; ajuste corrige", async () => {
  const p = await createPerson(uid, "Ana");
  const e1 = await addEntry(uid, { personId: p._id, kind: "loan", reason: "Préstamo", amountCents: pesos(1000), date: dateOnly(2026, 1, 1) });
  await addEntry(uid, { personId: p._id, kind: "loan", reason: "Error de carga", amountCents: pesos(500), date: dateOnly(2026, 1, 2) });
  const bad = (await timeline(uid, p._id)).rows[1];
  await expect(voidEntry(uid, bad._id, "")).rejects.toThrow();
  await voidEntry(uid, bad._id, "Duplicado");
  await expect(voidEntry(uid, bad._id, "otra vez")).rejects.toThrow();
  await addEntry(uid, { personId: p._id, kind: "adjustment", reason: "Corrección", amountCents: -pesos(100), date: dateOnly(2026, 1, 3) });
  const t = await timeline(uid, p._id);
  expect(t.rows).toHaveLength(3);
  expect(t.rows[1]).toMatchObject({ voidReason: "Duplicado", balanceAfterCents: pesos(1000) });
  expect(t.balanceCents).toBe(pesos(900));
  expect(t.rows[0]._id).toBe(e1._id);
});

test("no se pueden cargar movimientos de otra persona/usuario", async () => {
  const p = await createPerson(uid, "Ana");
  const otro = String(new Types.ObjectId());
  await expect(addEntry(otro, { personId: p._id, kind: "loan", reason: "x", amountCents: 100, date: new Date() })).rejects.toThrow();
});
