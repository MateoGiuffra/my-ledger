import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { monthReport } from "@/server/services/reports";
import { PALETTE } from "@/lib/palette";
import { DonutChart } from "./charts";

type Report = Awaited<ReturnType<typeof monthReport>>;

export function SummaryCard({ r }: { r: Report }) {
  const used = r.budgetCents > 0 ? Math.min(100, Math.round((r.expenseCents / r.budgetCents) * 100)) : 0;
  return (
    <Card>
      <div className="grid grid-cols-3 gap-2 px-4 text-center">
        <div><p className="text-xs text-muted-foreground">Ingresos</p><p className="font-semibold text-green-600">{formatMoney(r.incomeCents)}</p></div>
        <div><p className="text-xs text-muted-foreground">Gastos</p><p className="font-semibold text-red-600">{formatMoney(r.expenseCents)}</p></div>
        <div><p className="text-xs text-muted-foreground">Ahorro</p><p className="font-semibold">{formatMoney(r.savingsCents)}</p></div>
      </div>
      <div className="space-y-1 px-4">
        <div className="flex justify-between text-xs"><span>Libre vs {formatMoney(r.budgetCents)}</span><span className={r.freeCents < 0 ? "text-red-600" : ""}>{formatMoney(r.freeCents)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${used >= 100 ? "bg-red-500" : used >= 80 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${used}%` }} />
        </div>
      </div>
    </Card>
  );
}

export function CategoryBreakdown({ r, limit }: { r: Report; limit?: number }) {
  const rows = limit ? r.byCategory.slice(0, limit) : r.byCategory;
  return (
    <div className="space-y-2">
      <DonutChart data={r.byCategory.map((c) => ({ name: c.name, value: c.totalCents }))} />
      <ul className="space-y-1">
        {rows.map((c, i) => (
          <li key={c.name}>
            <Link
              href={`/movimientos?month=${r.month}&type=expense${c.categoryId ? `&categoryId=${c.categoryId}` : ""}`}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.name}</span>
              <span className="font-medium">{formatMoney(c.totalCents)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
