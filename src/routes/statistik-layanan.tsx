// Halaman statistik publik pelayanan publik (transparansi).
// Data: fetchAllOpdKinerja (RPC opd_kinerja_agg + opd_rating_agg, publik).
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2, Star, Timer, CheckCircle2 } from "lucide-react";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { fetchAllOpdKinerja, type OpdKinerja } from "@/lib/kinerja-queries";

export const Route = createFileRoute("/statistik-layanan")({
  head: () => ({
    meta: [
      { title: "Statistik Pelayanan Publik — Portal Buton Selatan" },
      {
        name: "description",
        content:
          "Transparansi kinerja OPD: jumlah permohonan, SLA compliance, dan rating masyarakat.",
      },
      { property: "og:title", content: "Statistik Pelayanan Publik — Portal Buton Selatan" },
      {
        property: "og:description",
        content: "Data terbuka kinerja pelayanan publik Kabupaten Buton Selatan.",
      },
    ],
  }),
  component: StatistikPage,
});

function StatistikPage() {
  const [rows, setRows] = useState<OpdKinerja[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllOpdKinerja()
      .then((r) => setRows(r.sort((a, b) => b.total_permohonan - a.total_permohonan)))
      .finally(() => setLoading(false));
  }, []);

  const totalPermohonan = rows.reduce((s, r) => s + r.total_permohonan, 0);
  const totalSelesai = rows.reduce((s, r) => s + (r.status_counts.selesai || 0), 0);
  const rataRating =
    (() => {
      const arr = rows.filter((r) => r.rata_rating != null);
      if (!arr.length) return null;
      return arr.reduce((s, r) => s + (r.rata_rating || 0), 0) / arr.length;
    })();
  const rataTepatWaktu =
    (() => {
      const arr = rows.filter((r) => r.tepat_waktu_persen != null);
      if (!arr.length) return null;
      return arr.reduce((s, r) => s + (r.tepat_waktu_persen || 0), 0) / arr.length;
    })();

  return (
    <PageShell>
      <PageHero
        eyebrow="Data Terbuka"
        title="Statistik Pelayanan Publik"
        description="Kinerja pelayanan publik Kabupaten Buton Selatan yang dapat diakses masyarakat."
      />
      <section className="container-page py-10">
        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card icon={<BarChart3 />} label="Total Permohonan" value={totalPermohonan.toLocaleString("id-ID")} />
              <Card icon={<CheckCircle2 />} label="Selesai" value={totalSelesai.toLocaleString("id-ID")} />
              <Card
                icon={<Star />}
                label="Rata-rata Rating"
                value={rataRating != null ? rataRating.toFixed(2) + " / 10" : "—"}
              />
              <Card
                icon={<Timer />}
                label="Tepat Waktu"
                value={rataTepatWaktu != null ? rataTepatWaktu.toFixed(1) + "%" : "—"}
              />
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">OPD</th>
                    <th className="px-4 py-3 text-right">Permohonan</th>
                    <th className="px-4 py-3 text-right">Selesai</th>
                    <th className="px-4 py-3 text-right">Diproses</th>
                    <th className="px-4 py-3 text-right">Rata Hari</th>
                    <th className="px-4 py-3 text-right">Rating</th>
                    <th className="px-4 py-3 text-right">Tepat Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.opd_id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.opd_singkatan}</p>
                        <p className="text-xs text-muted-foreground">{r.opd_nama}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{r.total_permohonan}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.status_counts.selesai || 0}</td>
                      <td className="px-4 py-3 text-right font-mono">{r.status_counts.diproses || 0}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.rata_hari_selesai != null ? r.rata_hari_selesai.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.rata_rating != null ? r.rata_rating.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.tepat_waktu_persen != null ? r.tepat_waktu_persen.toFixed(0) + "%" : "—"}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        Belum ada data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Sumber data: agregat permohonan &amp; rating masyarakat. Diperbarui secara realtime.
            </p>
          </>
        )}
      </section>
    </PageShell>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-lg font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
