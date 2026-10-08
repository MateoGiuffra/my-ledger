import { createRuleAction, deleteRuleAction, seedRulesAction } from "@/app/actions/counterparties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCategories } from "@/server/services/catalog";
import { listRules } from "@/server/services/rules";
import { requireUserId } from "@/server/session";

export default async function ReglasPage() {
  const userId = await requireUserId();
  const [rules, cats] = await Promise.all([listRules(userId), listCategories(userId)]);
  const catName = new Map(cats.map((c) => [c._id, c.name]));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reglas de categorización</h1>
      <p className="text-xs text-muted-foreground">Si la descripción contiene el texto → categoría. Prioridad: contraparte &gt; regla &gt; sin categoría.</p>
      <ul className="space-y-2">
        {rules.map((r) => (
          <li key={r._id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span><b>{r.pattern}</b> <span className="text-xs text-muted-foreground">({r.match}) → {catName.get(String(r.categoryId)) ?? "?"}</span></span>
            <form action={deleteRuleAction}><input type="hidden" name="id" value={r._id} /><Button size="xs" variant="ghost" type="submit">Borrar</Button></form>
          </li>
        ))}
        {rules.length === 0 && <li className="py-4 text-center text-muted-foreground">Sin reglas.</li>}
      </ul>
      <form action={createRuleAction} className="grid grid-cols-2 gap-2">
        <Input name="pattern" placeholder="Texto o regex" required className="col-span-2" />
        <select name="match" className="h-8 rounded-lg border bg-transparent px-2 text-sm"><option value="contains">Contiene</option><option value="regex">Regex</option></select>
        <select name="categoryId" required className="h-8 rounded-lg border bg-transparent px-2 text-sm"><option value="">Categoría…</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <Input name="priority" type="number" placeholder="Prioridad (0)" defaultValue={0} className="col-span-2" />
        <Button type="submit" className="col-span-2">Agregar regla</Button>
      </form>
      <form action={seedRulesAction}><Button type="submit" variant="outline" className="w-full">Cargar reglas sugeridas (Spotify, EBANX, SUBE…)</Button></form>
    </div>
  );
}
