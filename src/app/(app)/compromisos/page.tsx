import Link from "next/link";
import { seedPlanCommitmentsAction } from "@/app/actions/commitments";
import { Button } from "@/components/ui/button";
import { UpcomingList } from "@/components/app/upcoming-list";
import { MonthNav } from "@/components/app/month-nav";
import { Badge } from "@/components/ui/badge";
import { monthKey, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calendarMonth, listCommitments, upcoming } from "@/server/services/commitments";
import { requireUserId } from "@/server/session";

const FREQ = { once: "única", weekly: "semanal", monthly: "mensual" } as const;

export default async function CompromisosPage(props: PageProps<"/compromisos">) {
  const userId = await requireUserId();
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const month = /^\d{4}-\d{2}$/.test(one(sp.month) ?? "") ? one(sp.month)! : monthKey(todayAr());
  const tab = one(sp.tab) === "fin" ? "fin" : "act";
  const [up, list, cal] = await Promise.all([upcoming(userId, 30), listCommitments(userId), calendarMonth(userId, month)]);
  const shown = list.filter((c) => (tab === "fin" ? c.finished : !c.finished));

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Compromisos</h1>
        <Link href="/compromisos/nuevo" className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">+ Nuevo</Link>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Próximos 30 días</h2>
        <UpcomingList items={up} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Calendario</h2>
        <MonthNav month={month} base="/compromisos" />
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => <span key={i} className="text-muted-foreground">{d}</span>)}
          {cells.map((d, i) => {
            const k = d ? `${month}-${String(d).padStart(2, "0")}` : "";
            const ev = d ? cal[k] : undefined;
            return (
              <div key={i} className={`flex h-10 flex-col items-center justify-center rounded ${ev ? "bg-primary/10" : ""}`} title={ev?.map((e) => e.name).join(", ")}>
                <span>{d}</span>
                {ev && <span className={`size-1.5 rounded-full ${ev.every((e) => e.status !== "pending") ? "bg-green-500" : "bg-primary"}`} />}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex gap-2 text-sm">
          <Link href="/compromisos?tab=act" className={`rounded-full border px-3 py-1 ${tab === "act" ? "bg-primary text-primary-foreground" : ""}`}>Activos</Link>
          <Link href="/compromisos?tab=fin" className={`rounded-full border px-3 py-1 ${tab === "fin" ? "bg-primary text-primary-foreground" : ""}`}>Finalizados</Link>
        </div>
        <ul className="space-y-2">
          {shown.map((c) => (
            <li key={c._id}>
              <Link href={`/compromisos/${c._id}`} className="block rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name} {c.gcalSync && <span title="Google Calendar">📆</span>}</span>
                  <span className="font-semibold">{formatMoney(c.amountCents, c.currency)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {FREQ[c.frequency]}{c.dayOfMonth ? ` · día ${c.dayOfMonth}` : ""}
                  {c.remainingCount != null && ` · quedan ${c.remainingCount} × ${formatMoney(c.amountCents, c.currency)} = ${formatMoney(c.remainingCents ?? 0, c.currency)}`}
                </p>
                {c.gcalError && <Badge variant="destructive">Calendar: {c.gcalError}</Badge>}
              </Link>
            </li>
          ))}
          {shown.length === 0 && <li className="py-4 text-center text-muted-foreground">Nada por acá.</li>}
        </ul>
        {list.length === 0 && (
          <form action={seedPlanCommitmentsAction}><Button type="submit" variant="outline" className="w-full">Cargar sueldo y transferencias del plan</Button></form>
        )}
      </section>
    </div>
  );
}
