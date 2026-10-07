import { format } from "date-fns";

export const TZ = "America/Argentina/Buenos_Aires";

/** Fecha "calendario" → Date a mediodía UTC (evita corrimientos por zona horaria). */
export function dateOnly(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "DD-MM-YYYY" → Date (mediodía UTC) o null. */
export function parseDmy(s: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = dateOnly(Number(m[3]), Number(m[2]), Number(m[1]));
  return d.getUTCDate() === Number(m[1]) ? d : null;
}

/** Hoy en Buenos Aires como Date a mediodía UTC. */
export function todayAr(now = new Date()): Date {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now).split("-").map(Number);
  return dateOnly(p[0], p[1], p[2]);
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function monthRange(key: string): { from: Date; to: Date } {
  const [y, m] = key.split("-").map(Number);
  return { from: dateOnly(y, m, 1), to: dateOnly(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) };
}

export function formatDate(d: Date): string {
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), "dd/MM/yyyy");
}

export function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? dateOnly(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

