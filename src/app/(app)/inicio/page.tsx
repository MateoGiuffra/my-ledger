import Link from "next/link";
import { CategoryBreakdown, SummaryCard } from "@/components/app/month-summary";
import { monthKey, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { UpcomingList } from "@/components/app/upcoming-list";
import { upcoming } from "@/server/services/commitments";
import { overview } from "@/server/services/debts";
import { monthReport } from "@/server/services/reports";
import { requireUserId } from "@/server/session";

export default async function InicioPage() {
  const userId = await requireUserId();
  const month = monthKey(todayAr());
  const [r, debts, due] = await Promise.all([monthReport(userId, month), overview(userId), upcoming(userId, 30)]);
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Mes actual</h1>
        <SummaryCard r={r} />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="font-medium">En qué se va</h2><Link href="/reportes" className="text-sm underline">Ver más</Link></div>
        <CategoryBreakdown r={r} limit={5} />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="font-medium">Próximos vencimientos</h2><Link href="/compromisos" className="text-sm underline">Ver</Link></div>
        <UpcomingList items={due.slice(0, 3)} compact />
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="font-medium">Me deben</h2><Link href="/deudas" className="text-sm underline">Ver</Link></div>
        <p className="text-2xl font-semibold">{formatMoney(debts.totalCents)}</p>
        <ul className="space-y-1">
          {debts.people.filter((p) => p.balanceCents > 0).slice(0, 3).map((p) => (
            <li key={p._id}><Link href={`/deudas/${p._id}`} className="flex justify-between rounded-lg border p-2 text-sm"><span>{p.name}</span><span className="font-medium">{formatMoney(p.balanceCents)}</span></Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
