import { google } from "googleapis";
import { formatMoney } from "@/lib/money";
import { TZ } from "@/lib/dates";
import { decrypt, encrypt } from "../crypto";
import { User } from "../models/user";
import type { ICommitment } from "../models/commitment";
import { gcalRRule, occurrenceDates } from "../services/commitment-calc";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

/** Subconjunto de la API de Calendar que usamos (permite inyectar un fake en tests). */
export interface CalendarApi {
  insert(body: Record<string, unknown>): Promise<string | null>;
  patch(eventId: string, body: Record<string, unknown>): Promise<void>;
  remove(eventId: string): Promise<void>;
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

export function authUrl(state: string): string {
  return oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES, state });
}

/** Intercambia el code por tokens y los guarda cifrados (AES-GCM) en el usuario. */
export async function exchangeCode(userId: string, code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    const prev = await loadTokens(userId);
    if (!prev?.refresh_token) throw new Error("Google no devolvió refresh_token; revocá el acceso de la app y reconectá");
    tokens.refresh_token = prev.refresh_token;
  }
  await User.updateOne({ _id: userId }, { $set: { "googleTokens.enc": encrypt(JSON.stringify(tokens)) } });
}

async function loadTokens(userId: string): Promise<Record<string, unknown> & { refresh_token?: string } | null> {
  const u = await User.findById(userId).select("googleTokens").lean<{ googleTokens?: { enc?: string } }>();
  if (!u?.googleTokens?.enc) return null;
  return JSON.parse(decrypt(u.googleTokens.enc));
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const u = await User.findById(userId).select("googleTokens").lean<{ googleTokens?: { enc?: string } }>();
  return !!u?.googleTokens?.enc;
}

export async function disconnectGoogle(userId: string) {
  const tokens = await loadTokens(userId).catch(() => null);
  if (tokens?.refresh_token) await oauthClient().revokeToken(tokens.refresh_token).catch(() => {});
  await User.updateOne({ _id: userId }, { $unset: { googleTokens: "" } });
}

let factory: ((userId: string) => Promise<CalendarApi | null>) | null = null;
/** Solo para tests. */
export function setCalendarFactory(f: typeof factory) {
  factory = f;
}

export async function getCalendar(userId: string): Promise<CalendarApi | null> {
  if (factory) return factory(userId);
  const tokens = await loadTokens(userId);
  if (!tokens) return null;
  const auth = oauthClient();
  auth.setCredentials(tokens);
  auth.on("tokens", async (t) => {
    // el access_token se renueva solo: se persiste lo nuevo conservando el refresh_token
    const merged = { ...tokens, ...t };
    await User.updateOne({ _id: userId }, { $set: { "googleTokens.enc": encrypt(JSON.stringify(merged)) } });
  });
  const cal = google.calendar({ version: "v3", auth });
  return {
    async insert(requestBody) {
      const r = await cal.events.insert({ calendarId: "primary", requestBody });
      return r.data.id ?? null;
    },
    async patch(eventId, requestBody) {
      await cal.events.patch({ calendarId: "primary", eventId, requestBody });
    },
    async remove(eventId) {
      await cal.events.delete({ calendarId: "primary", eventId }).catch((e) => {
        if (e?.code !== 404 && e?.code !== 410) throw e;
      });
    },
  };
}

type EventSrc = Pick<ICommitment, "name" | "amountCents" | "currency" | "frequency" | "dayOfMonth" | "startDate" | "endDate" | "reminders">;

/** Cuerpo del evento: a las `hour` hs (Buenos Aires), con RRULE (UNTIL) y recordatorios popup. */
export function buildEventBody(c: EventSrc, hour = 9) {
  const first = occurrenceDates(c, new Date(c.startDate), new Date(Date.UTC(2100, 0, 1)))[0] ?? new Date(c.startDate);
  const day = first.toISOString().slice(0, 10);
  const hh = String(hour).padStart(2, "0");
  const endHh = String(Math.min(23, hour + 1)).padStart(2, "0");
  const rrule = gcalRRule(c);
  return {
    summary: `💸 ${c.name} · ${formatMoney(c.amountCents, c.currency)}`,
    description: "Compromiso de My Ledger. Marcar como pagado desde la app.",
    start: { dateTime: `${day}T${hh}:00:00`, timeZone: TZ },
    end: { dateTime: `${day}T${endHh}:00:00`, timeZone: TZ },
    ...(rrule ? { recurrence: [rrule] } : {}),
    reminders: {
      useDefault: false,
      overrides: [...new Set(c.reminders)].slice(0, 5).map((d) => ({ method: "popup", minutes: d * 1440 })),
    },
  };
}

/** Crea o actualiza el evento. Devuelve el id (o null si Google no está conectado). */
export async function upsertEvent(userId: string, c: EventSrc & { gcalEventId?: string | null }, hour = 9): Promise<string | null> {
  const cal = await getCalendar(userId);
  if (!cal) return null;
  const body = buildEventBody(c, hour);
  if (c.gcalEventId) {
    await cal.patch(c.gcalEventId, body);
    return c.gcalEventId;
  }
  return cal.insert(body);
}

export async function removeEvent(userId: string, eventId: string) {
  const cal = await getCalendar(userId);
  if (cal) await cal.remove(eventId);
}
