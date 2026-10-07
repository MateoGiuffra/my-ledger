import Link from "next/link";
import { BottomNav } from "@/components/app/bottom-nav";
import { requireUserId } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUserId();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/inicio" className="font-semibold">My Ledger</Link>
        <nav className="flex items-center gap-4 text-xl">
          <Link href="/alertas" aria-label="Alertas">🔔</Link>
          <Link href="/menu" aria-label="Menú">☰</Link>
        </nav>
      </header>
      <main className="flex-1 space-y-4 px-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
