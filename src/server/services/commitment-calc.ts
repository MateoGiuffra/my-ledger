import { RRule } from "rrule";
import { dateOnly } from "@/lib/dates";
import type { ICommitment } from "../models/commitment";

type Sched = Pick<ICommitment, "frequency" | "dayOfMonth" | "startDate" | "endDate">;

const noon = (d: Date) => dateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

function rule(c: Sched): RRule | null {
  const start = noon(new Date(c.startDate));
  const until = c.endDate ? noon(new Date(c.endDate)) : undefined;
  if (c.frequency === "monthly") {
    const day = Math.min(28, Math.max(1, c.dayOfMonth ?? start.getUTCDate()));
    return new RRule({ freq: RRule.MONTHLY, bymonthday: day, dtstart: start, until });
  }
  if (c.frequency === "weekly") {
    const wd = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA][start.getUTCDay()];
    return new RRule({ freq: RRule.WEEKLY, byweekday: wd, dtstart: start, until });
  }
  return null;
}

/** Fechas (mediodía UTC) en las que vence el compromiso dentro de [from, to]. */
export function occurrenceDates(c: Sched, from: Date, to: Date): Date[] {
  const start = noon(new Date(c.startDate));
  const r = rule(c);
  if (!r) return start >= from && start <= to ? [start] : [];
  return r.between(from, to, true).map(noon);
}

/** Todas las fechas hasta endDate (solo si tiene fin). */
export function allDates(c: Sched): Date[] | null {
  if (c.frequency === "once") return [noon(new Date(c.startDate))];
  if (!c.endDate) return null;
  return occurrenceDates(c, noon(new Date(c.startDate)), noon(new Date(c.endDate)));
}

/** RRULE para Google Calendar (evento con hora, UNTIL en UTC). */
export function gcalRRule(c: Sched): string | null {
  if (c.frequency === "once") return null;
  const start = noon(new Date(c.startDate));
  const base =
    c.frequency === "monthly"
      ? `FREQ=MONTHLY;BYMONTHDAY=${Math.min(28, Math.max(1, c.dayOfMonth ?? start.getUTCDate()))}`
      : `FREQ=WEEKLY;BYDAY=${["SU", "MO", "TU", "WE", "TH", "FR", "SA"][start.getUTCDay()]}`;
  if (!c.endDate) return `RRULE:${base}`;
  const e = noon(new Date(c.endDate));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `RRULE:${base};UNTIL=${e.getUTCFullYear()}${pad(e.getUTCMonth() + 1)}${pad(e.getUTCDate())}T235959Z`;
}

/** "Quedan N cuotas × monto = total": ocurrencias desde hoy (inclusive) hasta el fin, menos las ya pagadas/salteadas. */
export function remaining(c: Sched & { amountCents: number }, today: Date, doneBaseDates: Set<string> = new Set()) {
  const dates = allDates(c);
  if (!dates) return { count: null as number | null, totalCents: null as number | null };
  const left = dates.filter((d) => !doneBaseDates.has(d.toISOString().slice(0, 10)) && d >= today);
  return { count: left.length, totalCents: left.length * c.amountCents };
}
