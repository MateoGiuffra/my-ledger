import { Input } from "@/components/ui/input";

const SELECT = "h-8 w-full rounded-lg border bg-transparent px-2 text-sm";

export function CounterpartyFields({
  cats,
  persons,
  d,
}: {
  cats: { _id: string; name: string }[];
  persons: { _id: string; name: string }[];
  d?: { displayName?: string; label?: string; defaultCategoryId?: string | null; mode?: string; debtPersonId?: string | null };
}) {
  return (
    <>
      <Input name="displayName" placeholder="Nombre visible (ej. Lucas · Peluquería)" defaultValue={d?.displayName} required />
      <Input name="label" placeholder="Comercio / etiqueta (opcional)" defaultValue={d?.label} />
      <select name="defaultCategoryId" defaultValue={d?.defaultCategoryId ?? ""} className={SELECT} aria-label="Categoría por defecto">
        <option value="">Sin categoría por defecto</option>
        {cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
      </select>
      <select name="mode" defaultValue={d?.mode ?? "normal"} className={SELECT} aria-label="Modo">
        <option value="normal">Normal (gasto/ingreso)</option>
        <option value="transfer">Transferencia propia (no es gasto)</option>
        <option value="debt">Deuda (genera movimiento en Deudas)</option>
      </select>
      <select name="debtPersonId" defaultValue={d?.debtPersonId ?? ""} className={SELECT} aria-label="Persona de deuda">
        <option value="">Persona de deuda (solo modo deuda)</option>
        {persons.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
      </select>
    </>
  );
}
