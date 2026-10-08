import type { Bucket } from "../models/savings";

export interface PlanLite {
  usdSp500: number;
  usdSavings: number;
  pctUsd: number;
  fxPlan: number;
}

/** Montos planificados por bucket, en centavos de USD. */
export function plannedByBucket(p: PlanLite): Record<Bucket, number> {
  return {
    sp500: Math.round(p.usdSp500 * 100),
    usd: Math.round(p.usdSavings * p.pctUsd * 100),
    pesos_plus: Math.round(p.usdSavings * (1 - p.pctUsd) * 100),
  };
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  sp500: "Inversión S&P 500 (USD)",
  usd: "Ahorro en dólares (USD)",
  pesos_plus: "Pesos plus (ARS)",
};

/** Equivalente en USD (centavos) de lo realmente aportado en una entrada. */
export function entryUsdCents(e: { bucket: Bucket; currency: "ARS" | "USD"; actualAmountCents: number; fxUsed?: number | null }, fallbackFx: number): number {
  if (e.currency === "USD") return e.actualAmountCents;
  const fx = e.fxUsed && e.fxUsed > 0 ? e.fxUsed : fallbackFx;
  return Math.round(e.actualAmountCents / fx);
}

/** Diferencia plan vs real: cuánto "libera" (o falta) por mes con el dólar actual. En centavos de ARS. */
export function planVsReal(p: PlanLite, fxActual: number | null | undefined) {
  const usd = p.usdSp500 + p.usdSavings;
  const planArs = Math.round(usd * p.fxPlan * 100);
  if (!fxActual) return { planArs, actualArs: null as number | null, freedArs: null as number | null };
  const actualArs = Math.round(usd * fxActual * 100);
  return { planArs, actualArs, freedArs: planArs - actualArs };
}

export interface GoalLite {
  name: string;
  targetUsdCents: number;
}

/**
 * Reparte lo ahorrado en orden (Auto primero, luego Casa) y estima la fecha de cada objetivo
 * con el ritmo mensual indicado.
 */
export function goalsProgress(totalSavedUsdCents: number, goals: GoalLite[], monthlyPaceUsdCents: number, today: Date) {
  let left = totalSavedUsdCents;
  let cumTarget = 0;
  return goals.map((g) => {
    const saved = Math.max(0, Math.min(left, g.targetUsdCents));
    left -= saved;
    cumTarget += g.targetUsdCents;
    const remainingForThis = Math.max(0, cumTarget - totalSavedUsdCents);
    let etaDate: Date | null = null;
    if (remainingForThis === 0) etaDate = today;
    else if (monthlyPaceUsdCents > 0) {
      const months = Math.ceil(remainingForThis / monthlyPaceUsdCents);
      etaDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, 1, 12));
    }
    return { name: g.name, targetUsdCents: g.targetUsdCents, savedUsdCents: saved, pct: g.targetUsdCents ? Math.min(100, Math.round((saved / g.targetUsdCents) * 1000) / 10) : 0, etaDate };
  });
}
