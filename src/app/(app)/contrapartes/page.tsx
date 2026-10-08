import Link from "next/link";
import { createCounterpartyAction } from "@/app/actions/counterparties";
import { CounterpartyFields } from "@/components/app/counterparty-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCategories } from "@/server/services/catalog";
import { listCounterparties } from "@/server/services/counterparties";
import { listPersons } from "@/server/services/debts";
import { requireUserId } from "@/server/session";

export default async function ContrapartesPage(props: PageProps<"/contrapartes">) {
  const userId = await requireUserId();
  const sp = await props.searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const [list, cats, persons] = await Promise.all([listCounterparties(userId, q), listCategories(userId), listPersons(userId)]);
  const catName = new Map(cats.map((c) => [c._id, c.name]));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Contrapartes</h1>
      <form className="flex gap-2"><Input name="q" placeholder="Buscar" defaultValue={q} /><Button type="submit" variant="outline">Buscar</Button></form>
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c._id}>
            <Link href={`/contrapartes/${c._id}`} className="block rounded-lg border p-3 text-sm">
              <p className="font-medium">{c.displayName}{c.mode !== "normal" && <span className="ml-2 text-xs text-muted-foreground">{c.mode === "debt" ? "deuda" : "transferencia"}</span>}</p>
              <p className="text-xs text-muted-foreground">{c.defaultCategoryId ? catName.get(String(c.defaultCategoryId)) : "Sin categoría"} · {c.identifiers.length} identificador(es)</p>
            </Link>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-muted-foreground">No hay contrapartes.</li>}
      </ul>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Nueva contraparte</summary>
        <form action={createCounterpartyAction} className="space-y-2 pt-3">
          <CounterpartyFields cats={cats} persons={persons} />
          <Button type="submit" className="w-full">Crear</Button>
        </form>
      </details>
    </div>
  );
}
