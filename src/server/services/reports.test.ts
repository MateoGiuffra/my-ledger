import { describe, expect, test } from "vitest";
import { dateOnly } from "@/lib/dates";
import { byCategory, dailyProjection, lastMonths, monthlySeries, pctChange, summarize, topMerchants, type TxLite } from "./report-calc";
import { monthlyBudgetCents } from "./savings";

const tx = (o: Partial<TxLite>): TxLite => ({ type: "expense", amountCents: 0, currency: "ARS", date: dateOnly(2026, 5, 10), ...o });

describe("reportes", () => {
  const txs = [
    tx({ amountCents: 100000, categoryId: "c1", merchant: "Spotify" }),
    tx({ amountCents: 50000, categoryId: "c1", merchant: "Spotify" }),
    tx({ amountCents: 30000, categoryId: "c2", merchant: "Super" }),
    tx({ amountCents: 20000 }),
    tx({ type: "income", amountCents: 500000 }),
    tx({ type: "transfer", amountCents: 999999 }),
    tx({ amountCents: 777, currency: "USD" }),
    tx({ amountCents: 888, internal: true }),
    tx({ amountCents: 40000, categoryId: "ahorro" }),
  ];
  const savings = new Set(["ahorro"]);

  test("resumen ignora transferencias, USD, internos y separa ahorro", () => {
    expect(summarize(txs, savings)).toEqual({ incomeCents: 500000, expenseCents: 200000, savingsCents: 40000 });
  });

  test("por categoría ordenado y 'Sin categoría'", () => {
    const r = byCategory(txs, new Map([["c1", "Comida"], ["c2", "Hogar"]]), savings);
    expect(r.map((x) => [x.name, x.totalCents])).toEqual([["Comida", 150000], ["Hogar", 30000], ["Sin categoría", 20000]]);
  });

  test("top comercios", () => {
    expect(topMerchants(txs, 1)).toEqual([{ name: "Spotify", totalCents: 150000 }]);
  });

  test("serie mensual", () => {
    const s = monthlySeries([...txs, tx({ amountCents: 5, date: dateOnly(2026, 4, 2) })], ["2026-04", "2026-05"], savings);
    expect(s[0].expenseCents).toBe(5);
    expect(s[1].expenseCents).toBe(200000);
  });

  test("meses hacia atrás cruzando año", () => {
    expect(lastMonths("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  test("promedio diario y proyección", () => {
    const p = dailyProjection(310000, "2026-05", dateOnly(2026, 5, 10));
    expect(p).toMatchObject({ daysInMonth: 31, elapsed: 10, avgPerDayCents: 31000, projectedCents: 961000 });
    expect(dailyProjection(3100, "2026-04", dateOnly(2026, 5, 10)).elapsed).toBe(30);
  });

  test("variación porcentual", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(1, 0)).toBeNull();
  });

  test("presupuesto libre del plan: 1.8M − 625 USD × 1600 = 800.000", () => {
    expect(monthlyBudgetCents({ incomeCents: 180000000, usdSp500: 100, usdSavings: 525, fxPlan: 1600 })).toBe(80000000);
    expect(monthlyBudgetCents({ incomeCents: 180000000, usdSp500: 100, usdSavings: 525, fxPlan: 1547 })).toBe(180000000 - 96687500);
  });
});

test("devolución netea el gasto en total y categoría", () => {
  const txs = [
    tx({ amountCents: 10000, categoryId: "c1", merchant: "EBANX" }),
    tx({ type: "income", refund: true, amountCents: 4000, categoryId: "c1", merchant: "EBANX" }),
  ];
  expect(summarize(txs)).toEqual({ incomeCents: 0, expenseCents: 6000, savingsCents: 0 });
  expect(byCategory(txs, new Map([["c1", "Ocio"]]))).toEqual([{ categoryId: "c1", name: "Ocio", totalCents: 6000 }]);
  expect(topMerchants(txs)).toEqual([{ name: "EBANX", totalCents: 6000 }]);
});
