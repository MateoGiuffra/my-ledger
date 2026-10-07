import { SavingsPlan, type ISavingsPlan } from "../models/savings";
import { plain } from "../models/helpers";

export async function getPlan(userId: string): Promise<ISavingsPlan> {
  const doc = await SavingsPlan.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: "after" }).lean<ISavingsPlan>();
  return plain(doc!);
}

/** Cuánto queda para gastar por mes: ingreso − (USD a ahorrar × dólar plan). Con los defaults = 800.000. */
export function monthlyBudgetCents(p: Pick<ISavingsPlan, "incomeCents" | "usdSp500" | "usdSavings" | "fxPlan">): number {
  return p.incomeCents - Math.round((p.usdSp500 + p.usdSavings) * p.fxPlan * 100);
}
