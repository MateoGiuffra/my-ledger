import Link from "next/link";

const items = [
  ["/config/cuentas", "Cuentas"],
  ["/config/categorias", "Categorías"],
  ["/config/reglas", "Reglas de categorización"],
  ["/contrapartes", "Contrapartes"],
  ["/config/dolar", "Dólar"],
  ["/config/google", "Google Calendar"],
  ["/config/notificaciones", "Notificaciones"],
  ["/config/password", "Contraseña"],
  ["/api/export", "Exportar datos (JSON)"],
];

export default function ConfigPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Configuración</h1>
      {items.map(([href, label]) => (
        <Link key={href} href={href} prefetch={false} className="block rounded-lg border p-3">{label}</Link>
      ))}
    </div>
  );
}
