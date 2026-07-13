// Admin OPD — Verifikasi Bukti Permohonan via QR scan.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ScanLine, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { QrScanner } from "@/components/asn/QrScanner";
import { verifyBuktiByToken, adminScanVerifyBukti } from "@/lib/bukti-permohonan.functions";

export const Route = createFileRoute("/_authenticated/admin/verifikasi-bukti")({
  head: () => ({
    meta: [
      { title: "Verifikasi Bukti Permohonan — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Bukti = {
  permohonan_id: string;
  kode: string;
  judul: string;
  kategori: string;
  status: string;
  tanggal_masuk: string;
  generated_at: string | null;
  verified_at: string | null;
  verified_note: string | null;
  pemohon: { nama: string; nik_masked: string; no_hp: string };
  opd: { nama: string; singkatan: string };
};

function Page() {
  const verify = useServerFn(verifyBuktiByToken);
  const markVerified = useServerFn(adminScanVerifyBukti);
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [bukti, setBukti] = useState<Bukti | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  function extractToken(raw: string): string {
    // Terima URL /v/{token}, /verify/{token}, atau token telanjang.
    try {
      const u = new URL(raw);
      const m = u.pathname.match(/\/(?:v|verify)\/([^/?#]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch {
      /* not a URL */
    }
    return raw.trim();
  }

  async function checkToken(raw: string) {
    const t = extractToken(raw);
    if (!t) return;
    setToken(t);
    setBusy(true);
    setBukti(null);
    setNotFound(false);
    try {
      const r = await verify({ data: { token: t } });
      if (!r.valid) {
        setNotFound(true);
      } else {
        setBukti(r.bukti);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal verifikasi");
    } finally {
      setBusy(false);
    }
  }

  async function doMarkVerified() {
    if (!bukti) return;
    setBusy(true);
    try {
      const r = await markVerified({ data: { token, note: note.trim() || null } });
      if (r.already_verified) {
        toast.info("Bukti ini sebelumnya sudah diverifikasi. Catatan diperbarui.");
      } else {
        toast.success("Bukti berhasil diverifikasi");
      }
      await checkToken(token);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menandai verifikasi");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setToken("");
    setManualToken("");
    setBukti(null);
    setNotFound(false);
    setNote("");
  }

  return (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Verifikasi Bukti Permohonan" }]}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Verifikasi Bukti Permohonan</h2>
            <p className="text-sm text-muted-foreground">
              Pindai QR pada dokumen bukti permohonan yang dibawa pemohon sebelum menyerahkan
              dokumen fisik.
            </p>
          </div>
        </div>

        {!bukti && !notFound ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ScanLine className="h-4 w-4" /> Scan QR
              </div>
              {scanning ? (
                <>
                  <QrScanner
                    onResult={(text) => {
                      setScanning(false);
                      checkToken(text);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setScanning(false)}
                    className="mt-3 inline-flex h-9 items-center rounded-md border border-border px-3 text-xs"
                  >
                    Batalkan
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <ScanLine className="h-4 w-4" /> Aktifkan Kamera
                </button>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 font-medium">Input Manual Token</div>
              <p className="mb-3 text-xs text-muted-foreground">
                Bila kamera tidak tersedia, salin token dari URL QR (`/v/&lt;token&gt;`) dan tempel
                di sini.
              </p>
              <div className="flex gap-2">
                <input
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Token atau URL bukti"
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => checkToken(manualToken)}
                  disabled={!manualToken || busy}
                  className="inline-flex h-10 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cek"}
                </button>
              </div>
            </div>
          </div>
        ) : notFound ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h3 className="mt-3 font-display text-lg font-semibold text-destructive">
              Bukti tidak ditemukan
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Token tidak sesuai dengan permohonan mana pun. Pastikan pemohon menunjukkan bukti asli
              yang dicetak dari portal.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              Scan Ulang
            </button>
          </div>
        ) : bukti ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-display text-lg font-semibold">Bukti Ditemukan</h3>
              {bukti.verified_at && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  Sudah diverifikasi{" "}
                  {new Date(bukti.verified_at).toLocaleString("id-ID")}
                </span>
              )}
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Kode Permohonan</dt>
                <dd className="font-mono font-semibold">{bukti.kode}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{bukti.status}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Judul</dt>
                <dd>{bukti.judul}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Kategori Layanan</dt>
                <dd>{bukti.kategori}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tanggal Pengajuan</dt>
                <dd>{new Date(bukti.tanggal_masuk).toLocaleDateString("id-ID")}</dd>
              </div>
              <div className="sm:col-span-2 border-t border-border pt-3">
                <dt className="text-xs text-muted-foreground">Pemohon</dt>
                <dd className="font-medium">
                  {bukti.pemohon.nama}
                  <span className="ml-2 text-xs text-muted-foreground">
                    (NIK: {bukti.pemohon.nik_masked} · HP: {bukti.pemohon.no_hp})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">OPD Tujuan</dt>
                <dd>{bukti.opd.nama} ({bukti.opd.singkatan})</dd>
              </div>
            </dl>

            <div className="mt-6 space-y-3 border-t border-border pt-4">
              <label className="block text-sm font-medium">Catatan Verifikasi (opsional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Contoh: KTP asli sudah dicek dan cocok."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={doMarkVerified}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Tandai Diverifikasi
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
                >
                  Scan Bukti Lain
                </button>
              </div>
              {bukti.verified_note && (
                <p className="text-xs text-muted-foreground">
                  Catatan sebelumnya: <em>{bukti.verified_note}</em>
                </p>
              )}
            </div>
          </div>
        ) : null}
      </AdminShell>
    </AdminGuard>
  );
}
