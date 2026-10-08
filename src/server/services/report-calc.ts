import { monthRange } from "@/lib/dates";

export interface TxLite {
  type: "expense" | "income" | "transfer";
  amountCents: number;
  currency: "ARS" | "USD";
  date: Date;
  categoryId?: string | null;
  merchant?: string;
  rawDescription?: string;
  internal?: boolean;
  refund?: boolean;
}

/** Solo ARS y no internos cuentan para gasto/ingreso. */
const counts = (t: TxLite) => t.currency === "ARS" && !t.internal && t.type !== "transfer";

export function summarize(txs: TxLite[], savingsCategoryIds: Set<string> = new Set()) {
  let incomeCents = 0;
  let expenseCents = 0;
  let savingsCents = 0;
  for (const t of txs) {
    if (!counts(t)) continue;
    if (t.type === "income" && t.refund) expenseCents -= t.amountCents; // devolución: netea el gasto
    else if (t.type === "income") incomeCents += t.amountCents;
    else if (t.categoryId && savingsCategoryIds.has(String(t.categoryId))) savingsCents += t.amountCents;
    else expenseCents += t.amountCents;
  }
  return { incomeCents, expenseCents, savingsCents };
}

export function byCategory(txs: TxLite[], names: Map<string, string>, savingsCategoryIds: Set<string> = new Set()) {
  const acc = new Map<string, number>();
  for (const t of txs) {
    if (!counts(t) || (t.type !== "expense" && !(t.type === "income" && t.refund))) continue;
    if (t.categoryId && savingsCategoryIds.has(String(t.categoryId))) continue;
    const k = t.categoryId ? String(t.categoryId) : "";
    acc.set(k, (acc.get(k) ?? 0) + (t.type === "income" ? -t.amountCents : t.amountCents));
  }
  return [...acc.entries()]
    .map(([id, totalCents]) => ({ categoryId: id || null, name: id ? (names.get(id) ?? "?") : "Sin categoría", totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function topMerchants(txs: TxLite[], limit = 10) {
  const acc = new Map<string, number>();
  for (const t of txs) {
    if (!counts(t) || (t.type !== "expense" && !(t.type === "income" && t.refund))) continue;
    const name = (t.merchant || t.rawDescription || "Sin nombre").trim();
    acc.set(name, (acc.get(name) ?? 0) + (t.type === "income" ? -t.amountCents : t.amountCents));
  }
  return [...acc.entries()].map(([name, totalCents]) => ({ name, totalCents })).sort((a, b) => b.totalCents - a.totalCents).slice(0, limit);
}

export function monthlySeries(txs: TxLite[], months: string[], savingsCategoryIds: Set<string> = new Set()) {
  return months.map((month) => {
    const { from, to } = monthRange(month);
    const s = summarize(txs.filter((t) => t.date >= from && t.date < to), savingsCategoryIds);
    return { month, ...s };
  });
}

/** Últimos n meses terminando en `endMonth` (YYYY-MM), orden cronológico. */
export function lastMonths(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function prevMonth(month: string): string {
  return lastMonths(month, 2)[0];
}

/** Gasto diario promedio y proyección a fin de mes (si el mes es el actual; si ya pasó, días = mes completo). */
export function dailyProjection(expenseCents: number, month: string, today: Date) {
  const { from, to } = monthRange(month);
  const daysInMonth = Math.round((to.getTime() - from.getTime()) / 86400000);
  let elapsed = daysInMonth;
  if (today >= from && today < to) elapsed = today.getUTCDate();
  else if (today < from) elapsed = 0;
  const avgPerDayCents = elapsed ? Math.round(expenseCents / elapsed) : 0;
  return { daysInMonth, elapsed, avgPerDayCents, projectedCents: avgPerDayCents * daysInMonth };
}

export function pctChange(current: number, previous: number): number | null {
  return previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;
}
