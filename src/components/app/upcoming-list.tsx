import { payOccurrenceAction, postponeOccurrenceAction, skipOccurrenceAction } from "@/app/actions/commitments";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { UpcomingItem } from "@/server/services/commitments";

export function UpcomingList({ items, compact = false }: { items: UpcomingItem[]; compact?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Sin vencimientos próximos.</p>;
  return (
    <ul className="space-y-2">
      {items.map((o) => (
        <li key={o._id} className={`rounded-lg border p-3 ${o.overdue ? "border-red-500/50" : ""}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{o.name}</p>
              <p className={`text-xs ${o.overdue ? "text-red-600" : "text-muted-foreground"}`}>{o.overdue ? "Vencido · " : ""}{formatDate(new Date(o.dueDate + "T12:00:00Z"))}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatMoney(o.amountCents, o.currency)}</span>
              <form action={payOccurrenceAction}><input type="hidden" name="id" value={o._id} /><Button size="sm" type="submit">Pagado</Button></form>
            </div>
          </div>
          {!compact && (
            <div className="flex gap-2 pt-2">
              <form action={skipOccurrenceAction}><input type="hidden" name="id" value={o._id} /><Button size="xs" variant="outline" type="submit">Saltar</Button></form>
              <form action={postponeOccurrenceAction}><input type="hidden" name="id" value={o._id} /><Button size="xs" variant="outline" type="submit">Postergar 7 días</Button></form>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
