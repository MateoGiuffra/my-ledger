import { dateOnly, todayAr } from "@/lib/dates";
import { Commitment, CommitmentOccurrence, type ICommitment, type ICommitmentOccurrence } from "../models/commitment";
import { plain } from "../models/helpers";
import { Transaction } from "../models/transaction";
import { removeEvent, upsertEvent } from "../integrations/gcal";
import { User } from "../models/user";
import { occurrenceDates, remaining } from "./commitment-calc";
import { createTransaction } from "./transactions";

export class CommitmentError extends Error {}

export interface CommitmentInput {
  name: string;
  amountCents: number;
  currency?: "ARS" | "USD";
  frequency: ICommitment["frequency"];
  dayOfMonth?: number;
  startDate: Date;
  endDate?: Date | null;
  categoryId?: string | null;
  accountId?: string | null;
  reminders?: number[];
  gcalSync?: boolean;
}

const WINDOW_DAYS = 60;
const BACK_DAYS = 3; // colchón para recuperar días sin sincronizar (no se generan vencidos "históricos")
const addD = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Genera las ocurrencias faltantes en la ventana móvil [hoy-3d, hoy+60d] y limpia pendientes que ya no corresponden. */
export async function syncOccurrences(userId: string, today = todayAr(), commitmentId?: string) {
  const list = await Commitment.find({ userId, deletedAt: null, active: true, ...(commitmentId ? { _id: commitmentId } : {}) }).lean<ICommitment[]>();
  const from = addD(today, -BACK_DAYS);
  const to = addD(today, WINDOW_DAYS);
  for (const c of list) {
    const dates = occurrenceDates(c, from, to);
    if (dates.length) {
      await CommitmentOccurrence.bulkWrite(
        dates.map((d) => ({
          updateOne: {
            filter: { commitmentId: c._id, baseDate: d },
            update: { $setOnInsert: { userId, commitmentId: c._id, baseDate: d, dueDate: d, status: "pending", postponedCount: 0 } },
            upsert: true,
          },
        })),
      );
    }
    // pendientes (sin postergar) dentro de la ventana que ya no están en el calendario (ej. se cambió el día o el fin)
    const keep = new Set(dates.map((d) => d.toISOString()));
    const pend = await CommitmentOccurrence.find({ commitmentId: c._id, status: "pending", postponedCount: 0, baseDate: { $gte: from, $lte: to } }).lean<ICommitmentOccurrence[]>();
    const stale = pend.filter((o) => !keep.has(new Date(o.baseDate).toISOString())).map((o) => o._id);
    if (stale.length) await CommitmentOccurrence.deleteMany({ _id: { $in: stale } });
  }
}

async function syncGcal(userId: string, c: ICommitment) {
  if (!c.gcalSync) return;
  try {
    const u = await User.findById(userId).select("alertPrefs").lean<{ alertPrefs?: { hour?: number } }>();
    const id = await upsertEvent(userId, c, u?.alertPrefs?.hour ?? 9);
    await Commitment.updateOne({ _id: c._id }, { gcalEventId: id, gcalError: id ? null : "Google Calendar no está conectado" });
  } catch (e) {
    await Commitment.updateOne({ _id: c._id }, { gcalError: e instanceof Error ? e.message.slice(0, 200) : "Error de Google Calendar" });
  }
}

function validate(i: CommitmentInput) {
  if (!i.name.trim()) throw new CommitmentError("Nombre requerido");
  if (!(i.amountCents > 0)) throw new CommitmentError("Monto inválido");
  if (i.endDate && i.endDate < i.startDate) throw new CommitmentError("La fecha de fin es anterior al inicio");
  if (i.frequency === "monthly" && (i.dayOfMonth == null || i.dayOfMonth < 1 || i.dayOfMonth > 28)) throw new CommitmentError("El día del mes debe estar entre 1 y 28");
}

export async function createCommitment(userId: string, i: CommitmentInput, today = todayAr()) {
  validate(i);
  const doc = await Commitment.create({ ...i, userId, name: i.name.trim(), reminders: i.reminders ?? [3, 1, 0], gcalSync: !!i.gcalSync });
  const c = plain(doc.toObject());
  await syncOccurrences(userId, today, c._id);
  await syncGcal(userId, c);
  return (await getCommitment(userId, c._id))!;
}

export async function getCommitment(userId: string, id: string) {
  const c = await Commitment.findOne({ _id: id, userId, deletedAt: null }).lean<ICommitment>();
  return c ? plain(c) : null;
}

export async function updateCommitment(userId: string, id: string, i: CommitmentInput, today = todayAr()) {
  validate(i);
  const c = await Commitment.findOneAndUpdate({ _id: id, userId, deletedAt: null }, { $set: { ...i, name: i.name.trim(), gcalSync: !!i.gcalSync } }, { returnDocument: "after" }).lean<ICommitment>();
  if (!c) throw new CommitmentError("Compromiso inexistente");
  await syncOccurrences(userId, today, id);
  if (c.gcalSync) await syncGcal(userId, plain(c));
  else if (c.gcalEventId) {
    await removeEvent(userId, c.gcalEventId).catch(() => {});
    await Commitment.updateOne({ _id: id }, { gcalEventId: null, gcalError: null });
  }
  return getCommitment(userId, id);
}

/** Baja lógica: borra el evento de Google y las ocurrencias pendientes futuras. */
export async function deleteCommitment(userId: string, id: string, today = todayAr()) {
  const c = await Commitment.findOneAndUpdate({ _id: id, userId, deletedAt: null }, { deletedAt: new Date(), active: false }).lean<ICommitment>();
  if (!c) return false;
  if (c.gcalEventId) await removeEvent(userId, c.gcalEventId).catch(() => {});
  await CommitmentOccurrence.deleteMany({ commitmentId: id, status: "pending", dueDate: { $gte: today } });
  return true;
}

