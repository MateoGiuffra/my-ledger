import { dateOnly, parseIsoDate } from "@/lib/dates";
import { analyzeRows, groupUncategorizedMerchants, groupUnassigned, type AnalyzedRow } from "../importers/analyze";
import { parseMpCsv } from "../importers/mp";
import { Account, type IAccount } from "../models/account";
import { DebtEntry } from "../models/debt";
import { plain } from "../models/helpers";
import { Counterparty, ImportBatch, Rule, type ICounterparty, type IImportBatch, type IRule } from "../models/import";
import { Transaction } from "../models/transaction";
import { addEntry } from "./debts";
import { computeDedupeHash } from "./transactions";

export class ImportError extends Error {}

/** Sube el CSV, lo parsea y guarda un lote en estado "preview" (nada se importa hasta confirmar). */
export async function createPreview(userId: string, fileName: string, text: string) {
  const parsed = parseMpCsv(text);
  if (parsed.rows.length === 0) throw new ImportError(parsed.validation.errors[0] ?? "El archivo no tiene movimientos");
  const batch = await ImportBatch.create({
    userId,
    source: "mp_csv",
    fileName,
    status: "preview",
    rows: parsed.rows.length,
    summary: parsed.summary ?? undefined,
    validation: parsed.validation,
    data: parsed.rows,
  });
  return String(batch._id);
}

export async function getBatch(userId: string, id: string) {
  const b = await ImportBatch.findOne({ _id: id, userId }).lean<IImportBatch>();
  return b ? plain(b) : null;
}

export async function listBatches(userId: string) {
  return plain(await ImportBatch.find({ userId, status: { $in: ["committed", "rolled_back"] } }).select("-data").sort({ createdAt: -1 }).limit(50).lean<IImportBatch[]>());
}

/** Análisis "en vivo": cruza las filas del lote con contrapartes, reglas y lo ya importado. */
export async function analyzeBatch(userId: string, batch: IImportBatch) {
  const [counterparties, rules] = await Promise.all([
    Counterparty.find({ userId, deletedAt: null }).lean<ICounterparty[]>(),
    Rule.find({ userId }).lean<IRule[]>(),
  ]);
  const keys = batch.data.map((r) => (r.kind === "refund" ? `${r.referenceId}:refund:${Math.abs(r.amountCents)}` : r.referenceId));
  const existing = await Transaction.find({ userId, source: "mp_csv", externalId: { $in: keys } }).select("externalId importBatchId").lean<{ externalId: string; importBatchId?: string }[]>();
  // las filas de este mismo lote ya confirmado no cuentan como "ya importadas" al revisarlo
  const existingExternalIds = new Set(existing.filter((e) => String(e.importBatchId) !== String(batch._id)).map((e) => e.externalId));
  const rows = analyzeRows(batch.data, {
    counterparties: plain(counterparties),
    rules: plain(rules),
    existingExternalIds,
    overrides: batch.overrides ?? {},
    options: batch.options ?? { yields: "ignore" },
  });
  return {
    rows,
    counts: {
      total: rows.length,
      new: rows.filter((r) => r.status === "new").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      ignored: rows.filter((r) => r.status === "ignored").length,
      uncategorized: rows.filter((r) => r.status === "new" && !r.categoryId && r.type !== "transfer").length,
    },
    unassigned: groupUnassigned(rows),
    merchants: groupUncategorizedMerchants(rows),
  };
}

export async function setOverride(userId: string, batchId: string, rowKey: string, categoryId: string | null) {
  const key = `overrides.${rowKey.replace(/[.$]/g, "_")}`;
  await ImportBatch.updateOne({ _id: batchId, userId, status: "preview" }, categoryId ? { $set: { [key]: categoryId } } : { $unset: { [key]: "" } });
}

export async function setYieldsOption(userId: string, batchId: string, yields: "ignore" | "income") {
  await ImportBatch.updateOne({ _id: batchId, userId, status: "preview" }, { $set: { "options.yields": yields } });
}

export async function discardBatch(userId: string, batchId: string) {
  await ImportBatch.updateOne({ _id: batchId, userId, status: "preview" }, { status: "discarded", data: [] });
}

function toDoc(userId: string, batchId: string, accountId: string | null, a: AnalyzedRow) {
  const date = parseIsoDate(a.row.date) ?? dateOnly(1970, 1, 1);
  return {
    userId,
    type: a.type,
    amountCents: a.amountCents,
    currency: "ARS" as const,
    date,
    accountId,
    categoryId: a.categoryId,
    merchant: a.merchant,
    note: "",
    counterpartyId: a.counterpartyId,
    rawDescription: a.row.rawType,
    source: "mp_csv" as const,
    externalId: a.dedupeKey,
    dedupeHash: computeDedupeHash(userId, "mp_csv", { externalId: a.dedupeKey, date, amountCents: a.amountCents, type: a.type }),
    importBatchId: batchId,
    internal: a.internal,
    refund: a.refund,
  };
}

/** Confirma el lote: inserta las filas nuevas (omite duplicadas/ignoradas) y crea movimientos de deuda sugeridos. */
export async function commitBatch(userId: string, batchId: string) {
  const batch = await getBatch(userId, batchId);
  if (!batch) throw new ImportError("Lote inexistente");
  if (batch.status !== "preview") throw new ImportError("El lote ya fue procesado");
  const analysis = await analyzeBatch(userId, batch);
  const account = await Account.findOne({ userId, type: "mp", deletedAt: null }).sort({ createdAt: 1 }).lean<IAccount>();
  const toInsert = analysis.rows.filter((r) => r.status === "new");
  const docs = toInsert.map((a) => toDoc(userId, batchId, account ? String(account._id) : null, a));
  try {
    if (docs.length) await Transaction.insertMany(docs, { ordered: false });
  } catch {
    // carreras de dedupe (índice único): se reconcilia contando lo realmente insertado
  }
  const inserted = await Transaction.find({ userId, importBatchId: batchId }).select("externalId").lean<{ _id: string; externalId: string }[]>();
  const idByExternal = new Map(inserted.map((t) => [t.externalId, String(t._id)]));
  for (const a of toInsert) {
    if (!a.debt) continue;
    const txId = idByExternal.get(a.dedupeKey);
    if (!txId) continue;
    await addEntry(userId, {
      personId: a.debt.personId,
      kind: a.debt.kind,
      amountCents: a.amountCents,
      reason: a.row.rawType,
      date: parseIsoDate(a.row.date)!,
      transactionId: txId,
    });
  }
  await ImportBatch.updateOne(
    { _id: batchId, userId },
    { status: "committed", inserted: inserted.length, skipped: batch.rows - inserted.length, rows: batch.rows },
  );
  return { inserted: inserted.length, skipped: batch.rows - inserted.length };
}

/** Rollback del lote: borra lo importado y anula (con motivo) los movimientos de deuda que generó. */
export async function rollbackBatch(userId: string, batchId: string) {
  const batch = await getBatch(userId, batchId);
  if (!batch || batch.status !== "committed") throw new ImportError("Solo se puede deshacer un lote confirmado");
  const txs = await Transaction.find({ userId, importBatchId: batchId }).select("_id").lean<{ _id: string }[]>();
  const ids = txs.map((t) => t._id);
  await DebtEntry.updateMany(
    { userId, transactionId: { $in: ids }, voidedAt: null },
    { voidedAt: new Date(), voidReason: `Rollback de importación (${batch.fileName})` },
  );
  const res = await Transaction.deleteMany({ userId, importBatchId: batchId });
  await ImportBatch.updateOne({ _id: batchId, userId }, { status: "rolled_back" });
  return res.deletedCount;
}
