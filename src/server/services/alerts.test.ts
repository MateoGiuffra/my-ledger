import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { dateOnly } from "@/lib/dates";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";

vi.mock("../db", () => ({ connectDb: async () => {} }));

import { saveToken, setPushSender, type PushSender } from "../integrations/push";
import { User } from "../models/user";
import { addEntry, createPerson } from "./debts";
import { createCommitment } from "./commitments";
import { deliverAlerts, fireAtFor, generateAlerts, listAlerts, markAllRead, markRead, runAlertsForAll, setPrefs, unreadCount } from "./alerts";
import { saveEntry } from "./savings";

beforeAll(startTestDb);
afterAll(stopTestDb);
let uid: string;
beforeEach(async () => {
  await clearTestDb();
  uid = String((await User.create({ username: "u", passwordHash: "h" }))._id);
});
afterEach(() => setPushSender(null));

const tarjeta = { name: "Tarjeta", amountCents: 3500000, frequency: "monthly" as const, dayOfMonth: 10, startDate: dateOnly(2026, 10, 1), endDate: dateOnly(2026, 12, 31) };
const at = (iso: string) => new Date(iso);

test("hora de disparo: 9 hs de Buenos Aires = 12:00 UTC", () => {
  expect(fireAtFor(dateOnly(2026, 10, 7), 9).toISOString()).toBe("2026-10-07T12:00:00.000Z");
});

test("vencimiento: avisa 3 días, 1 día y el día; sin duplicar", async () => {
  await createCommitment(uid, tarjeta, dateOnly(2026, 10, 1));
  expect(await generateAlerts(uid, at("2026-10-06T12:00:00Z"))).toBe(0); // 3d antes = 7/10 a las 9
  expect(await generateAlerts(uid, at("2026-10-07T13:00:00Z"))).toBe(1);
  expect(await generateAlerts(uid, at("2026-10-07T14:00:00Z"))).toBe(0);
  expect(await generateAlerts(uid, at("2026-10-10T13:00:00Z"))).toBe(2); // 1d (9/10) y hoy (10/10)
  const l = await listAlerts(uid, false, at("2026-10-10T13:00:00Z"));
  expect(l.map((a) => a.title)).toEqual(["Vence hoy: Tarjeta", "Vence mañana: Tarjeta", "Vence en 3 días: Tarjeta"]);
  expect(await unreadCount(uid, at("2026-10-10T13:00:00Z"))).toBe(3);
  await markRead(uid, l[0]._id);
  expect(await unreadCount(uid, at("2026-10-10T13:00:00Z"))).toBe(2);
  await markAllRead(uid);
  expect(await unreadCount(uid, at("2026-10-10T13:00:00Z"))).toBe(0);
});

test("un compromiso pagado ya no avisa", async () => {
  const { upcoming, markPaid } = await import("./commitments");
  await createCommitment(uid, tarjeta, dateOnly(2026, 10, 1));
  const [o] = await upcoming(uid, 30, dateOnly(2026, 10, 1));
  await markPaid(uid, o._id, {}, dateOnly(2026, 10, 1));
  expect(await generateAlerts(uid, at("2026-10-10T13:00:00Z"))).toBe(0);
});

test("push: se envía una sola vez, descarta tokens inválidos", async () => {
  await createCommitment(uid, tarjeta, dateOnly(2026, 10, 1));
  await saveToken(uid, "tok-ok");
  await saveToken(uid, "tok-viejo");
  const calls: string[] = [];
  const sender: PushSender = async (t, p) => (calls.push(`${t}:${p.title}`), t === "tok-viejo" ? "invalid" : "ok");
  setPushSender(sender);
  const now = at("2026-10-07T13:00:00Z");
  await generateAlerts(uid, now);
  expect(await deliverAlerts(uid, now)).toBe(1);
  expect(calls).toEqual(["tok-ok:Vence en 3 días: Tarjeta", "tok-viejo:Vence en 3 días: Tarjeta"]);
  expect((await User.findById(uid).lean())?.pushTokens).toEqual(["tok-ok"]);
  expect(await deliverAlerts(uid, now)).toBe(0); // ya enviada
});

test("sin Firebase configurado no se envía nada pero la alerta queda in-app", async () => {
  await createCommitment(uid, tarjeta, dateOnly(2026, 10, 1));
  const now = at("2026-10-07T13:00:00Z");
  await generateAlerts(uid, now);
  expect(await deliverAlerts(uid, now)).toBe(0);
  expect(await listAlerts(uid, true, now)).toHaveLength(1);
});

test("preferencias: tipos y hora", async () => {
  await createCommitment(uid, tarjeta, dateOnly(2026, 10, 1));
  await setPrefs(uid, { types: ["debt"], hour: 9 });
  expect(await generateAlerts(uid, at("2026-10-10T13:00:00Z"))).toBe(0);
  await setPrefs(uid, { types: ["commitment"], hour: 20 });
  expect(await generateAlerts(uid, at("2026-10-07T13:00:00Z"))).toBe(0); // 20 hs AR = 23 UTC
  expect(await generateAlerts(uid, at("2026-10-07T23:30:00Z"))).toBe(1);
});

test("cobro (Sueldo) genera alerta de tipo payday", async () => {
  await createCommitment(uid, { name: "Sueldo", kind: "income", amountCents: 180000000, frequency: "monthly", dayOfMonth: 5, startDate: dateOnly(2026, 10, 1) }, dateOnly(2026, 10, 1));
  await generateAlerts(uid, at("2026-10-05T13:00:00Z"));
  const l = await listAlerts(uid, false, at("2026-10-05T13:00:00Z"));
  expect(l.find((a) => a.title.startsWith("Cobro hoy"))).toMatchObject({ type: "payday", body: "$ 1.800.000" });
});

test("checklist de ahorro incompleto del mes anterior", async () => {
  await saveEntry(uid, "2026-09", "sp500", { actualAmountCents: 10000, done: true });
  await generateAlerts(uid, at("2026-10-01T13:00:00Z"));
  const l = await listAlerts(uid, false, at("2026-10-01T13:00:00Z"));
  expect(l.map((a) => a.title)).toContain("Plan de ahorro de 2026-09 incompleto");
});

test("recordatorio de deuda: 30+ días sin pagos, una vez por mes", async () => {
  const p = await createPerson(uid, "Papá");
  await addEntry(uid, { personId: p._id, kind: "loan", reason: "Préstamo", amountCents: 5000000, date: dateOnly(2026, 8, 1) });
  const now = at("2026-10-07T13:00:00Z");
  expect(await generateAlerts(uid, now)).toBeGreaterThanOrEqual(1);
  const again = await generateAlerts(uid, now);
  expect(again).toBe(0);
  expect((await listAlerts(uid, false, now)).some((a) => a.type === "debt")).toBe(true);
});

test("cron para todos los usuarios", async () => {
  await createCommitment(uid, tarjeta, dateOnly(2026, 10, 1));
  const r = await runAlertsForAll(at("2026-10-07T13:00:00Z"));
  expect(r).toMatchObject({ users: 1 });
  expect(r.created).toBeGreaterThanOrEqual(1);
});
