import { monthRange, monthKey, todayAr } from "@/lib/dates";
import { Category, type ICategory } from "../models/category";
import { Transaction, type ITransaction } from "../models/transaction";
import { getPlan, monthlyBudgetCents } from "./savings";
import { byCategory, dailyProjection, lastMonths, monthlySeries, pctChange, prevMonth, summarize, topMerchants, type TxLite } from "./report-calc";

async function loadRange(userId: string, from: Date, to: Date) {
  return Transaction.find({ userId, deletedAt: null, date: { $gte: from, $lt: to } })
    .select("type amountCents currency date categoryId merchant rawDescription internal refund")
    .lean<ITransaction[]>() as unknown as Promise<TxLite[]>;
}

async function categoryInfo(userId: string) {
  const cats = await Category.find({ userId }).lean<ICategory[]>();
  const names = new Map(cats.map((c) => [String(c._id), c.name]));
  const savingsIds = new Set(cats.filter((c) => c.name.toLowerCase() === "ahorro").map((c) => String(c._id)));
  return { names, savingsIds, cats };
}

/** Reporte completo de un mes (FT-RPT-1/2/3/5). */
export async function monthReport(userId: string, month: string, today = todayAr()) {
  const { from, to } = monthRange(month);
  const prev = prevMonth(month);
  const pr = monthRange(prev);
  const [txs, prevTxs, { names, savingsIds }, plan] = await Promise.all([
    loadRange(userId, from, to),
    loadRange(userId, pr.from, pr.to),
    categoryInfo(userId),
    getPlan(userId),
  ]);
  const s = summarize(txs, savingsIds);
  const ps = summarize(prevTxs, savingsIds);
  const budgetCents = monthlyBudgetCents(plan);
  return {
    month,
    ...s,
    budgetCents,
    freeCents: budgetCents - s.expenseCents,
    prev: { month: prev, ...ps },
    expenseChangePct: pctChange(s.expenseCents, ps.expenseCents),
    incomeChangePct: pctChange(s.incomeCents, ps.incomeCents),
    byCategory: byCategory(txs, names, savingsIds),
    topMerchants: topMerchants(txs, 10),
    ...dailyProjection(s.expenseCents, month, today),
  };
}

/** Evolución mensual (barras) de los últimos n meses. */
export async function evolution(userId: string, endMonth: string = monthKey(todayAr()), n = 6) {
  const months = lastMonths(endMonth, n);
  const { from } = monthRange(months[0]);
  const { to } = monthRange(endMonth);
  const [txs, { savingsIds }] = await Promise.all([loadRange(userId, from, to), categoryInfo(userId)]);
  return monthlySeries(txs, months, savingsIds);
}
