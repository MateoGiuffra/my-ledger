import { formatMoney } from "@/lib/money";
import { formatDate, todayAr } from "@/lib/dates";
import { plain } from "../models/helpers";
import { DebtEntry, Person, type DebtKind, type IDebtEntry, type IPerson } from "../models/debt";

export class DebtError extends Error {}

const POSITIVE: DebtKind[] = ["loan", "paid_for"];
const NEGATIVE: DebtKind[] = ["payment", "offset"];

export const KIND_LABEL: Record<DebtKind, string> = {
  loan: "Préstamo",
  paid_for: "Gasto a su cargo",
  payment: "Pago",
  offset: "Compensación",
  adjustment: "Ajuste",
};

/**
 * Signo según el tipo: loan/paid_for suman, payment/offset restan.
 * Para adjustment el monto viene con signo (±) y no puede ser 0.
 */
export function signedAmount(kind: DebtKind, amountCents: number): number {
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new DebtError("Monto inválido");
  if (kind === "adjustment") return amountCents;
  const abs = Math.abs(amountCents);
  return POSITIVE.includes(kind) ? abs : NEGATIVE.includes(kind) ? -abs : abs;
}

export async function createPerson(userId: string, name: string, note = "") {
  const n = name.trim();
  if (!n) throw new DebtError("Nombre requerido");
  return plain((await Person.create({ userId, name: n, note })).toObject());
}

export async function listPersons(userId: string) {
  return plain(await Person.find({ userId, deletedAt: null }).sort({ name: 1 }).lean<IPerson[]>());
}

export async function getPerson(userId: string, id: string) {
  const p = await Person.findOne({ _id: id, userId, deletedAt: null }).lean<IPerson>();
  return p ? plain(p) : null;
}

export interface EntryInput {
  personId: string;
  kind: DebtKind;
  /** Monto (positivo para todos los tipos salvo ajuste, que lleva signo). Se ignora si hay `items`. */
  amountCents?: number;
  reason: string;
  date: Date;
  transactionId?: string | null;
  items?: { label: string; amountCents: number }[];
}

/** Alta de movimiento de deuda. Las entradas son inmutables: solo se anulan o se corrigen con ajuste. */
export async function addEntry(userId: string, input: EntryInput) {
  const reason = input.reason.trim();
  if (!reason) throw new DebtError("El motivo es obligatorio");
  if (!(await getPerson(userId, input.personId))) throw new DebtError("Persona inexistente");
  const items = input.items?.filter((i) => i.amountCents !== 0).map((i) => ({ label: i.label.trim(), amountCents: Math.abs(i.amountCents) }));
  const base = items?.length ? items.reduce((s, i) => s + i.amountCents, 0) : (input.amountCents ?? 0);
  const amountCents = signedAmount(input.kind, base);
  const doc = await DebtEntry.create({
    userId,
    personId: input.personId,
    kind: input.kind,
    amountCents,
    reason,
    date: input.date,
    transactionId: input.transactionId ?? null,
    items: items?.length ? items : undefined,
  });
  return plain(doc.toObject());
}

/** Anular con motivo (queda visible tachada y no cuenta en el saldo). No se puede anular dos veces. */
export async function voidEntry(userId: string, entryId: string, voidReason: string) {
  const r = voidReason.trim();
  if (!r) throw new DebtError("El motivo de anulación es obligatorio");
  const res = await DebtEntry.updateOne({ _id: entryId, userId, voidedAt: null }, { voidedAt: new Date(), voidReason: r });
  if (res.modifiedCount !== 1) throw new DebtError("Movimiento inexistente o ya anulado");
}

export type TimelineRow = IDebtEntry & { balanceAfterCents: number };

/** Orden estable: fecha, luego orden de carga. */
export function sortEntries<T extends Pick<IDebtEntry, "date" | "createdAt" | "_id">>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      String(a._id).localeCompare(String(b._id)),
  );
}

/** Calcula el saldo corrido tras cada movimiento; las anuladas no modifican el saldo. */
export function withRunningBalance(entries: IDebtEntry[]): TimelineRow[] {
  let bal = 0;
  return sortEntries(entries).map((e) => {
    if (!e.voidedAt) bal += e.amountCents;
    return { ...e, balanceAfterCents: bal };
  });
}

export async function timeline(userId: string, personId: string) {
  const entries = await DebtEntry.find({ userId, personId }).lean<IDebtEntry[]>();
  const rows = withRunningBalance(plain(entries));
  return { rows, balanceCents: rows.length ? rows[rows.length - 1].balanceAfterCents : 0 };
}

/** Dashboard: total que me deben, ranking por persona y antigüedad (días desde el último pago o primer movimiento). */
export async function overview(userId: string, today = todayAr()) {
  const [persons, entries] = await Promise.all([listPersons(userId), DebtEntry.find({ userId, voidedAt: null }).lean<IDebtEntry[]>()]);
  const people = persons.map((p) => {
    const mine = sortEntries(plain(entries).filter((e) => e.personId === String(p._id)));
    const balanceCents = mine.reduce((s, e) => s + e.amountCents, 0);
    const last = mine[mine.length - 1];
    const lastPayment = [...mine].reverse().find((e) => e.amountCents < 0);
    const ref = lastPayment ?? mine[0];
    const ageDays = ref ? Math.max(0, Math.floor((today.getTime() - new Date(ref.date).getTime()) / 86400000)) : 0;
    return { ...p, balanceCents, lastEntryDate: last?.date ?? null, ageDays, entries: mine.length };
  });
  const ranking = people.filter((p) => p.balanceCents !== 0).sort((a, b) => b.balanceCents - a.balanceCents);
  return { totalCents: people.reduce((s, p) => s + Math.max(0, p.balanceCents), 0), people: ranking.concat(people.filter((p) => p.balanceCents === 0)) };
}

/** Texto de extracto listo para copiar/enviar por WhatsApp (FT-DEU-7/8). */
export function statementText(personName: string, rows: TimelineRow[]): string {
  const lines = [`Extracto de ${personName}`];
  for (const r of rows) {
    if (r.voidedAt) continue;
    const sign = r.amountCents >= 0 ? "+" : "−";
    lines.push(`${formatDate(new Date(r.date))} · ${r.reason}: ${sign}${formatMoney(Math.abs(r.amountCents))} → saldo ${formatMoney(r.balanceAfterCents)}`);
  }
  const live = rows.filter((r) => !r.voidedAt);
  lines.push(`Total adeudado: ${formatMoney(live.length ? live[live.length - 1].balanceAfterCents : 0)}`);
  return lines.join("\n");
}
