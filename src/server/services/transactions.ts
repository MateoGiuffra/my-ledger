import { createHash, randomUUID } from "node:crypto";
import { monthRange } from "@/lib/dates";
import { plain } from "../models/helpers";
import { Transaction, type ITransaction, type TxSource } from "../models/transaction";

export interface TxInput {
  type: ITransaction["type"];
  amountCents: number;
  currency?: "ARS" | "USD";
  fx?: number;
  date: Date;
  accountId?: string | null;
  categoryId?: string | null;
  merchant?: string;
  note?: string;
  counterpartyId?: string | null;
  rawDescription?: string;
  source?: TxSource;
  externalId?: string;
  importBatchId?: string | null;
  internal?: boolean;
  refund?: boolean;
}

/** Hash estable para dedupe: por id externo si existe, si no por fecha+monto+descripción. */
export function computeDedupeHash(userId: string, source: string, i: { externalId?: string; date: Date; amountCents: number; type: string; rawDescription?: string }) {
  const key = i.externalId
    ? `${source}|id|${i.externalId}`
    : `${source}|${i.date.toISOString().slice(0, 10)}|${i.type}|${i.amountCents}|${(i.rawDescription ?? "").trim().toLowerCase()}`;
  return createHash("sha256").update(`${userId}|${key}`).digest("hex");
}

export async function createTransaction(userId: string, input: TxInput) {
  const source = input.source ?? "manual";
  const dedupeHash = source === "manual" || source === "commitment" ? `${source}:${randomUUID()}` : computeDedupeHash(userId, source, input);
  const doc = await Transaction.create({ ...input, source, userId, dedupeHash, merchant: input.merchant ?? "", note: input.note ?? "", rawDescription: input.rawDescription ?? "" });
  return plain(doc.toObject());
}

export async function getTransaction(userId: string, id: string) {
  const tx = await Transaction.findOne({ _id: id, userId, deletedAt: null }).lean<ITransaction>();
  return tx ? plain(tx) : null;
}

export async function updateTransaction(userId: string, id: string, patch: Partial<TxInput>) {
  const tx = await Transaction.findOneAndUpdate({ _id: id, userId, deletedAt: null }, { $set: patch }, { returnDocument: "after" }).lean<ITransaction>();
  return tx ? plain(tx) : null;
}

/** Borrado lógico. */
export async function deleteTransaction(userId: string, id: string) {
  const r = await Transaction.updateOne({ _id: id, userId, deletedAt: null }, { deletedAt: new Date() });
  return r.modifiedCount === 1;
}

export interface TxFilters {
  month?: string;
  from?: Date;
  to?: Date;
  categoryId?: string;
  accountId?: string;
  type?: ITransaction["type"];
  q?: string;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildTxQuery(userId: string, f: TxFilters) {
  const q: Record<string, unknown> = { userId, deletedAt: null };
  const range = f.month ? monthRange(f.month) : f.from || f.to ? { from: f.from, to: f.to } : null;
  if (range) {
    const d: Record<string, Date> = {};
    if (range.from) d.$gte = range.from;
    if (range.to) d.$lt = range.to;
    q.date = d;
  }
  if (f.categoryId) q.categoryId = f.categoryId;
  if (f.accountId) q.accountId = f.accountId;
  if (f.type) q.type = f.type;
  if (f.q) {
    const re = new RegExp(escapeRegex(f.q), "i");
    q.$or = [{ merchant: re }, { note: re }, { rawDescription: re }];
  }
  return q;
}

export const PAGE_SIZE = 30;

export async function listTransactions(userId: string, f: TxFilters, page = 1, pageSize = PAGE_SIZE) {
  const query = buildTxQuery(userId, f);
  const [items, total, all] = await Promise.all([
    Transaction.find(query).sort({ date: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean<ITransaction[]>(),
    Transaction.countDocuments(query),
    Transaction.find(query).select("type amountCents currency internal refund").lean<Pick<ITransaction, "type" | "amountCents" | "currency" | "internal" | "refund">[]>(),
  ]);
  let expenseCents = 0;
  let incomeCents = 0;
  for (const t of all) {
    if (t.currency !== "ARS" || t.internal) continue;
    if (t.type === "expense") expenseCents += t.amountCents;
    else if (t.type === "income" && t.refund) expenseCents -= t.amountCents;
    else if (t.type === "income") incomeCents += t.amountCents;
  }
  return { items: plain(items), total, pages: Math.max(1, Math.ceil(total / pageSize)), page, totals: { expenseCents, incomeCents } };
}
