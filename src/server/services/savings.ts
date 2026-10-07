import { monthKey, todayAr } from "@/lib/dates";
import { Goal, SavingsEntry, SavingsPlan, type Bucket, type IGoal, type ISavingsEntry, type ISavingsPlan } from "../models/savings";
import { plain } from "../models/helpers";
import { User } from "../models/user";
import { entryUsdCents, goalsProgress, planVsReal, plannedByBucket } from "./savings-calc";
import { lastMonths } from "./report-calc";

export class SavingsError extends Error {}

const BUCKETS: Bucket[] = ["sp500", "usd", "pesos_plus"];

export async function getPlan(userId: string): Promise<ISavingsPlan> {
  const doc = await SavingsPlan.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: "after" }).lean<ISavingsPlan>();
  return plain(doc!);
}

/** Cuánto queda para gastar por mes: ingreso − (USD a ahorrar × dólar plan). Con los defaults = 800.000. */
export function monthlyBudgetCents(p: Pick<ISavingsPlan, "incomeCents" | "usdSp500" | "usdSavings" | "fxPlan">): number {
  return p.incomeCents - Math.round((p.usdSp500 + p.usdSavings) * p.fxPlan * 100);
}

export async function updatePlan(userId: string, d: Partial<Pick<ISavingsPlan, "incomeCents" | "usdSp500" | "usdSavings" | "pctUsd" | "fxPlan">>) {
  if (d.pctUsd != null && (d.pctUsd < 0 || d.pctUsd > 1)) throw new SavingsError("El porcentaje en USD debe estar entre 0 y 100");
  if (d.fxPlan != null && !(d.fxPlan > 0)) throw new SavingsError("Dólar inválido");
  await SavingsPlan.updateOne({ userId }, { $set: d }, { upsert: true });
}

export async function getFxActual(userId: string): Promise<number | null> {
  const u = await User.findById(userId).select("settings").lean<{ settings?: { fxActual?: number } }>();
  return u?.settings?.fxActual ?? null;
}

export async function setFxActual(userId: string, fx: number | null) {
  if (fx != null && !(fx > 0)) throw new SavingsError("Dólar inválido");
  await User.updateOne({ _id: userId }, fx == null ? { $unset: { "settings.fxActual": "" } } : { $set: { "settings.fxActual": fx } });
}

/** Crea (si faltan) las 3 entradas del checklist del mes con lo planificado. */
export async function ensureMonth(userId: string, month: string) {
  const plan = await getPlan(userId);
  const planned = plannedByBucket(plan);
  await SavingsEntry.bulkWrite(
    BUCKETS.map((bucket) => ({
      updateOne: {
        filter: { userId, month, bucket },
        update: { $setOnInsert: { userId, month, bucket, plannedUsdCents: planned[bucket], actualAmountCents: 0, currency: bucket === "pesos_plus" ? "ARS" : "USD", done: false } },
        upsert: true,
      },
    })),
  );
}

export async function monthChecklist(userId: string, month: string) {
  await ensureMonth(userId, month);
  const [plan, entries] = await Promise.all([getPlan(userId), SavingsEntry.find({ userId, month }).lean<ISavingsEntry[]>()]);
  const sorted = BUCKETS.map((b) => entries.find((e) => e.bucket === b)!).filter(Boolean);
  return plain(
    sorted.map((e) => ({
      ...e,
      plannedArsCents: Math.round((e.plannedUsdCents / 100) * plan.fxPlan * 100),
      actualUsdCents: e.done ? entryUsdCents(e, plan.fxPlan) : 0,
    })),
  );
}

