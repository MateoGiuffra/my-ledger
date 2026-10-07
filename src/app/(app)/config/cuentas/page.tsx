import { archiveAccountAction, createAccountAction } from "@/app/actions/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAccounts } from "@/server/services/catalog";
import { requireUserId } from "@/server/session";

export default async function CuentasPage() {
  const accounts = await listAccounts(await requireUserId());
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Cuentas</h1>
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a._id} className="flex items-center justify-between rounded-lg border p-3">
            <span>{a.name} <span className="text-xs text-muted-foreground">{a.type} · {a.currency}</span></span>
            <form action={archiveAccountAction}>
              <input type="hidden" name="id" value={a._id} />
              <Button size="xs" variant="ghost" type="submit">Archivar</Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createAccountAction} className="grid grid-cols-2 gap-2">
        <Input name="name" placeholder="Nueva cuenta" required className="col-span-2" />
        <select name="type" className="h-8 rounded-lg border bg-transparent px-2 text-sm">
          <option value="mp">Mercado Pago</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option>
          <option value="cocos">Cocos</option><option value="sube">SUBE</option>
        </select>
        <select name="currency" className="h-8 rounded-lg border bg-transparent px-2 text-sm">
          <option>ARS</option><option>USD</option>
        </select>
        <Button type="submit" className="col-span-2">Agregar</Button>
      </form>
    </div>
  );
}
