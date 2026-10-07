import { monthKey, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { sendPush } from "../integrations/push";
import { Alert, Commitment, CommitmentOccurrence, type IAlert, type ICommitment, type ICommitmentOccurrence } from "../models/commitment";
import { plain } from "../models/helpers";
import { SavingsEntry } from "../models/savings";
import { User } from "../models/user";
import { overview } from "./debts";
import { syncOccurrences } from "./commitments";
import { prevMonth } from "./report-calc";

export const ALERT_TYPES = ["commitment", "savings", "payday", "debt"] as const;
const TZ_OFFSET_HOURS = 3; // Buenos Aires = UTC-3 (sin horario de verano)

interface Prefs {
  types: string[];
  hour: number;
}

export async function getPrefs(userId: string): Promise<Prefs> {
  const u = await User.findById(userId).select("alertPrefs").lean<{ alertPrefs?: Partial<Prefs> }>();
  return { types: u?.alertPrefs?.types ?? [...ALERT_TYPES], hour: u?.alertPrefs?.hour ?? 9 };
}

export async function setPrefs(userId: string, p: Prefs) {
  const hour = Math.min(23, Math.max(0, Math.round(p.hour)));
  await User.updateOne({ _id: userId }, { $set: { "alertPrefs.types": p.types.filter((t) => (ALERT_TYPES as readonly string[]).includes(t)), "alertPrefs.hour": hour } });
}

/** Momento (UTC) en que se dispara una alerta: `day` (mediodía UTC del calendario) a las `hour` hs de Buenos Aires. */
export function fireAtFor(day: Date, hour: number): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + TZ_OFFSET_HOURS));
}

