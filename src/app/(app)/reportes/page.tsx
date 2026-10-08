import { CategoryBreakdown, SummaryCard } from "@/components/app/month-summary";
import { MonthlyBars } from "@/components/app/charts";
import { MonthNav } from "@/components/app/month-nav";
import { monthKey, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { evolution, monthReport } from "@/server/services/reports";
import { requireUserId } from "@/server/session";

export default async function ReportesPage(props: PageProps<"/reportes">) {
  const userId = await requireUserId();
  const sp = await props.searchParams;
  const m = Array.isArray(sp.month) ? sp.month[0] : sp.month;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(todayAr());
  const [r, evo] = await Promise.all([monthReport(userId, month), evolution(userId, month, 6)]);
  const delta = r.expenseChangePct;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">En qué se va la plata</h1>
      <MonthNav month={month} base="/reportes" />
      <SummaryCard r={r} />
      <p className="text-sm text-muted-foreground">
        {delta == null ? "Sin mes anterior para comparar." : `Gastos ${delta >= 0 ? "+" : ""}${delta}% vs ${r.prev.month} (${formatMoney(r.prev.expenseCents)}).`}
      </p>

      <section className="space-y-2">
        <h2 className="font-medium">Por categoría</h2>
        <CategoryBreakdown r={r} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Top comercios</h2>
        <ol className="space-y-1 text-sm">
          {r.topMerchants.map((t, i) => (
            <li key={t.name} className="flex justify-between rounded-lg border p-2"><span>{i + 1}. {t.name}</span><span className="font-medium">{formatMoney(t.totalCents)}</span></li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Evolución</h2>
        <MonthlyBars data={evo.map((e) => ({ month: e.month, ingresos: e.incomeCents, gastos: e.expenseCents }))} />
      </section>

      <section className="rounded-lg border p-3 text-sm">
        <p>Gasto diario promedio: <b>{formatMoney(r.avgPerDayCents)}</b></p>
        <p>Proyección a fin de mes: <b>{formatMoney(r.projectedCents)}</b> ({r.elapsed}/{r.daysInMonth} días)</p>
      </section>
    </div>
  );
}
