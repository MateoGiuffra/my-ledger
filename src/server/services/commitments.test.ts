import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { Types } from "mongoose";
import { randomBytes } from "node:crypto";
import { dateOnly } from "@/lib/dates";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";

vi.mock("../db", () => ({ connectDb: async () => {} }));

import { buildEventBody, setCalendarFactory, type CalendarApi } from "../integrations/gcal";
import { Transaction } from "../models/transaction";
import { calendarMonth, createCommitment, deleteCommitment, listCommitments, markPaid, postponeOccurrence, skipOccurrence, syncOccurrences, updateCommitment, upcoming, CommitmentError } from "./commitments";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
});
afterEach(() => {
  setCalendarFactory(null);
  vi.unstubAllEnvs();
});

const uid = String(new Types.ObjectId());
const today = dateOnly(2026, 10, 7);
const tarjeta = { name: "Tarjeta", amountCents: 3500000, frequency: "monthly" as const, dayOfMonth: 10, startDate: dateOnly(2026, 7, 10), endDate: dateOnly(2026, 12, 31) };

function fakeCalendar() {
  const calls: { op: string; id?: string; body?: Record<string, unknown> }[] = [];
  const api: CalendarApi = {
    insert: async (body) => (calls.push({ op: "insert", body }), "evt1"),
    patch: async (id, body) => void calls.push({ op: "patch", id, body }),
    remove: async (id) => void calls.push({ op: "remove", id }),
  };
  setCalendarFactory(async () => api);
  return calls;
}

test("tarjeta 35k mensual hasta dic: quedan 3 cuotas = 105k", async () => {
  const c = await createCommitment(uid, tarjeta, today);
  const [l] = await listCommitments(uid, today);
  expect(l).toMatchObject({ _id: c._id, remainingCount: 3, remainingCents: 10500000, finished: false });
  const up = await upcoming(uid, 40, today);
  expect(up.map((u) => u.dueDate)).toEqual(["2026-10-10", "2026-11-10"]);
});

test("pagar genera el gasto, no se paga dos veces y baja el total pendiente", async () => {
  await createCommitment(uid, tarjeta, today);
  const [o] = await upcoming(uid, 30, today);
  const tx = await markPaid(uid, o._id, {}, today);
  expect(tx).toMatchObject({ type: "expense", amountCents: 3500000, merchant: "Tarjeta", source: "commitment" });
  await expect(markPaid(uid, o._id, {}, today)).rejects.toThrow(CommitmentError);
  expect(await Transaction.countDocuments({ userId: uid })).toBe(1);
  const [l] = await listCommitments(uid, today);
  expect(l.remainingCount).toBe(2);
  expect((await upcoming(uid, 40, today)).map((u) => u.dueDate)).toEqual(["2026-11-10"]);
});

test("saltar y postergar", async () => {
  await createCommitment(uid, tarjeta, today);
  const [a, b] = await upcoming(uid, 40, today);
  await skipOccurrence(uid, a._id);
  await postponeOccurrence(uid, b._id, 5);
  const up = await upcoming(uid, 40, today);
  expect(up.map((u) => u.dueDate)).toEqual(["2026-11-15"]);
  // la ventana móvil no regenera la postergada ni la salteada
  await syncOccurrences(uid, today);
  expect((await upcoming(uid, 40, today)).map((u) => u.dueDate)).toEqual(["2026-11-15"]);
});

test("vencidos aparecen como overdue", async () => {
  await createCommitment(uid, tarjeta, today);
  const up = await upcoming(uid, 30, dateOnly(2026, 10, 12));
  expect(up[0]).toMatchObject({ dueDate: "2026-10-10", overdue: true });
});

test("editar el día regenera pendientes; borrar elimina pendientes futuros", async () => {
  const c = await createCommitment(uid, tarjeta, today);
  await updateCommitment(uid, c._id, { ...tarjeta, dayOfMonth: 20 }, today);
  expect((await upcoming(uid, 50, today)).map((u) => u.dueDate)).toEqual(["2026-10-20", "2026-11-20"]);
  expect(await deleteCommitment(uid, c._id, today)).toBe(true);
  expect(await listCommitments(uid, today)).toHaveLength(0);
  expect(await upcoming(uid, 40, today)).toHaveLength(0);
});

test("calendario del mes agrupa por día", async () => {
  await createCommitment(uid, tarjeta, today);
  const m = await calendarMonth(uid, "2026-11", today);
  expect(Object.keys(m)).toEqual(["2026-11-10"]);
});

test("validaciones", async () => {
  await expect(createCommitment(uid, { ...tarjeta, dayOfMonth: 31 }, today)).rejects.toThrow(CommitmentError);
  await expect(createCommitment(uid, { ...tarjeta, endDate: dateOnly(2026, 1, 1) }, today)).rejects.toThrow(CommitmentError);
  await expect(createCommitment(uid, { ...tarjeta, amountCents: 0 }, today)).rejects.toThrow(CommitmentError);
});

test("Google Calendar: crea evento recurrente con UNTIL y recordatorios; edita y borra", async () => {
  const calls = fakeCalendar();
  const c = await createCommitment(uid, { ...tarjeta, gcalSync: true, reminders: [3, 1, 0] }, today);
  expect(c.gcalEventId).toBe("evt1");
  expect(calls[0].op).toBe("insert");
  expect(calls[0].body).toMatchObject({
    recurrence: ["RRULE:FREQ=MONTHLY;BYMONTHDAY=10;UNTIL=20261231T235959Z"],
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 4320 }, { method: "popup", minutes: 1440 }, { method: "popup", minutes: 0 }] },
    start: { dateTime: "2026-07-10T09:00:00", timeZone: "America/Argentina/Buenos_Aires" },
  });
  await updateCommitment(uid, c._id, { ...tarjeta, gcalSync: true, dayOfMonth: 15 }, today);
  expect(calls[1]).toMatchObject({ op: "patch", id: "evt1" });
  await deleteCommitment(uid, c._id, today);
  expect(calls[2]).toEqual({ op: "remove", id: "evt1" });
});

test("si Google falla el compromiso se guarda igual y queda el error", async () => {
  setCalendarFactory(async () => ({ insert: async () => { throw new Error("quota"); }, patch: async () => {}, remove: async () => {} }));
  const c = await createCommitment(uid, { ...tarjeta, gcalSync: true }, today);
  expect(c.gcalEventId).toBeNull();
  expect(c.gcalError).toBe("quota");
});

test("sin Google conectado se informa", async () => {
  setCalendarFactory(async () => null);
  const c = await createCommitment(uid, { ...tarjeta, gcalSync: true }, today);
  expect(c.gcalError).toMatch(/no está conectado/);
});

test("buildEventBody de un compromiso único no lleva recurrencia", () => {
  const b = buildEventBody({ name: "Escribano", amountCents: 100000, currency: "ARS", frequency: "once", startDate: dateOnly(2026, 11, 3), reminders: [1] });
  expect(b).not.toHaveProperty("recurrence");
  expect(b.start.dateTime).toBe("2026-11-03T09:00:00");
});
