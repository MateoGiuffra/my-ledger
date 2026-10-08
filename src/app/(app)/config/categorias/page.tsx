import { archiveCategoryAction, createCategoryAction } from "@/app/actions/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCategories } from "@/server/services/catalog";
import { requireUserId } from "@/server/session";

export default async function CategoriasPage() {
  const cats = await listCategories(await requireUserId());
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Categorías</h1>
      <ul className="space-y-2">
        {cats.map((c) => (
          <li key={c._id} className="flex items-center justify-between rounded-lg border p-3">
            <span>{c.icon} {c.name}{c.isIncome && <span className="ml-2 text-xs text-muted-foreground">ingreso</span>}</span>
            <form action={archiveCategoryAction}>
              <input type="hidden" name="id" value={c._id} />
              <Button size="xs" variant="ghost" type="submit">Archivar</Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createCategoryAction} className="grid grid-cols-[4rem_1fr] gap-2">
        <Input name="icon" placeholder="🙂" maxLength={8} />
        <Input name="name" placeholder="Nueva categoría" required />
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="isIncome" /> Es de ingresos</label>
        <Button type="submit" className="col-span-2">Agregar</Button>
      </form>
    </div>
  );
}
