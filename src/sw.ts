/// <reference lib="webworker" />
import { ExpirationPlugin, Serwist, StaleWhileRevalidate, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST?: (PrecacheEntry | string)[];
  }
}
declare const self: ServiceWorkerGlobalScope;

// Solo se cachean estáticos (JS/CSS/íconos). Las páginas son privadas y siempre van a la red.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"),
      handler: new StaleWhileRevalidate({ cacheName: "static-assets", plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 3600 })] }),
    },
  ],
});
serwist.addEventListeners();

// Push (FCM, mensajes de solo datos): { data: { title, body, url } }
self.addEventListener("push", (event) => {
  let payload: { data?: Record<string, string>; title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const d = payload.data ?? payload;
  event.waitUntil(
    self.registration.showNotification(d.title ?? "My Ledger", {
      body: d.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: d.url ?? "/alertas" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/alertas";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await (c as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    }),
  );
});
