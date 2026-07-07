// Wrapper registrasi PWA SW yang aman untuk Lovable preview.
// - Hanya register di production build.
// - Jangan register di iframe atau host preview Lovable.
// - Hormati ?sw=off untuk men-unregister SW jika debugging.
export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const host = window.location.hostname;
  const previewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const swOff = new URL(window.location.href).searchParams.get("sw") === "off";

  const blocked = !import.meta.env.PROD || inIframe || previewHost || swOff;

  if (blocked) {
    // Bersihkan registrasi yang mungkin sudah terpasang dari kunjungan sebelumnya
    // (mis. pengguna yang sebelumnya membuka URL produksi lalu kembali ke preview).
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((r) => {
          const u = r.active?.scriptURL || "";
          if (u.endsWith("/sw.js") || u.endsWith("/service-worker.js")) r.unregister();
        });
      })
      .catch(() => {});
    return;
  }

  // Kill-switch path lama (no-op kalau sudah unregister).
  navigator.serviceWorker
    .register("/service-worker.js", { scope: "/" })
    .catch(() => {});

  // Daftarkan SW utama.
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
