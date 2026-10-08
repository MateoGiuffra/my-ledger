import Link from "next/link";
import { markAllReadAction, markReadAction } from "@/app/actions/alerts";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { generateAlerts, listAlerts } from "@/server/services/alerts";
import { requireUserId } from "@/server/session";

export default async function AlertasPage(props: PageProps<"/alertas">) {
  const userId = await requireUserId();
  const sp = await props.searchParams;
  const all = sp.f === "all";
  await generateAlerts(userId).catch(() => {});
  const alerts = await listAlerts(userId, !all);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Alertas</h1>
        <form action={markAllReadAction}><Button size="sm" variant="outline" type="submit">Marcar todas leídas</Button></form>
      </div>
      <div className="flex gap-2 text-sm">
        <Link href="/alertas" className={`rounded-full border px-3 py-1 ${!all ? "bg-primary text-primary-foreground" : ""}`}>Pendientes</Link>
        <Link href="/alertas?f=all" className={`rounded-full border px-3 py-1 ${all ? "bg-primary text-primary-foreground" : ""}`}>Todas</Link>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a._id} className={`flex items-start justify-between gap-2 rounded-lg border p-3 ${a.readAt ? "opacity-60" : ""}`}>
            <Link href={a.url ?? "/inicio"} className="min-w-0 flex-1">
              <p className="font-medium">{a.title}</p>
              <p className="text-sm text-muted-foreground">{a.body}</p>
              <p className="text-xs text-muted-foreground">{formatDate(new Date(a.fireAt))}</p>
            </Link>
            {!a.readAt && <form action={markReadAction}><input type="hidden" name="id" value={a._id} /><Button size="xs" variant="ghost" type="submit">Leída</Button></form>}
          </li>
        ))}
        {alerts.length === 0 && <li className="py-8 text-center text-muted-foreground">No hay alertas.</li>}
      </ul>
    </div>
  );
}