interface Draft {
  type: IAlert["type"];
  key: string;
  fireAt: Date;
  title: string;
  body: string;
  url: string;
  refType?: string;
  refId?: string;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Alertas que corresponden "ahora" (idempotentes por `key`). */
export async function buildDrafts(userId: string, now = new Date()): Promise<Draft[]> {
  const prefs = await getPrefs(userId);
  const today = todayAr(now);
  const drafts: Draft[] = [];

  // Vencimientos y cobros: 3 días, 1 día y el día (según los recordatorios del compromiso)
  if (prefs.types.includes("commitment") || prefs.types.includes("payday")) {
    await syncOccurrences(userId, today);
    const occs = await CommitmentOccurrence.find({ userId, status: "pending", dueDate: { $lte: addDays(today, 4) } }).lean<ICommitmentOccurrence[]>();
    const cs = await Commitment.find({ userId, deletedAt: null, _id: { $in: occs.map((o) => o.commitmentId) } }).lean<ICommitment[]>();
    const byId = new Map(cs.map((c) => [String(c._id), c]));
    for (const o of occs) {
      const c = byId.get(String(o.commitmentId));
      if (!c) continue;
      const type = c.kind === "income" ? "payday" : "commitment";
      if (!prefs.types.includes(type)) continue;
      for (const d of c.reminders) {
        const fireAt = fireAtFor(addDays(new Date(o.dueDate), -d), prefs.hour);
        const when = d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`;
        drafts.push({
          type,
          key: `occ:${o._id}:${d}:${new Date(o.dueDate).toISOString().slice(0, 10)}`,
          fireAt,
          title: c.kind === "income" ? `Cobro ${when}: ${c.name}` : `Vence ${when}: ${c.name}`,
          body: formatMoney(c.amountCents, c.currency),
          url: "/compromisos",
          refType: "occurrence",
          refId: String(o._id),
        });
      }
    }
  }

  // Checklist de ahorro: si el mes anterior quedó incompleto (a partir del día 1 a la hora configurada)
  if (prefs.types.includes("savings")) {
    const prev = prevMonth(monthKey(today));
    const done = await SavingsEntry.countDocuments({ userId, month: prev, done: true });
    const hadAny = await SavingsEntry.countDocuments({ userId, month: prev });
    if (hadAny > 0 && done < 3) {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
      drafts.push({ type: "savings", key: `savings:${prev}`, fireAt: fireAtFor(first, prefs.hour), title: `Plan de ahorro de ${prev} incompleto`, body: `Completaste ${done} de 3 ítems`, url: "/plan" });
    }
    // recordatorio del checklist del mes actual el día 25 si no está completo
    const cur = monthKey(today);
    const curDone = await SavingsEntry.countDocuments({ userId, month: cur, done: true });
    if (curDone < 3) {
      drafts.push({ type: "savings", key: `savings-eom:${cur}`, fireAt: fireAtFor(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 25, 12)), prefs.hour), title: "Falta completar el plan de ahorro del mes", body: `Hechos: ${curDone} de 3`, url: "/plan" });
    }
  }

  // Deudas sin pagos hace 30+ días: un recordatorio por mes y persona
  if (prefs.types.includes("debt")) {
    const o = await overview(userId, today);
    for (const p of o.people) {
      if (p.balanceCents > 0 && p.ageDays >= 30) {
        drafts.push({ type: "debt", key: `debt:${p._id}:${monthKey(today)}`, fireAt: fireAtFor(today, prefs.hour), title: `${p.name} te debe ${formatMoney(p.balanceCents)}`, body: `Hace ${p.ageDays} días sin pagos`, url: `/deudas/${p._id}`, refType: "person", refId: p._id });
      }
    }
  }
  return drafts;
}

/** Crea las alertas que ya corresponden (fireAt <= ahora) sin duplicar. Devuelve cuántas nuevas. */
export async function generateAlerts(userId: string, now = new Date()): Promise<number> {
  const drafts = (await buildDrafts(userId, now)).filter((d) => d.fireAt <= now);
  let n = 0;
  for (const d of drafts) {
    const r = await Alert.updateOne({ userId, key: d.key }, { $setOnInsert: { userId, ...d } }, { upsert: true });
    if (r.upsertedCount) n++;
  }
  return n;
}

/** Envía por push las alertas pendientes de envío. Se "reclama" cada una antes de mandarla para no duplicar. */
export async function deliverAlerts(userId: string, now = new Date()): Promise<number> {
  const pending = await Alert.find({ userId, sentAt: null, fireAt: { $lte: now }, readAt: null }).sort({ fireAt: 1 }).limit(20).lean<IAlert[]>();
  let sent = 0;
  for (const a of pending) {
    const claim = await Alert.updateOne({ _id: a._id, sentAt: null }, { sentAt: now });
    if (claim.modifiedCount !== 1) continue;
    sent += await sendPush(userId, { title: a.title, body: a.body, url: a.url });
  }
  return sent;
}

/** Corrida del cron para todos los usuarios. */
export async function runAlertsForAll(now = new Date()) {
  const users = await User.find().select("_id").lean<{ _id: string }[]>();
  let created = 0;
  let pushed = 0;
  for (const u of users) {
    const id = String(u._id);
    created += await generateAlerts(id, now);
    pushed += await deliverAlerts(id, now);
  }
  return { users: users.length, created, pushed };
}

const lastRefresh = new Map<string, number>();
/** Genera alertas "lazy" al navegar, como máximo cada 5 minutos por usuario. */
export async function refreshAlertsThrottled(userId: string) {
  const t = lastRefresh.get(userId) ?? 0;
  if (Date.now() - t < 5 * 60 * 1000) return;
  lastRefresh.set(userId, Date.now());
  await generateAlerts(userId).catch(() => {});
}

export async function listAlerts(userId: string, onlyPending: boolean, now = new Date()) {
  return plain(await Alert.find({ userId, fireAt: { $lte: now }, ...(onlyPending ? { readAt: null } : {}) }).sort({ fireAt: -1 }).limit(100).lean<IAlert[]>());
}

export async function unreadCount(userId: string, now = new Date()) {
  return Alert.countDocuments({ userId, fireAt: { $lte: now }, readAt: null });
}

export async function markRead(userId: string, id: string) {
  await Alert.updateOne({ _id: id, userId, readAt: null }, { readAt: new Date() });
}

export async function markAllRead(userId: string) {
  await Alert.updateMany({ userId, readAt: null }, { readAt: new Date() });
}

