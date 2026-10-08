import { defineModel, ObjectId } from "./helpers";

export type TxType = "expense" | "income" | "transfer";
export type TxSource = "manual" | "mp_csv" | "mp_api" | "commitment";

export interface ITransaction {
  _id: string;
  userId: string;
  type: TxType;
  /** Siempre positivo: el signo lo da `type`. */
  amountCents: number;
  currency: "ARS" | "USD";
  fx?: number;
  date: Date;
  accountId?: string | null;
  categoryId?: string | null;
  merchant: string;
  note: string;
  counterpartyId?: string | null;
  rawDescription: string;
  source: TxSource;
  externalId?: string;
  dedupeHash: string;
  importBatchId?: string | null;
  /** Marca de "movimiento interno" (ej. dinero reservado) que no cuenta como gasto/ingreso. */
  internal?: boolean;
  /** Devolución: un ingreso que netea el gasto original (resta de gastos en vez de sumar a ingresos). */
  refund?: boolean;
  deletedAt?: Date | null;
}

export const Transaction = defineModel<ITransaction>(
  "Transaction",
  {
    userId: { type: ObjectId, required: true },
    type: { type: String, enum: ["expense", "income", "transfer"], required: true },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
    fx: Number,
    date: { type: Date, required: true },
    accountId: { type: ObjectId, default: null },
    categoryId: { type: ObjectId, default: null },
    merchant: { type: String, default: "" },
    note: { type: String, default: "" },
    counterpartyId: { type: ObjectId, default: null },
    rawDescription: { type: String, default: "" },
    source: { type: String, enum: ["manual", "mp_csv", "mp_api", "commitment"], default: "manual" },
    externalId: String,
    dedupeHash: { type: String, required: true },
    importBatchId: { type: ObjectId, default: null },
    internal: { type: Boolean, default: false },
    refund: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {},
  (s) => {
    s.index({ userId: 1, date: -1 });
    s.index({ userId: 1, dedupeHash: 1 }, { unique: true });
    s.index({ userId: 1, categoryId: 1, date: 1 });
    s.index({ userId: 1, importBatchId: 1 });
  },
);
