import { defineModel, ObjectId } from "./helpers";

export interface IPerson {
  _id: string;
  userId: string;
  name: string;
  note: string;
  deletedAt?: Date | null;
}

export const Person = defineModel<IPerson>("Person", {
  userId: { type: ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  note: { type: String, default: "" },
  deletedAt: { type: Date, default: null },
});

export type DebtKind = "loan" | "paid_for" | "payment" | "offset" | "adjustment";

export interface IDebtEntry {
  _id: string;
  userId: string;
  personId: string;
  kind: DebtKind;
  /** Con signo: + me deben más, − me deben menos. */
  amountCents: number;
  reason: string;
  date: Date;
  transactionId?: string | null;
  voidedAt?: Date | null;
  voidReason?: string;
  items?: { label: string; amountCents: number }[];
  createdAt: Date;
}

export const DebtEntry = defineModel<IDebtEntry>(
  "DebtEntry",
  {
    userId: { type: ObjectId, required: true },
    personId: { type: ObjectId, required: true },
    kind: { type: String, enum: ["loan", "paid_for", "payment", "offset", "adjustment"], required: true },
    amountCents: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    transactionId: { type: ObjectId, default: null },
    voidedAt: { type: Date, default: null },
    voidReason: String,
    items: [{ _id: false, label: String, amountCents: Number }],
  },
  {},
  (s) => s.index({ userId: 1, personId: 1, date: 1 }),
);
