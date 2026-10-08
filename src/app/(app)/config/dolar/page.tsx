import { updateFxAction } from "@/app/actions/savings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchDolar, planOverview } from "@/server/services/savings";
import { requireUserId } from "@/server/session";

export default async function DolarPage() {
  const userId = await requireUserId();
  const [ov, ref] = await Promise.all([planOverview(userId), fetchDolar()]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dólar</h1>
      <form action={updateFxAction} className="space-y-3">
        <label className="block space-y-1 text-sm">Dólar de planificación<Input name="fxPlan" inputMode="decimal" defaultValue={ov.plan.fxPlan} /></label>
        <label className="block space-y-1 text-sm">Dólar actual (manual)<Input name="fxActual" inputMode="decimal" defaultValue={ov.fxActual ?? ""} /></label>
        <Button type="submit" className="h-10 w-full">Guardar</Button>
      </form>
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-medium">Cotización de referencia (dolarapi.com)</p>
        {ref ? <p className="text-muted-foreground">Oficial {ref.oficial ?? "—"} · MEP {ref.mep ?? "—"} · Blue {ref.blue ?? "—"} (venta, caché 1 h)</p> : <p className="text-muted-foreground">No disponible ahora.</p>}
      </div>
    </div>
  );
}
