// Halaman cek status permohonan tanpa login.
// Warga masukkan kode permohonan + 4 digit terakhir NIK.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { PermohonanProgressBar } from "@/components/warga/PermohonanProgressBar";
import {
  getPermohonanPublik,
  type PermohonanPublic,
} from "@/lib/permohonan-public.functions";

export const Route = createFileRoute("/cek-permohonan")({
  head: () => ({
    meta: [
      { title: "Cek Status Permohonan — Portal Buton Selatan" },
      {
        name: "description",
        content:
          "Cek status permohonan pelayanan publik tanpa login menggunakan kode permohonan dan NIK.",
      },
      { property: "og:title", content: "Cek Status Permohonan — Portal Buton Selatan" },
      {
        property: "og:description",
        content: "Lacak permohonan pelayanan publik Anda secara transparan.",
      },
    ],
  }),
  component: CekPage,
});

function CekPage() {
  const [kode, setKode] = useState("");
  const [nik4, setNik4] = useState("");
  const [loading, setLoading] = useState(false);
  const [row, setRow] = useState<PermohonanPublic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const fnGet = useServerFn(getPermohonanPublik);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kode.trim() || nik4.length !== 4) return;
    setLoading(true);
    setNotFound(false);
    setRow(null);
    try {
      const r = await fnGet({ data: { kode: kode.trim(), nik4 } });
      if (!r) setNotFound(true);
      else setRow(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Transparansi Layanan"
        title="Cek Status Permohonan"
        description="Lacak permohonan pelayanan publik menggunakan kode + 4 digit terakhir NIK."
      />
      <section className="container-page py-10">
        <form
          onSubmit={onSubmit}
          className="mx-auto grid max-w-xl gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
        >
          <div>
            <label className="text-sm font-medium">Kode Permohonan</label>
            <input
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="Contoh: PMH-2026-000123"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">4 Digit Terakhir NIK</label>
            <input
              value={nik4}
              onChange={(e) => setNik4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Cek Status
          </button>
        </form>

        {notFound && (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Permohonan tidak ditemukan. Pastikan kode dan 4 digit NIK benar.
          </div>
        )}

        {row && (
          <article className="mx-auto mt-6 max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <header>
              <p className="font-mono text-sm text-muted-foreground">{row.kode}</p>
              <h2 className="mt-1 font-display text-lg font-bold">{row.judul}</h2>
              <p className="text-xs text-muted-foreground">
                {row.opd_singkatan ? `${row.opd_singkatan} · ` : ""}
                {row.kategori} · Diterima {new Date(row.tanggal_masuk).toLocaleDateString("id-ID")}
              </p>
            </header>

            <PermohonanProgressBar status={row.status} />

            {row.alasan_penolakan && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <strong>Alasan penolakan:</strong> {row.alasan_penolakan}
              </div>
            )}

            {row.riwayat.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Riwayat</h3>
                <ol className="space-y-2 text-sm">
                  {row.riwayat.map((r, i) => (
                    <li key={i} className="rounded-md border border-border bg-surface p-3">
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("id-ID")}
                      </p>
                      <p className="font-medium">{r.aksi}</p>
                      {r.catatan && (
                        <p className="mt-1 whitespace-pre-line text-muted-foreground">{r.catatan}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </article>
        )}
      </section>
    </PageShell>
  );
}
