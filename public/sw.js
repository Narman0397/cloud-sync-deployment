// Combined service worker:
//  - Workbox precache + runtime caching (PWA offline shell) via injectManifest.
//  - Web Push notification handler.
// Sumber `self.__WB_MANIFEST` di-inject saat build oleh vite-plugin-pwa (mode injectManifest).
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

self.skipWaiting();
cleanupOutdatedCaches();

// Precache hashed build assets.
precacheAndRoute(self.__WB_MANIFEST || []);

// HTML navigations -> NetworkFirst (jangan cache-first agar deploy baru langsung kelihatan).
// Kecualikan OAuth & API public.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "html-nav",
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 })],
    }),
    {
      denylist: [/^\/~oauth/, /^\/api\//, /^\/auth/, /^\/admin/],
    },
  ),
);

// Static same-origin hashed assets -> CacheFirst.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ["style", "script", "worker", "font"].includes(request.destination),
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Images -> SWR.
registerRoute(
  ({ request, url }) => url.origin === self.location.origin && request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "images",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// ===== Web Push =====
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Notifikasi", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Notifikasi";
  const body = payload.body || "";
  const url = payload.url || "/";
  const tag = payload.tag || "notif";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clientsList.length > 0) {
        clientsList.forEach((c) => c.postMessage({ type: "push", title, body, url }));
      }
      await self.registration.showNotification(title, {
        body,
        tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try {
            await c.navigate(url);
          } catch {
            /* ignore */
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
