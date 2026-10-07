import { savePrefsAction } from "@/app/actions/alerts";
import { PushSettings } from "@/components/app/push-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@/server/models/user";
import { ALERT_TYPES, getPrefs } from "@/server/services/alerts";
import { requireUserId } from "@/server/session";

const LABEL: Record<(typeof ALERT_TYPES)[number], string> = {
  commitment: "Vencimientos de compromisos (3 días, 1 día, hoy)",
  payday: "Día de cobro",
  savings: "Checklist del plan de ahorro",
  debt: "Recordatorio de deudas (30+ días sin pagos)",
};

export default async function NotificacionesPage() {
  const userId = await requireUserId();
  const [prefs, u] = await Promise.all([getPrefs(userId), User.findById(userId).select("pushTokens").lean<{ pushTokens?: string[] }>()]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Notificaciones</h1>
      <PushSettings deviceCount={u?.pushTokens?.length ?? 0} />
      <form action={savePrefsAction} className="space-y-3">
        {ALERT_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`t_${t}`} defaultChecked={prefs.types.includes(t)} /> {LABEL[t]}</label>
        ))}
        <label className="block space-y-1 text-sm">Hora de aviso (Buenos Aires)<Input name="hour" type="number" min={0} max={23} defaultValue={prefs.hour} /></label>
        <Button type="submit" className="h-10 w-full">Guardar</Button>
      </form>
    </div>
  );
}
