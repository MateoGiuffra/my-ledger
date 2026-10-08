import { defineModel, ObjectId } from "./helpers";

export interface IRule {
  _id: string;
  userId: string;
  match: "contains" | "regex";
  pattern: string;
  categoryId: string;
  priority: number;
  label?: string;
}

export const Rule = defineModel<IRule>("Rule", {
  userId: { type: ObjectId, required: true, index: true },
  match: { type: String, enum: ["contains", "regex"], default: "contains" },
  pattern: { type: String, required: true, trim: true },
  categoryId: { type: ObjectId, required: true },
  priority: { type: Number, default: 0 },
  label: String,
});

export type IdentifierKind = "mp_name" | "alias" | "cbu" | "cvu" | "cuit";

export interface ICounterparty {
  _id: string;
  userId: string;
  displayName: string;
  identifiers: { kind: IdentifierKind; value: string; normalized: string }[];
  defaultCategoryId?: string | null;
  label?: string;
  /** expense/income: se clasifica por signo; debt: genera movimiento de deuda; transfer: transferencia propia (no es gasto). */
  mode: "normal" | "debt" | "transfer";
  debtPersonId?: string | null;
  amountOverrides: { amountCents: number; categoryId?: string | null; label?: string }[];
  deletedAt?: Date | null;
}

export const Counterparty = defineModel<ICounterparty>(
  "Counterparty",
  {
    userId: { type: ObjectId, required: true },
    displayName: { type: String, required: true, trim: true },
    identifiers: [
      {
        _id: false,
        kind: { type: String, enum: ["mp_name", "alias", "cbu", "cvu", "cuit"], required: true },
        value: { type: String, required: true },
        normalized: { type: String, required: true },
      },
    ],
    defaultCategoryId: { type: ObjectId, default: null },
    label: String,
    mode: { type: String, enum: ["normal", "debt", "transfer"], default: "normal" },
    debtPersonId: { type: ObjectId, default: null },
    amountOverrides: [{ _id: false, amountCents: Number, categoryId: { type: ObjectId, default: null }, label: String }],
    deletedAt: { type: Date, default: null },
  },
  {},
  (s) => s.index({ userId: 1, "identifiers.normalized": 1 }),
);

export interface ImportedRow {
  index: number;
  /** YYYY-MM-DD */
  date: string;
  rawType: string;
  referenceId: string;
  amountCents: number;
  balanceCents: number;
  kind: string;
  name: string;
}

export interface IImportBatch {
  _id: string;
  userId: string;
  source: "mp_csv";
  fileName: string;
  status: "preview" | "committed" | "rolled_back" | "discarded";
  rows: number;
  inserted: number;
  skipped: number;
  summary?: { initialCents: number; creditsCents: number; debitsCents: number; finalCents: number };
  validation?: { ok: boolean; expectedFinalCents: number; computedFinalCents: number; balanceBreaks: number; errors: string[] };
  options: { yields: "ignore" | "income" };
  /** Filas parseadas, para revisar/confirmar sin volver a subir el archivo. */
  data: ImportedRow[];
  /** Override de categoría por fila: { [referenceId|index]: categoryId } */
  overrides: Record<string, string>;
  createdAt: Date;
}

export const ImportBatch = defineModel<IImportBatch>(
  "ImportBatch",
  {
    userId: { type: ObjectId, required: true, index: true },
    source: { type: String, enum: ["mp_csv"], default: "mp_csv" },
    fileName: { type: String, default: "" },
    status: { type: String, enum: ["preview", "committed", "rolled_back", "discarded"], default: "preview" },
    rows: { type: Number, default: 0 },
    inserted: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    summary: { initialCents: Number, creditsCents: Number, debitsCents: Number, finalCents: Number },
    validation: { ok: Boolean, expectedFinalCents: Number, computedFinalCents: Number, balanceBreaks: Number, errors: [String] },
    options: { yields: { type: String, enum: ["ignore", "income"], default: "ignore" } },
    data: { type: [Object], default: [] },
    overrides: { type: Object, default: {} },
  },
  { minimize: false },
);
