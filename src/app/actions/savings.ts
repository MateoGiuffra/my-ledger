"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { amountField } from "@/lib/validators/transaction";
import { saveEntry, SavingsError, setFxActual, updateGoal, updatePlan } from "@/server/services/savings";
import { requireUserId } from "@/server/session";

const num = (min = 0) => z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number().min(min));
const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))), z.number().positive().optional());

async function guard(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof SavingsError || e instanceof z.ZodError)) throw e;
  }
  revalidatePath("/", "layout");
}

export async function updatePlanAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(async () => {
    const p = z.object({ income: amountField, usdSp500: num(), usdSavings: num(), pctUsd: num().pipe(z.number().max(100)), fxPlan: num(1) }).parse(Object.fromEntries(fd));
    await updatePlan(userId, { incomeCents: p.income, usdSp500: p.usdSp500, usdSavings: p.usdSavings, pctUsd: p.pctUsd / 100, fxPlan: p.fxPlan });
  });
}

export async function updateFxAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(async () => {
    const p = z.object({ fxPlan: optNum, fxActual: optNum }).parse(Object.fromEntries(fd));
    if (p.fxPlan) await updatePlan(userId, { fxPlan: p.fxPlan });
    await setFxActual(userId, p.fxActual ?? null);
  });
}

export async function saveEntryAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(async () => {
    const p = z
      .object({ month: z.string().regex(/^\d{4}-\d{2}$/), bucket: z.enum(["sp500", "usd", "pesos_plus"]), amount: z.string(), fxUsed: optNum, done: z.string().optional() })
      .parse(Object.fromEntries(fd));
    const amount = p.amount.trim() === "" ? 0 : amountField.parse(p.amount);
    await saveEntry(userId, p.month, p.bucket, { actualAmountCents: amount, fxUsed: p.fxUsed, done: p.done === "on" });
  });
}

export async function updateGoalAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(async () => {
    const p = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i), target: amountField }).parse(Object.fromEntries(fd));
    await updateGoal(userId, p.id, { targetUsdCents: p.target });
  });
}

