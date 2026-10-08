import { defineModel, ObjectId } from "./helpers";

export interface ISavingsPlan {
  _id: string;
  userId: string;
  incomeCents: number;
  usdSp500: number;
  usdSavings: number;
  pctUsd: number;
  fxPlan: number;
}

export const SavingsPlan = defineModel<ISavingsPlan>("SavingsPlan", {
  userId: { type: ObjectId, required: true, unique: true },
  incomeCents: { type: Number, default: 180000000 },
  usdSp500: { type: Number, default: 100 },
  usdSavings: { type: Number, default: 525 },
  pctUsd: { type: Number, default: 0.5 },
  fxPlan: { type: Number, default: 1600 },
});

export type Bucket = "sp500" | "usd" | "pesos_plus";

export interface ISavingsEntry {
  _id: string;
  userId: string;
  month: string;
  bucket: Bucket;
  plannedUsdCents: number;
  actualAmountCents: number;
  currency: "ARS" | "USD";
  fxUsed?: number;
  done: boolean;
}

export const SavingsEntry = defineModel<ISavingsEntry>(
  "SavingsEntry",
  {
    userId: { type: ObjectId, required: true },
    month: { type: String, required: true },
    bucket: { type: String, enum: ["sp500", "usd", "pesos_plus"], required: true },
    plannedUsdCents: { type: Number, default: 0 },
    actualAmountCents: { type: Number, default: 0 },
    currency: { type: String, enum: ["ARS", "USD"], default: "USD" },
    fxUsed: Number,
    done: { type: Boolean, default: false },
  },
  {},
  (s) => s.index({ userId: 1, month: 1, bucket: 1 }, { unique: true }),
);

export interface IGoal {
  _id: string;
  userId: string;
  name: string;
  targetUsdCents: number;
  startDate: Date;
  order: number;
}

export const Goal = defineModel<IGoal>("Goal", {
  userId: { type: ObjectId, required: true, index: true },
  name: { type: String, required: true },
  targetUsdCents: { type: Number, required: true },
  startDate: { type: Date, required: true },
  order: { type: Number, default: 0 },
});