export async function listCommitments(userId: string, today = todayAr()) {
  const list = plain(await Commitment.find({ userId, deletedAt: null }).sort({ createdAt: -1 }).lean<ICommitment[]>());
  const done = await CommitmentOccurrence.find({ userId, status: { $in: ["paid", "skipped"] } }).select("commitmentId baseDate").lean<ICommitmentOccurrence[]>();
  return list.map((c) => {
    const set = new Set(done.filter((o) => String(o.commitmentId) === c._id).map((o) => new Date(o.baseDate).toISOString().slice(0, 10)));
    const rem = remaining(c, today, set);
    const finished = c.endDate ? new Date(c.endDate) < today : c.frequency === "once" ? new Date(c.startDate) < today && rem.count === 0 : false;
    return { ...c, remainingCount: rem.count, remainingCents: rem.totalCents, finished: finished || (rem.count === 0 && c.frequency !== "weekly" && !!c.endDate) };
  });
}

export interface UpcomingItem {
  _id: string;
  commitmentId: string;
  name: string;
  amountCents: number;
  currency: "ARS" | "USD";
  dueDate: string;
  overdue: boolean;
  status: ICommitmentOccurrence["status"];
}

export async function upcoming(userId: string, days = 30, today = todayAr()): Promise<UpcomingItem[]> {
  await syncOccurrences(userId, today);
  const occs = await CommitmentOccurrence.find({ userId, status: "pending", dueDate: { $lte: addD(today, days) } }).sort({ dueDate: 1 }).lean<ICommitmentOccurrence[]>();
  const cs = await Commitment.find({ userId, deletedAt: null, _id: { $in: occs.map((o) => o.commitmentId) } }).lean<ICommitment[]>();
  const byId = new Map(cs.map((c) => [String(c._id), c]));
  return occs.flatMap((o) => {
    const c = byId.get(String(o.commitmentId));
    if (!c) return [];
    return [{ _id: String(o._id), commitmentId: String(c._id), name: c.name, amountCents: c.amountCents, currency: c.currency, dueDate: new Date(o.dueDate).toISOString().slice(0, 10), overdue: new Date(o.dueDate) < today, status: o.status }];
  });
}

/** Marca la ocurrencia como pagada y genera el gasto (FT-COM-3). */
export async function markPaid(userId: string, occId: string, opts: { amountCents?: number; date?: Date } = {}, today = todayAr()) {
  const o = await CommitmentOccurrence.findOne({ _id: occId, userId, status: "pending" }).lean<ICommitmentOccurrence>();
  if (!o) throw new CommitmentError("Vencimiento inexistente o ya procesado");
  const c = await Commitment.findOne({ _id: o.commitmentId, userId }).lean<ICommitment>();
  if (!c) throw new CommitmentError("Compromiso inexistente");
  const tx = await createTransaction(userId, {
    type: "expense",
    amountCents: opts.amountCents ?? c.amountCents,
    currency: c.currency,
    date: opts.date ?? today,
    accountId: c.accountId ? String(c.accountId) : null,
    categoryId: c.categoryId ? String(c.categoryId) : null,
    merchant: c.name,
    note: "Compromiso pagado",
    source: "commitment",
  });
  // update condicional: evita doble pago por doble tap
  const r = await CommitmentOccurrence.updateOne({ _id: occId, status: "pending" }, { status: "paid", transactionId: tx._id });
  if (r.modifiedCount !== 1) {
    await Transaction.deleteOne({ _id: tx._id });
    throw new CommitmentError("Vencimiento ya procesado");
  }
  return tx;
}

export async function skipOccurrence(userId: string, occId: string) {
  const r = await CommitmentOccurrence.updateOne({ _id: occId, userId, status: "pending" }, { status: "skipped" });
  if (r.modifiedCount !== 1) throw new CommitmentError("Vencimiento inexistente o ya procesado");
}

export async function postponeOccurrence(userId: string, occId: string, days = 7) {
  const o = await CommitmentOccurrence.findOne({ _id: occId, userId, status: "pending" }).lean<ICommitmentOccurrence>();
  if (!o) throw new CommitmentError("Vencimiento inexistente o ya procesado");
  await CommitmentOccurrence.updateOne({ _id: occId }, { dueDate: addD(new Date(o.dueDate), days), $inc: { postponedCount: 1 } });
}

/** Vista calendario: vencimientos del mes agrupados por día. */
export async function calendarMonth(userId: string, month: string, today = todayAr()) {
  await syncOccurrences(userId, today);
  const [y, m] = month.split("-").map(Number);
  const from = dateOnly(y, m, 1);
  const to = dateOnly(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);
  const occs = await CommitmentOccurrence.find({ userId, dueDate: { $gte: from, $lt: to } }).lean<ICommitmentOccurrence[]>();
  const cs = await Commitment.find({ userId, _id: { $in: occs.map((o) => o.commitmentId) } }).select("name").lean<{ _id: string; name: string }[]>();
  const names = new Map(cs.map((c) => [String(c._id), c.name]));
  const byDay: Record<string, { name: string; status: string }[]> = {};
  for (const o of occs) {
    const k = new Date(o.dueDate).toISOString().slice(0, 10);
    (byDay[k] ??= []).push({ name: names.get(String(o.commitmentId)) ?? "?", status: o.status });
  }
  return byDay;
}
