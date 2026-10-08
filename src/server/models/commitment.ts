import { defineModel, ObjectId } from "./helpers";

export type Frequency = "once" | "weekly" | "monthly";

export interface ICommitment {
  _id: string;
  userId: string;
  name: string;
  /** expense: se paga; income: se cobra (ej. Sueldo). */
  kind: "expense" | "income";
  amountCents: number;
  currency: "ARS" | "USD";
  frequency: Frequency;
  /** 1–28 (mensual). */
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date | null;
  categoryId?: string | null;
  accountId?: string | null;
  /** Días antes del vencimiento para avisar (ej. [3, 1, 0]). */
  reminders: number[];
  gcalEventId?: string | null;
  gcalSync: boolean;
  gcalError?: string | null;
  active: boolean;
  deletedAt?: Date | null;
}

export const Commitment = defineModel<ICommitment>("Commitment", {
  userId: { type: ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: ["expense", "income"], default: "expense" },
  amountCents: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
  frequency: { type: String, enum: ["once", "weekly", "monthly"], required: true },
  dayOfMonth: Number,
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  categoryId: { type: ObjectId, default: null },
  accountId: { type: ObjectId, default: null },
  reminders: { type: [Number], default: [3, 1, 0] },
  gcalEventId: { type: String, default: null },
  gcalSync: { type: Boolean, default: false },
  gcalError: { type: String, default: null },
  active: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
});

export interface ICommitmentOccurrence {
  _id: string;
  userId: string;
  commitmentId: string;
  /** Fecha original según el calendario del compromiso (clave de unicidad). */
  baseDate: Date;
  dueDate: Date;
  status: "pending" | "paid" | "skipped";
  transactionId?: string | null;
  postponedCount: number;
}

export const CommitmentOccurrence = defineModel<ICommitmentOccurrence>(
  "CommitmentOccurrence",
  {
    userId: { type: ObjectId, required: true },
    commitmentId: { type: ObjectId, required: true },
    baseDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["pending", "paid", "skipped"], default: "pending" },
    transactionId: { type: ObjectId, default: null },
    postponedCount: { type: Number, default: 0 },
  },
  {},
  (s) => {
    s.index({ commitmentId: 1, baseDate: 1 }, { unique: true });
    s.index({ userId: 1, dueDate: 1, status: 1 });
  },
);

export interface IAlert {
  _id: string;
  userId: string;
  type: "commitment" | "savings" | "payday" | "debt" | "system";
  refType?: string;
  refId?: string;
  /** Clave para no duplicar alertas (ej. commitment:<occId>:3d). */
  key: string;
  fireAt: Date;
  sentAt?: Date | null;
  readAt?: Date | null;
  title: string;
  body: string;
  url?: string;
}

export const Alert = defineModel<IAlert>(
  "Alert",
  {
    userId: { type: ObjectId, required: true },
    type: { type: String, enum: ["commitment", "savings", "payday", "debt", "system"], required: true },
    refType: String,
    refId: String,
    key: { type: String, required: true },
    fireAt: { type: Date, required: true },
    sentAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    url: String,
  },
  {},
  (s) => {
    s.index({ userId: 1, key: 1 }, { unique: true });
    s.index({ userId: 1, fireAt: 1, sentAt: 1 });
  },
);
