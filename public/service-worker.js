// Kill-switch untuk SW lama yang pernah terdaftar pada path ini.
// Cache Storage origin-scoped; hanya hapus cache milik registrasi ini (jangan sentuh
// cache messaging seperti firebase/onesignal).
function isOwnedCacheName(name) {
  return (
    name.endsWith(self.registration.scope) ||
    name.startsWith("workbox-") ||
    name.startsWith("html-nav") ||
    name.startsWith("static-assets") ||
    name.startsWith("images")
  );
}

self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter(isOwnedCacheName).map((n) => caches.delete(n)),
        );
        await self.clients.claim();
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
