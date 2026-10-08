import { disconnectGoogleAction } from "@/app/actions/google";
import { Button, buttonVariants } from "@/components/ui/button";
import { googleConfigured, isGoogleConnected } from "@/server/integrations/gcal";
import { requireUserId } from "@/server/session";

const ERR: Record<string, string> = {
  config: "Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno.",
  denied: "Cancelaste el permiso en Google.",
  state: "La verificación de seguridad falló, probá de nuevo.",
  exchange: "No se pudo completar la conexión con Google.",
};

export default async function GooglePage(props: PageProps<"/config/google">) {
  const userId = await requireUserId();
  const sp = await props.searchParams;
  const err = typeof sp.error === "string" ? ERR[sp.error] : null;
  const connected = await isGoogleConnected(userId);
  const configured = googleConfigured();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Google Calendar</h1>
      {err && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-sm text-destructive">{err}</p>}
      {sp.ok && <p className="rounded-lg bg-green-500/10 p-2 text-sm">Conectado ✓</p>}
      <p className="text-sm">Estado: <b>{connected ? "conectado" : "no conectado"}</b></p>
      {!configured && <p className="text-sm text-muted-foreground">Falta configurar las credenciales de Google en el entorno (ver README).</p>}
      {connected ? (
        <form action={disconnectGoogleAction}><Button variant="destructive" type="submit" className="h-10 w-full">Desconectar</Button></form>
      ) : (
        <a href="/api/google/connect" className={buttonVariants({ className: "h-10 w-full" })}>Conectar Google Calendar</a>
      )}
    </div>
  );
}
