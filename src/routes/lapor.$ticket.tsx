import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/site/PageShell";
import { getLaporanByTicket, type LaporanPublic } from "@/lib/lapor.functions";

export const Route = createFileRoute("/lapor/$ticket")({
  head: ({ params }) => ({
    meta: [
      { title: `Laporan ${params.ticket} — LAPOR! Buton Selatan` },
      { name: "description", content: "Status tindak lanjut laporan pengaduan masyarakat." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LaporDetail,
});

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  ditinjau: "Ditinjau",
  diteruskan: "Diteruskan ke OPD",
  ditindaklanjuti: "Ditindaklanjuti",
  selesai: "Selesai",
  ditolak: "Ditolak",
};
const STATUS_TONE: Record<string, string> = {
  baru: "bg-blue-50 text-blue-700 border-blue-200",
  ditinjau: "bg-amber-50 text-amber-700 border-amber-200",
  diteruskan: "bg-purple-50 text-purple-700 border-purple-200",
  ditindaklanjuti: "bg-cyan-50 text-cyan-700 border-cyan-200",
  selesai: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ditolak: "bg-rose-50 text-rose-700 border-rose-200",
};

function LaporDetail() {
  const { ticket } = Route.useParams();
  const fnGet = useServerFn(getLaporanByTicket);
  const [row, setRow] = useState<LaporanPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fnGet({ data: { ticket } })
      .then((r) => setRow(r))
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [ticket, fnGet]);

  const tone = row ? STATUS_TONE[row.status] ?? STATUS_TONE.baru : "";
  const label = row ? STATUS_LABEL[row.status] ?? row.status : "";

  return (
    <PageShell>
      <section className="container-page py-10">
        <Link
          to="/lapor"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat laporan…
          </div>
        ) : !row ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-semibold text-foreground">Tiket tidak ditemukan</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Pastikan nomor tiket sesuai format LAPOR-YYYY-000000.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
            <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nomor Tiket</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-mono text-lg font-bold text-foreground">{row.ticket_code}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(row.ticket_code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      title="Salin"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>
              </div>

              <hr className="my-5 border-border" />

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pelapor</dt>
                  <dd className="mt-1 text-sm">{row.nama}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kategori</dt>
                  <dd className="mt-1 text-sm">{row.kategori}</dd>
                </div>
                {row.lokasi && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lokasi</dt>
                    <dd className="mt-1 text-sm">{row.lokasi}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Uraian</dt>
                  <dd className="mt-1 whitespace-pre-line text-sm">{row.uraian}</dd>
                </div>
                {row.tindak_lanjut && (
                  <div className="sm:col-span-2 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-primary">Tindak Lanjut</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-foreground">{row.tindak_lanjut}</dd>
                  </div>
                )}
              </dl>
            </article>

            <aside className="space-y-3 text-sm">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <p className="text-xs uppercase text-muted-foreground">Diterima</p>
                <p className="mt-1 font-medium">{new Date(row.created_at).toLocaleString("id-ID")}</p>
                <p className="mt-3 text-xs uppercase text-muted-foreground">Terakhir diperbarui</p>
                <p className="mt-1 font-medium">{new Date(row.updated_at).toLocaleString("id-ID")}</p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </PageShell>
  );
}
