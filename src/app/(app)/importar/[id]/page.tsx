import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignCounterpartyAction,
  commitImportAction,
  createRuleFromMerchantAction,
  discardImportAction,
  rollbackImportAction,
  setYieldsAction,
} from "@/app/actions/imports";
import { RowCategorySelect } from "@/components/app/row-category-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listCategories } from "@/server/services/catalog";
import { listCounterparties } from "@/server/services/counterparties";
import { listPersons } from "@/server/services/debts";
import { analyzeBatch, getBatch } from "@/server/services/imports";
import { requireUserId } from "@/server/session";

const FILTERS = [
  ["new", "Nuevas"],
  ["uncat", "Sin categoría"],
  ["duplicate", "Duplicadas"],
  ["ignored", "Ignoradas"],
  ["all", "Todas"],
] as const;

const SELECT = "h-8 w-full rounded-lg border bg-transparent px-2 text-sm";

export default async function RevisionPage(props: PageProps<"/importar/[id]">) {
  const userId = await requireUserId();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const batch = await getBatch(userId, id);
  if (!batch || batch.status === "discarded") notFound();

  if (batch.status !== "preview") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{batch.fileName}</h1>
        <div className="rounded-lg border p-4 text-center">
          <p className="text-3xl font-semibold">{batch.inserted}</p>
          <p className="text-sm text-muted-foreground">importados · {batch.skipped} omitidos {batch.status === "rolled_back" && "· (deshecho)"}</p>
        </div>
        {batch.status === "committed" && (
          <form action={rollbackImportAction}>
            <input type="hidden" name="batchId" value={id} />
            <Button variant="destructive" type="submit" className="h-10 w-full">Deshacer importación</Button>
          </form>
        )}
        <Link href="/movimientos" className="block text-center text-sm underline">Ver movimientos</Link>
      </div>
    );
  }

  const [analysis, cats, cps, persons] = await Promise.all([analyzeBatch(userId, batch), listCategories(userId), listCounterparties(userId), listPersons(userId)]);
  const f = (Array.isArray(sp.filter) ? sp.filter[0] : sp.filter) ?? "new";
  const catName = new Map(cats.map((c) => [c._id, c.name]));
  const rows = analysis.rows.filter((r) =>
    f === "all" ? true : f === "duplicate" ? r.status === "duplicate" : f === "ignored" ? r.status === "ignored" : f === "uncat" ? r.status === "new" && !r.categoryId && r.type !== "transfer" : r.status === "new",
  );
  const v = batch.validation;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Revisar importación</h1>
      <p className="truncate text-sm text-muted-foreground">{batch.fileName}</p>

      <div className={`rounded-lg border p-3 text-sm ${v?.ok ? "border-green-500/40 bg-green-500/10" : "border-red-500/40 bg-red-500/10"}`}>
        {v?.ok ? (
          <p>✓ Validación OK: saldo inicial + movimientos = saldo final ({formatMoney(v.computedFinalCents)}).</p>
        ) : (
          <>
            <p className="font-medium">⚠ El extracto no cuadra</p>
            <ul className="list-disc pl-5">{v?.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            {v && <p>Esperado {formatMoney(v.expectedFinalCents)} · calculado {formatMoney(v.computedFinalCents)}</p>}
          </>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{analysis.counts.new}</p>nuevas</div>
        <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{analysis.counts.duplicate}</p>duplicadas</div>
        <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{analysis.counts.ignored}</p>ignoradas</div>
        <div className="rounded-lg border p-2"><p className="text-lg font-semibold">{analysis.counts.uncategorized}</p>sin categ.</div>
      </div>

      <form action={setYieldsAction} className="flex items-center justify-between rounded-lg border p-3 text-sm">
        <input type="hidden" name="batchId" value={id} />
        <span>Rendimientos:</span>
        <select name="yields" defaultValue={batch.options?.yields ?? "ignore"} className="h-8 rounded-lg border bg-transparent px-2">
          <option value="ignore">Ignorar</option>
          <option value="income">Importar como ingreso</option>
        </select>
        <Button size="sm" type="submit" variant="outline">Aplicar</Button>
      </form>

      {analysis.unassigned.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Transferencias sin contraparte ({analysis.unassigned.length})</h2>
          <p className="text-xs text-muted-foreground">Asignás una vez y se aplica a todas las del lote y a las futuras.</p>
          {analysis.unassigned.map((g) => (
            <details key={g.name} className="rounded-lg border p-3">
              <summary className="flex cursor-pointer items-center justify-between text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground">{g.count} · {formatMoney(g.totalCents)}</span>
              </summary>
              <div className="space-y-3 pt-3">
                {cps.length > 0 && (
                  <form action={assignCounterpartyAction} className="flex gap-2">
                    <input type="hidden" name="batchId" value={id} />
                    <input type="hidden" name="name" value={g.name} />
                    <select name="counterpartyId" required className={SELECT} aria-label="Contraparte existente">
                      <option value="">Elegir existente…</option>
                      {cps.map((c) => <option key={c._id} value={c._id}>{c.displayName}</option>)}
                    </select>
                    <Button size="sm" type="submit">Asignar</Button>
                  </form>
                )}
                <form action={assignCounterpartyAction} className="space-y-2">
                  <input type="hidden" name="batchId" value={id} />
                  <input type="hidden" name="name" value={g.name} />
                  <Input name="displayName" placeholder={`Nombre visible (ej. ${g.name.split(" ")[0]} · Peluquería)`} />
                  <select name="categoryId" className={SELECT} aria-label="Categoría por defecto">
                    <option value="">Sin categoría</option>
                    {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                  <select name="mode" className={SELECT} aria-label="Modo">
                    <option value="normal">Normal (gasto/ingreso)</option>
                    <option value="transfer">Transferencia propia (no es gasto)</option>
                    <option value="debt">Deuda (genera movimiento en Deudas)</option>
                  </select>
                  <select name="debtPersonId" className={SELECT} aria-label="Persona de deuda">
                    <option value="">Persona de deuda (solo modo deuda)</option>
                    {persons.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <Button size="sm" type="submit" className="w-full">Crear contraparte y asignar</Button>
                </form>
              </div>
            </details>
          ))}
        </section>
      )}

      {analysis.merchants.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Comercios sin categoría ({analysis.merchants.length})</h2>
          {analysis.merchants.map((g) => (
            <form key={g.name} action={createRuleFromMerchantAction} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
              <input type="hidden" name="batchId" value={id} />
              <input type="hidden" name="pattern" value={g.name} />
              <span className="min-w-0 flex-1 truncate">{g.name} <span className="text-xs text-muted-foreground">×{g.count}</span></span>
              <select name="categoryId" required className="h-8 w-32 rounded-lg border bg-transparent px-1 text-xs" aria-label="Categoría">
                <option value="">Regla →</option>
                {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <Button size="sm" type="submit">Crear regla</Button>
            </form>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([k, l]) => (
            <Link key={k} href={`/importar/${id}?filter=${k}`} className={`rounded-full border px-3 py-1 text-xs ${f === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</Link>
          ))}
        </div>
        <ul className="divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.row.index} className="space-y-1 p-2">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{r.merchant}</span>
                <span className={r.row.amountCents < 0 ? "" : "text-green-600"}>{formatMoney(r.row.amountCents)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatDate(new Date(r.row.date + "T12:00:00Z"))} · {r.row.rawType.slice(0, 28)}</span>
                {r.status === "new" && r.type !== "transfer" ? (
                  <RowCategorySelect batchId={id} rowKey={r.row.referenceId} value={r.categoryId} categories={cats} />
                ) : (
                  <Badge variant="secondary">{r.note ?? r.status}</Badge>
                )}
              </div>
              {r.categorySource && r.status === "new" && <p className="text-[10px] text-muted-foreground">{catName.get(r.categoryId ?? "")} · por {r.categorySource === "counterparty" ? "contraparte" : r.categorySource === "rule" ? "regla" : "tu selección"}{r.debt ? " · genera movimiento en Deudas" : ""}</p>}
            </li>
          ))}
          {rows.length === 0 && <li className="p-4 text-center text-muted-foreground">Nada en este filtro.</li>}
        </ul>
      </section>

      <div className="sticky bottom-20 flex gap-2 bg-background/90 py-2 backdrop-blur">
        <form action={discardImportAction} className="flex-1">
          <input type="hidden" name="batchId" value={id} />
          <Button variant="outline" type="submit" className="h-11 w-full">Descartar</Button>
        </form>
        <form action={commitImportAction} className="flex-[2]">
          <input type="hidden" name="batchId" value={id} />
          <Button type="submit" className="h-11 w-full" disabled={analysis.counts.new === 0}>Confirmar {analysis.counts.new} movimientos</Button>
        </form>
      </div>
    </div>
  );
}
