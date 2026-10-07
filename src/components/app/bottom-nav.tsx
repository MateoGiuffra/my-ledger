"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/inicio", label: "Inicio", icon: "🏠" },
  { href: "/movimientos", label: "Movs", icon: "🧾" },
  { href: "/movimientos/nuevo", label: "+", icon: "+", fab: true },
  { href: "/deudas", label: "Deudas", icon: "🤝" },
  { href: "/plan", label: "Plan", icon: "🎯" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-5 items-center">
        {tabs.map((t) => {
          const active = !t.fab && (path === t.href || (t.href !== "/inicio" && path.startsWith(t.href + "/") && !path.startsWith("/movimientos/nuevo")));
          return (
            <li key={t.href} className="flex justify-center">
              {t.fab ? (
                <Link
                  href={t.href}
                  aria-label="Nuevo movimiento"
                  className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-3xl text-primary-foreground shadow-lg"
                >
                  +
                </Link>
              ) : (
                <Link
                  href={t.href}
                  className={cn("flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground", active && "font-semibold text-foreground")}
                >
                  <span className="text-lg leading-none">{t.icon}</span>
                  {t.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
