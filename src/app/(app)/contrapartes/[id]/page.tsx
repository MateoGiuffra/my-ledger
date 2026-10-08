import { notFound } from "next/navigation";
import {
  addIdentifierAction,
  applyToExistingAction,
  archiveCounterpartyAction,
  mergeCounterpartyAction,
  removeIdentifierAction,
  updateCounterpartyAction,
} from "@/app/actions/counterparties";
import { CounterpartyFields } from "@/components/app/counterparty-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listCategories } from "@/server/services/catalog";
import { counterpartyStats, getCounterparty, listCounterparties } from "@/server/services/counterparties";
import { listPersons } from "@/server/services/debts";
import { requireUserId } from "@/server/session";

export default async function ContraparteDetallePage(props: PageProps<"/contrapartes/[id]">) {
  const userId = await requireUserId();
  const { id } = await props.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const c = await getCounterparty(userId, id);
  if (!c) notFound();
  const [cats, persons, stats, all] = await Promise.all([listCategories(userId), listPersons(userId), counterpartyStats(userId, id), listCounterparties(userId)]);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{c.displayName}</h1>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg border p-2"><p className="font-semibold">{stats.count}</p>movs.</div>
        <div className="rounded-lg border p-2"><p className="font-semibold">{formatMoney(stats.spentCents)}</p>gastado</div>
        <div className="rounded-lg border p-2"><p className="font-semibold">{formatMoney(stats.receivedCents)}</p>recibido</div>
      </div>

      <form action={updateCounterpartyAction} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <CounterpartyFields cats={cats} persons={persons} d={c} />
        <Button type="submit" className="w-full">Guardar</Button>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">Identificadores</h2>
        <ul className="flex flex-wrap gap-2">
          {c.identifiers.map((i) => (
            <li key={i.normalized}>
              <form action={removeIdentifierAction} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="normalized" value={i.normalized} />
                <span><b>{i.kind}</b> {i.value}</span>
                <button type="submit" aria-label="Quitar" className="text-muted-foreground">✕</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addIdentifierAction} className="flex gap-2">
          <input type="hidden" name="id" value={id} />
          <select name="kind" className="h-8 rounded-lg border bg-transparent px-1 text-sm" aria-label="Tipo">
            <option value="mp_name">Nombre MP</option><option value="alias">Alias</option><option value="cbu">CBU</option><option value="cvu">CVU</option><option value="cuit">CUIT</option>
          </select>
          <Input name="value" placeholder="Valor" required />
          <Button type="submit" size="sm">Agregar</Button>
        </form>
      </section>

      <form action={applyToExistingAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" className="w-full">Aplicar a movimientos ya importados</Button>
      </form>

      <section className="space-y-1">
        <h2 className="font-medium">Historial</h2>
        <ul className="divide-y rounded-lg border text-sm">
          {stats.recent.map((t) => (
            <li key={t._id} className="flex justify-between p-2"><span>{formatDate(new Date(t.date))} · {t.merchant || t.rawDescription}</span><span>{t.type === "income" ? "+" : "−"}{formatMoney(t.amountCents, t.currency)}</span></li>
          ))}
          {stats.recent.length === 0 && <li className="p-3 text-center text-muted-foreground">Sin movimientos.</li>}
        </ul>
      </section>

      {all.length > 1 && (
        <form action={mergeCounterpartyAction} className="flex gap-2">
          <input type="hidden" name="id" value={id} />
          <select name="intoId" className="h-8 flex-1 rounded-lg border bg-transparent px-2 text-sm" aria-label="Fusionar con">
            {all.filter((x) => x._id !== id).map((x) => <option key={x._id} value={x._id}>{x.displayName}</option>)}
          </select>
          <Button type="submit" variant="outline" size="sm">Fusionar en…</Button>
        </form>
      )}
      <form action={archiveCounterpartyAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="destructive" className="w-full">Eliminar</Button>
      </form>
    </div>
  );
}
