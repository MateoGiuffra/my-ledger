import Link from "next/link";
import { CategoryBreakdown, SummaryCard } from "@/components/app/month-summary";
import { monthKey, todayAr } from "@/lib/dates";
import { monthReport } from "@/server/services/reports";
import { requireUserId } from "@/server/session";

export default async function InicioPage() {
  const userId = await requireUserId();
  const month = monthKey(todayAr());
  const r = await monthReport(userId, month);
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
    </div>
  );
}
