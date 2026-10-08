import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { monthKey, todayAr } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { txFiltersSchema } from "@/lib/validators/transaction";
import { listAccounts, listCategories } from "@/server/services/catalog";
import { listTransactions } from "@/server/services/transactions";
import { requireUserId } from "@/server/session";

const dayFmt = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

export default async function MovimientosPage(props: PageProps<"/movimientos">) {
  const userId = await requireUserId();
  const raw = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== "" && v != null));
  const parsed = txFiltersSchema.safeParse(flat);
  const f = parsed.success ? parsed.data : txFiltersSchema.parse({});
  const month = "month" in flat ? f.month : monthKey(todayAr());
  const [res, cats, accs] = await Promise.all([
    listTransactions(userId, { month, categoryId: f.categoryId, accountId: f.accountId, type: f.type, q: f.q }, f.page),
    listCategories(userId),
    listAccounts(userId),
  ]);
  const catName = new Map(cats.map((c) => [c._id, c]));
  const accName = new Map(accs.map((a) => [a._id, a.name]));

  const params = new URLSearchParams();
  if (month) params.set("month", month);
  for (const k of ["categoryId", "accountId", "type", "q"] as const) if (f[k]) params.set(k, String(f[k]));
  const pageHref = (p: number) => `/movimientos?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) })}`;

  const groups = new Map<string, typeof res.items>();
  for (const t of res.items) {
    const k = String(t.date).slice(0, 10);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Movimientos</h1>
      <form className="grid grid-cols-2 gap-2" method="get">
        <Input type="month" name="month" defaultValue={month ?? ""} aria-label="Mes" />
        <Input name="q" placeholder="Buscar" defaultValue={f.q ?? ""} />
        <select name="categoryId" defaultValue={f.categoryId ?? ""} className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select name="accountId" defaultValue={f.accountId ?? ""} className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Cuenta">
          <option value="">Todas las cuentas</option>
          {accs.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
        <select name="type" defaultValue={f.type ?? ""} className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Tipo">
          <option value="">Todos</option><option value="expense">Gastos</option><option value="income">Ingresos</option><option value="transfer">Transferencias</option>
        </select>
        <Button type="submit">Filtrar</Button>
      </form>

      <div className="flex justify-between rounded-lg bg-muted p-3 text-sm">
        <span>{res.total} mov.</span>
        <span className="text-green-600">+{formatMoney(res.totals.incomeCents)}</span>
        <span className="text-red-600">−{formatMoney(res.totals.expenseCents)}</span>
      </div>

      {res.items.length === 0 && <p className="py-8 text-center text-muted-foreground">No hay movimientos.</p>}

      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="space-y-1">
          <h2 className="text-xs font-medium uppercase text-muted-foreground">{dayFmt.format(new Date(day + "T12:00:00Z"))}</h2>
          <ul className="divide-y rounded-lg border">
            {items.map((t) => {
              const cat = t.categoryId ? catName.get(t.categoryId) : undefined;
              const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
              return (
                <li key={t._id}>
                  <Link href={`/movimientos/${t._id}`} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.merchant || t.rawDescription || "Sin concepto"}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        <Badge variant="secondary">{cat ? `${cat.icon ?? ""} ${cat.name}` : "Sin categoría"}</Badge>
                        {t.accountId && <span className="text-xs text-muted-foreground">{accName.get(t.accountId)}</span>}
                      </div>
                    </div>
                    <span className={t.type === "income" ? "font-medium text-green-600" : t.type === "transfer" ? "text-muted-foreground" : "font-medium"}>
                      {sign}{formatMoney(t.amountCents, t.currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {res.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {res.page > 1 ? <Link href={pageHref(res.page - 1)}>← Anterior</Link> : <span />}
          <span>{res.page} / {res.pages}</span>
          {res.page < res.pages ? <Link href={pageHref(res.page + 1)}>Siguiente →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
