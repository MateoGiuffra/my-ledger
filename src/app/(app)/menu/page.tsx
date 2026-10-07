import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const items = [
  ["/reportes", "📊 Reportes"],
  ["/compromisos", "📅 Compromisos"],
  ["/importar", "⬆️ Importar"],
  ["/contrapartes", "👥 Contrapartes"],
  ["/alertas", "🔔 Alertas"],
  ["/config", "⚙️ Configuración"],
];

export default function MenuPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Menú</h1>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className="block rounded-lg border p-3">{label}</Link>
      ))}
      <form action={logoutAction}>
        <Button variant="outline" className="mt-4 h-10 w-full" type="submit">Cerrar sesión</Button>
      </form>
    </div>
  );
}
