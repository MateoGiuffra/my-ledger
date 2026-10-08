import { classifyMpType } from "../importers/mp";
import { findCounterparty } from "../importers/analyze";
import { normalizeIdentifier } from "../importers/normalize";
import { plain } from "../models/helpers";
import { Counterparty, type ICounterparty, type IdentifierKind } from "../models/import";
import { Transaction, type ITransaction } from "../models/transaction";

export interface CounterpartyInput {
  displayName: string;
  identifiers?: { kind: IdentifierKind; value: string }[];
  defaultCategoryId?: string | null;
  label?: string;
  mode?: ICounterparty["mode"];
  debtPersonId?: string | null;
}

const mkIdent = (i: { kind: IdentifierKind; value: string }) => ({ kind: i.kind, value: i.value.trim(), normalized: normalizeIdentifier(i.kind, i.value) });

export async function listCounterparties(userId: string, q?: string) {
  const all = await Counterparty.find({ userId, deletedAt: null }).sort({ displayName: 1 }).lean<ICounterparty[]>();
  const needle = q?.trim().toLowerCase();
  const rows = needle ? all.filter((c) => c.displayName.toLowerCase().includes(needle) || c.identifiers.some((i) => i.value.toLowerCase().includes(needle))) : all;
  return plain(rows);
}

export async function getCounterparty(userId: string, id: string) {
  const c = await Counterparty.findOne({ _id: id, userId, deletedAt: null }).lean<ICounterparty>();
  return c ? plain(c) : null;
}

export async function createCounterparty(userId: string, d: CounterpartyInput) {
  const name = d.displayName.trim();
  if (!name) throw new Error("Nombre requerido");
  const doc = await Counterparty.create({
    userId,
    displayName: name,
    identifiers: (d.identifiers ?? []).filter((i) => i.value.trim()).map(mkIdent),
    defaultCategoryId: d.defaultCategoryId || null,
    label: d.label?.trim() || undefined,
    mode: d.mode ?? "normal",
    debtPersonId: d.debtPersonId || null,
  });
  return plain(doc.toObject());
}

export async function updateCounterparty(userId: string, id: string, d: Partial<Omit<CounterpartyInput, "identifiers">>) {
  const set: Record<string, unknown> = {};
  if (d.displayName !== undefined) set.displayName = d.displayName.trim();
  if (d.defaultCategoryId !== undefined) set.defaultCategoryId = d.defaultCategoryId || null;
  if (d.label !== undefined) set.label = d.label.trim() || undefined;
  if (d.mode !== undefined) set.mode = d.mode;
  if (d.debtPersonId !== undefined) set.debtPersonId = d.debtPersonId || null;
  await Counterparty.updateOne({ _id: id, userId }, { $set: set });
}

export async function addIdentifier(userId: string, id: string, i: { kind: IdentifierKind; value: string }) {
  const ident = mkIdent(i);
  if (!ident.value) throw new Error("Valor requerido");
  await Counterparty.updateOne({ _id: id, userId, "identifiers.normalized": { $ne: ident.normalized } }, { $push: { identifiers: ident } });
}

export async function removeIdentifier(userId: string, id: string, normalized: string) {
  await Counterparty.updateOne({ _id: id, userId }, { $pull: { identifiers: { normalized } } });
}

export async function archiveCounterparty(userId: string, id: string) {
  await Counterparty.updateOne({ _id: id, userId }, { deletedAt: new Date() });
}

/** FT-CPA-4: asigna un nombre de MP a una contraparte existente o nueva. */
export async function assignName(userId: string, name: string, target: { counterpartyId: string } | { create: CounterpartyInput }) {
  if ("counterpartyId" in target) {
    await addIdentifier(userId, target.counterpartyId, { kind: "mp_name", value: name });
    return target.counterpartyId;
  }
  const c = await createCounterparty(userId, { ...target.create, identifiers: [{ kind: "mp_name", value: name }, ...(target.create.identifiers ?? [])] });
  return c._id;
}

/** FT-CPA-7: fusiona `fromId` dentro de `intoId` (identificadores y movimientos). */
export async function mergeCounterparties(userId: string, fromId: string, intoId: string) {
  if (fromId === intoId) throw new Error("No se puede fusionar consigo misma");
  const [from, into] = await Promise.all([getCounterparty(userId, fromId), getCounterparty(userId, intoId)]);
  if (!from || !into) throw new Error("Contraparte inexistente");
  for (const i of from.identifiers) await addIdentifier(userId, intoId, { kind: i.kind, value: i.value });
  await Transaction.updateMany({ userId, counterpartyId: fromId }, { $set: { counterpartyId: intoId } });
  await archiveCounterparty(userId, fromId);
}

/** Aplica la contraparte a movimientos ya importados que no la tenían (y sin categoría, la categoría por defecto). */
export async function applyToExisting(userId: string, id: string) {
  const cp = await getCounterparty(userId, id);
  if (!cp) return 0;
  const candidates = await Transaction.find({ userId, deletedAt: null, source: "mp_csv", counterpartyId: null, rawDescription: /^Transferencia (enviada|recibida) /i }).lean<ITransaction[]>();
  let n = 0;
  for (const t of candidates) {
    const { name } = classifyMpType(t.rawDescription);
    if (findCounterparty([cp], name)?._id !== cp._id) continue;
    const set: Record<string, unknown> = { counterpartyId: id, merchant: cp.label || cp.displayName };
    if (!t.categoryId && cp.defaultCategoryId) set.categoryId = cp.defaultCategoryId;
    if (cp.mode === "transfer") set.type = "transfer";
    await Transaction.updateOne({ _id: t._id }, { $set: set });
    n++;
  }
  return n;
}

export async function counterpartyStats(userId: string, id: string) {
  const txs = await Transaction.find({ userId, deletedAt: null, counterpartyId: id }).sort({ date: -1 }).lean<ITransaction[]>();
  const spent = txs.filter((t) => t.type === "expense" && t.currency === "ARS").reduce((s, t) => s + t.amountCents, 0);
  const received = txs.filter((t) => t.type === "income" && t.currency === "ARS").reduce((s, t) => s + t.amountCents, 0);
  return { count: txs.length, spentCents: spent, receivedCents: received, recent: plain(txs.slice(0, 20)) };
}
