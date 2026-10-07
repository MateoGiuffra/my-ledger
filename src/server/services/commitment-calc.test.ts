import { expect, test } from "vitest";
import { dateOnly } from "@/lib/dates";
import { allDates, gcalRRule, occurrenceDates, remaining } from "./commitment-calc";

const iso = (ds: Date[]) => ds.map((d) => d.toISOString().slice(0, 10));
// "tarjeta 35k, mensual día 10, hasta dic-2026"
const tarjeta = { frequency: "monthly" as const, dayOfMonth: 10, startDate: dateOnly(2026, 7, 10), endDate: dateOnly(2026, 12, 31), amountCents: 3500000 };

test("mensual con fin: fechas y 'quedan 3 × 35k = 105k'", () => {
  expect(iso(allDates(tarjeta)!)).toEqual(["2026-07-10", "2026-08-10", "2026-09-10", "2026-10-10", "2026-11-10", "2026-12-10"]);
  // hoy 11/10 → quedan nov, dic = 2; hoy 07/10 → oct, nov, dic = 3
  expect(remaining(tarjeta, dateOnly(2026, 10, 7))).toEqual({ count: 3, totalCents: 10500000 });
  expect(remaining(tarjeta, dateOnly(2026, 10, 11))).toEqual({ count: 2, totalCents: 7000000 });
  // ya pagada la de octubre
  expect(remaining(tarjeta, dateOnly(2026, 10, 7), new Set(["2026-10-10"])).count).toBe(2);
});

test("ventana de ocurrencias", () => {
  expect(iso(occurrenceDates(tarjeta, dateOnly(2026, 10, 1), dateOnly(2026, 11, 30)))).toEqual(["2026-10-10", "2026-11-10"]);
  expect(occurrenceDates(tarjeta, dateOnly(2027, 1, 1), dateOnly(2027, 3, 1))).toEqual([]);
});

test("semanal y única", () => {
  const w = { frequency: "weekly" as const, startDate: dateOnly(2026, 10, 5), endDate: dateOnly(2026, 10, 31) }; // lunes
  expect(iso(occurrenceDates(w, dateOnly(2026, 10, 1), dateOnly(2026, 10, 31)))).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  const once = { frequency: "once" as const, startDate: dateOnly(2026, 11, 3) };
  expect(iso(occurrenceDates(once, dateOnly(2026, 11, 1), dateOnly(2026, 11, 30)))).toEqual(["2026-11-03"]);
  expect(occurrenceDates(once, dateOnly(2026, 12, 1), dateOnly(2026, 12, 30))).toEqual([]);
});

test("sin fecha de fin no tiene total", () => {
  const open = { ...tarjeta, endDate: null };
  expect(allDates(open)).toBeNull();
  expect(remaining(open, dateOnly(2026, 10, 7))).toEqual({ count: null, totalCents: null });
  expect(iso(occurrenceDates(open, dateOnly(2026, 10, 1), dateOnly(2027, 1, 31)))).toHaveLength(4);
});

test("RRULE para Google Calendar con UNTIL", () => {
  expect(gcalRRule(tarjeta)).toBe("RRULE:FREQ=MONTHLY;BYMONTHDAY=10;UNTIL=20261231T235959Z");
  expect(gcalRRule({ ...tarjeta, endDate: null })).toBe("RRULE:FREQ=MONTHLY;BYMONTHDAY=10");
  expect(gcalRRule({ frequency: "weekly", startDate: dateOnly(2026, 10, 5), endDate: null })).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO");
  expect(gcalRRule({ frequency: "once", startDate: dateOnly(2026, 10, 5) })).toBeNull();
});
