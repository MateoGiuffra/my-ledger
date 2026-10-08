import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { Types } from "mongoose";
import { dateOnly } from "@/lib/dates";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";

vi.mock("../db", () => ({ connectDb: async () => {} }));

import { User } from "../models/user";
import { goalsProgress, planVsReal, plannedByBucket } from "./savings-calc";
import { goalsWithProgress, history, monthChecklist, saveEntry, SavingsError, savedSummary, setFxActual, getFxActual, updatePlan, monthlyBudgetCents, getPlan } from "./savings";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const uid = String(new Types.ObjectId());
const today = dateOnly(2026, 10, 7);
const plan = { usdSp500: 100, usdSavings: 525, pctUsd: 0.5, fxPlan: 1600 };

test("plan por defecto: 100 S&P + 262,5 USD + 262,5 en pesos plus (≈ ARS 420k a 1600)", () => {
  expect(plannedByBucket(plan)).toEqual({ sp500: 10000, usd: 26250, pesos_plus: 26250 });
  expect(Math.round((26250 / 100) * 1600)).toBe(420000);
});

test("dólar plan 1600 vs actual 1547 libera ~33k", () => {
  expect(planVsReal(plan, 1547)).toEqual({ planArs: 100000000, actualArs: 96687500, freedArs: 3312500 });
  expect(planVsReal(plan, null).freedArs).toBeNull();
});

test("objetivos: el ahorro llena Auto y después Casa; fecha estimada por ritmo", () => {
  const g = goalsProgress(300000, [{ name: "Auto", targetUsdCents: 750000 }, { name: "Casa", targetUsdCents: 3000000 }], 62500, today);
  expect(g[0]).toMatchObject({ savedUsdCents: 300000, pct: 40 });
  expect(g[0].etaDate!.toISOString().slice(0, 7)).toBe("2027-06"); // faltan 450000 / 62500 = 7.2 → 8 meses
  expect(g[1].savedUsdCents).toBe(0);
  const done = goalsProgress(800000, [{ name: "Auto", targetUsdCents: 750000 }, { name: "Casa", targetUsdCents: 3000000 }], 62500, today);
  expect(done[0]).toMatchObject({ pct: 100, savedUsdCents: 750000 });
  expect(done[1].savedUsdCents).toBe(50000);
  expect(goalsProgress(0, [{ name: "X", targetUsdCents: 100 }], 0, today)[0].etaDate).toBeNull();
});

test("checklist mensual: se crea con lo planificado y se completa con monto real + dólar usado", async () => {
  const c = await monthChecklist(uid, "2026-10");
  expect(c.map((x) => [x.bucket, x.plannedUsdCents, x.done])).toEqual([["sp500", 10000, false], ["usd", 26250, false], ["pesos_plus", 26250, false]]);
  expect(c[2].plannedArsCents).toBe(42000000);

  await saveEntry(uid, "2026-10", "sp500", { actualAmountCents: 10000, done: true });
  await saveEntry(uid, "2026-10", "pesos_plus", { actualAmountCents: 40000000, fxUsed: 1547, done: true });
  await expect(saveEntry(uid, "2026-10", "pesos_plus", { actualAmountCents: 1, done: true })).rejects.toThrow(SavingsError);
  const c2 = await monthChecklist(uid, "2026-10");
  expect(c2.map((x) => x.done)).toEqual([true, false, true]);
  expect(c2[2].actualUsdCents).toBe(Math.round(40000000 / 1547));
  expect(await history(uid, 3, today)).toEqual([{ month: "2026-10", done: 2, total: 3 }, { month: "2026-09", done: 0, total: 3 }, { month: "2026-08", done: 0, total: 3 }]);
});

test("ahorrado total y ritmo desde el histórico; objetivos por defecto", async () => {
  for (const m of ["2026-08", "2026-09"]) {
    await saveEntry(uid, m, "sp500", { actualAmountCents: 10000, done: true });
    await saveEntry(uid, m, "usd", { actualAmountCents: 26250, done: true });
  }
  const s = await savedSummary(uid, today);
  expect(s.totalUsdCents).toBe(72500);
  expect(s.paceUsdCents).toBe(36250);
  const g = await goalsWithProgress(uid, today);
  expect(g.goals.map((x) => x.name)).toEqual(["Auto", "Casa"]);
  expect(g.goals[0].targetUsdCents).toBe(750000); // 12 × 625 USD
  expect(g.goals[0].savedUsdCents).toBe(72500);
});

test("editar plan y dólar actual; presupuesto libre", async () => {
  await updatePlan(uid, { fxPlan: 1500 });
  expect(monthlyBudgetCents(await getPlan(uid))).toBe(180000000 - 625 * 1500 * 100);
  await expect(updatePlan(uid, { pctUsd: 2 })).rejects.toThrow(SavingsError);
  const u = await User.create({ username: "x", passwordHash: "h" });
  await setFxActual(String(u._id), 1547);
  expect(await getFxActual(String(u._id))).toBe(1547);
  await setFxActual(String(u._id), null);
  expect(await getFxActual(String(u._id))).toBeNull();
});
