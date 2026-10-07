import Link from "next/link";
import { lastMonths } from "@/server/services/report-calc";

const fmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

export function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

export function MonthNav({ month, base }: { month: string; base: string }) {
  const prev = lastMonths(month, 2)[0];
  return (
    <div className="flex items-center justify-between">
      <Link href={`${base}?month=${prev}`} aria-label="Mes anterior" className="px-3 py-1 text-lg">←</Link>
      <span className="font-medium capitalize">{fmt.format(new Date(month + "-01T12:00:00Z"))}</span>
      <Link href={`${base}?month=${nextMonth(month)}`} aria-label="Mes siguiente" className="px-3 py-1 text-lg">→</Link>
    </div>
  );
}