/** Registra lo realmente hecho en un bucket: monto real + dólar usado. */
export async function saveEntry(userId: string, month: string, bucket: Bucket, d: { actualAmountCents: number; fxUsed?: number; done: boolean }) {
  if (d.actualAmountCents < 0) throw new SavingsError("Monto inválido");
  if (bucket === "pesos_plus" && d.done && !(d.fxUsed && d.fxUsed > 0)) throw new SavingsError("Indicá el dólar usado para convertir los pesos plus");
  await ensureMonth(userId, month);
  await SavingsEntry.updateOne({ userId, month, bucket }, { $set: { actualAmountCents: d.actualAmountCents, fxUsed: d.fxUsed, done: d.done } });
}

export async function listGoals(userId: string) {
  const plan = await getPlan(userId);
  if ((await Goal.countDocuments({ userId })) === 0) {
    const perYear = Math.round((plan.usdSp500 + plan.usdSavings) * 12 * 100);
    await Goal.insertMany([
      { userId, name: "Auto", targetUsdCents: perYear, startDate: todayAr(), order: 0 },
      // Placeholder editable: el doc no define la meta de la casa.
      { userId, name: "Casa", targetUsdCents: 3000000, startDate: todayAr(), order: 1 },
    ]);
  }
  return plain(await Goal.find({ userId }).sort({ order: 1 }).lean<IGoal[]>());
}

export async function updateGoal(userId: string, id: string, d: { name?: string; targetUsdCents?: number }) {
  if (d.targetUsdCents != null && d.targetUsdCents <= 0) throw new SavingsError("Meta inválida");
  await Goal.updateOne({ _id: id, userId }, { $set: d });
}

/** Total ahorrado (USD-eq, solo entradas hechas) y ritmo mensual (promedio de los últimos 3 meses con aportes, o el plan). */
export async function savedSummary(userId: string, today = todayAr()) {
  const [plan, entries] = await Promise.all([getPlan(userId), SavingsEntry.find({ userId, done: true }).lean<ISavingsEntry[]>()]);
  const byMonth = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    const usd = entryUsdCents(e, plan.fxPlan);
    total += usd;
    byMonth.set(e.month, (byMonth.get(e.month) ?? 0) + usd);
  }
  const recent = lastMonths(monthKey(today), 3).map((m) => byMonth.get(m)).filter((x): x is number => !!x);
  const planPace = Math.round((plan.usdSp500 + plan.usdSavings) * 100);
  const pace = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : planPace;
  return { totalUsdCents: total, paceUsdCents: pace, planPaceUsdCents: planPace };
}

export async function goalsWithProgress(userId: string, today = todayAr()) {
  const [goals, s] = await Promise.all([listGoals(userId), savedSummary(userId, today)]);
  const progress = goalsProgress(s.totalUsdCents, goals, s.paceUsdCents, today);
  return { goals: goals.map((g, i) => ({ ...g, ...progress[i] })), ...s };
}

/** Histórico de cumplimiento (últimos n meses). */
export async function history(userId: string, n = 12, today = todayAr()) {
  const months = lastMonths(monthKey(today), n);
  const entries = await SavingsEntry.find({ userId, month: { $in: months } }).lean<ISavingsEntry[]>();
  return months.map((m) => ({ month: m, done: entries.filter((e) => e.month === m && e.done).length, total: 3 })).reverse();
}

export async function planOverview(userId: string) {
  const [plan, fxActual] = await Promise.all([getPlan(userId), getFxActual(userId)]);
  return { plan, fxActual, budgetCents: monthlyBudgetCents(plan), ...planVsReal(plan, fxActual) };
}

/** Dólar de referencia (dolarapi.com), cacheado 1h. Devuelve null si no hay red. */
export async function fetchDolar(): Promise<{ oficial?: number; blue?: number; mep?: number } | null> {
  try {
    const r = await fetch("https://dolarapi.com/v1/dolares", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const rows = (await r.json()) as { casa: string; venta: number }[];
    const v = (c: string) => rows.find((x) => x.casa === c)?.venta;
    return { oficial: v("oficial"), blue: v("blue"), mep: v("bolsa") };
  } catch {
    return null;
  }
}
