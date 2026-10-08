import Link from "next/link";
import { notFound } from "next/navigation";
import { voidDebtEntryAction } from "@/app/actions/debts";
import { CopyButton } from "@/components/app/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getPerson, KIND_LABEL, statementText, timeline } from "@/server/services/debts";
import { requireUserId } from "@/server/session";

const actions = [
  ["loan", "Le presté"],
  ["payment", "Pagó"],
  ["offset", "Compensé"],
  ["paid_for", "Gasto a su cargo"],
  ["adjustment", "Ajuste"],
] as const;

export default async function PersonaDeudaPage(props: PageProps<"/deudas/[id]">) {
  const userId = await requireUserId();
  const { id } = await props.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const person = await getPerson(userId, id);
  if (!person) notFound();
  const t = await timeline(userId, id);
  const text = statementText(person.name, t.rows);
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{person.name} me debe</p>
        <p className="text-4xl font-semibold">{formatMoney(t.balanceCents)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(([k, l]) => (
          <Link key={k} href={`/deudas/${id}/nuevo?kind=${k}`} className="rounded-lg border p-2 text-center text-sm font-medium">{l}</Link>
        ))}
        <CopyButton text={text} />
      </div>

      <ol className="space-y-2">
        {[...t.rows].reverse().map((r) => (
          <li key={r._id} className={`rounded-lg border p-3 ${r.voidedAt ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`font-medium ${r.voidedAt ? "line-through" : ""}`}>{r.reason}</p>
                <p className="text-xs text-muted-foreground">{formatDate(new Date(r.date))} · {KIND_LABEL[r.kind]}</p>
                {r.items?.map((i) => (
                  <p key={i.label} className="text-xs text-muted-foreground">· {i.label}: {formatMoney(i.amountCents)}</p>
                ))}
              </div>
              <div className="text-right">
                <p className={`font-semibold ${r.amountCents > 0 ? "text-red-600" : "text-green-600"} ${r.voidedAt ? "line-through" : ""}`}>
                  {r.amountCents > 0 ? "+" : "−"}{formatMoney(Math.abs(r.amountCents))}
                </p>
                <p className="text-xs text-muted-foreground">saldo {formatMoney(r.balanceAfterCents)}</p>
              </div>
            </div>
            {r.voidedAt ? (
              <p className="pt-1 text-xs text-destructive">Anulado: {r.voidReason}</p>
            ) : (
              <details className="pt-1 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Anular</summary>
                <form action={voidDebtEntryAction} className="flex gap-2 pt-2">
                  <input type="hidden" name="id" value={r._id} />
                  <input type="hidden" name="personId" value={id} />
                  <Input name="reason" placeholder="Motivo de anulación" required />
                  <Button size="sm" variant="destructive" type="submit">Anular</Button>
                </form>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
