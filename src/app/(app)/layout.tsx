import Link from "next/link";
import { BottomNav } from "@/components/app/bottom-nav";
import { refreshAlertsThrottled, unreadCount } from "@/server/services/alerts";
import { requireUserId } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const userId = await requireUserId();
  await refreshAlertsThrottled(userId);
  const unread = await unreadCount(userId);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href="/inicio" className="font-semibold">My Ledger</Link>
        <nav className="flex items-center gap-4 text-xl">
          <Link href="/alertas" aria-label={`Alertas (${unread} sin leer)`} className="relative">
            🔔
            {unread > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white">{unread}</span>}
          </Link>
          <Link href="/menu" aria-label="Menú">☰</Link>
        </nav>
      </header>
      <main className="flex-1 space-y-4 px-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
