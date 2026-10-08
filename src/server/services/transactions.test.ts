import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { dateOnly } from "@/lib/dates";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";
import { Types } from "mongoose";
import { createTransaction, deleteTransaction, getTransaction, listTransactions, updateTransaction } from "./transactions";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const uid = String(new Types.ObjectId());
const other = String(new Types.ObjectId());

test("alta, edición y soft delete", async () => {
  const t = await createTransaction(uid, { type: "expense", amountCents: 150000, date: dateOnly(2026, 5, 3), merchant: "Café" });
  expect(await updateTransaction(uid, t._id, { amountCents: 160000 })).toMatchObject({ amountCents: 160000 });
  expect(await deleteTransaction(uid, t._id)).toBe(true);
  expect(await getTransaction(uid, t._id)).toBeNull();
  expect((await listTransactions(uid, {})).total).toBe(0);
});

test("aislamiento por usuario", async () => {
  const t = await createTransaction(uid, { type: "expense", amountCents: 1, date: dateOnly(2026, 5, 3) });
  expect(await getTransaction(other, t._id)).toBeNull();
  expect(await deleteTransaction(other, t._id)).toBe(false);
});

test("filtros, texto y paginación", async () => {
  for (let i = 1; i <= 35; i++) await createTransaction(uid, { type: "expense", amountCents: 1000 * i, date: dateOnly(2026, 5, i % 28 + 1), merchant: i % 2 ? "Super Día" : "Kiosco" });
  await createTransaction(uid, { type: "income", amountCents: 500000, date: dateOnly(2026, 6, 1), note: "sueldo" });
  const p1 = await listTransactions(uid, { month: "2026-05" }, 1, 30);
  expect(p1.total).toBe(35);
  expect(p1.pages).toBe(2);
  expect(p1.items).toHaveLength(30);
  expect((await listTransactions(uid, { month: "2026-05" }, 2, 30)).items).toHaveLength(5);
  expect((await listTransactions(uid, { q: "super" })).total).toBe(18);
  expect((await listTransactions(uid, { q: "(" })).total).toBe(0); // regex escapada
  const inc = await listTransactions(uid, { type: "income" });
  expect(inc.totals).toEqual({ expenseCents: 0, incomeCents: 500000 });
  const dates = p1.items.map((i) => i.date);
  expect([...dates].sort().reverse()).toEqual(dates);
});
