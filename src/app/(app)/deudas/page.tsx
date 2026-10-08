import Link from "next/link";
import { createPersonAction } from "@/app/actions/debts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { overview } from "@/server/services/debts";
import { requireUserId } from "@/server/session";

export default async function DeudasPage() {
  const o = await overview(await requireUserId());
  return (
    <div className="space-y-4">
      <Card className="items-center text-center">
        <p className="text-sm text-muted-foreground">Me deben en total</p>
        <p className="text-3xl font-semibold">{formatMoney(o.totalCents)}</p>
      </Card>
      <ul className="space-y-2">
        {o.people.map((p) => (
          <li key={p._id}>
            <Link href={`/deudas/${p._id}`} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.lastEntryDate ? `Último mov.: ${formatDate(new Date(p.lastEntryDate))}` : "Sin movimientos"}
                  {p.balanceCents > 0 && ` · ${p.ageDays} días sin pagos`}
                </p>
              </div>
              <span className={`text-lg font-semibold ${p.balanceCents > 0 ? "" : "text-muted-foreground"}`}>{formatMoney(p.balanceCents)}</span>
            </Link>
          </li>
        ))}
        {o.people.length === 0 && <li className="py-6 text-center text-muted-foreground">Todavía no cargaste personas.</li>}
      </ul>
      <form action={createPersonAction} className="flex gap-2">
        <Input name="name" placeholder="Nueva persona" required maxLength={80} />
        <Button type="submit">Agregar</Button>
      </form>
    </div>
  );
}
