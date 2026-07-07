import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, Inbox } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/site/PageShell";
import { useAuth } from "@/lib/auth-context";
import { getMyLaporan } from "@/lib/lapor.functions";

export const Route = createFileRoute("/lapor/saya")({
  head: () => ({
    meta: [
      { title: "Laporan Saya — LAPOR! Buton Selatan" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LaporSaya,
});

type Row = {
  id: string;
  ticket_code: string | null;
  kategori: string;
  uraian: string;
  status: string;
  created_at: string;
  updated_at: string;
  tindak_lanjut: string | null;
};

function LaporSaya() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const fn = useServerFn(getMyLaporan);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    fn()
      .then((data) => setRows((data ?? []) as Row[]))
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [user, authLoading, nav, fn]);

  return (
    <PageShell>
      <section className="container-page py-10">
        <Link to="/lapor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold md:text-3xl">Laporan Saya</h1>
        <p className="text-sm text-muted-foreground">Semua laporan LAPOR! yang Anda kirim.</p>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Memuat…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada laporan.</p>
              <Link to="/kontak" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                Buat laporan baru →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to="/lapor/$ticket"
                      params={{ ticket: r.ticket_code ?? "" }}
                      className="font-mono text-sm font-bold text-primary hover:underline"
                    >
                      {r.ticket_code ?? "—"}
                    </Link>
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">{r.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.kategori} · {new Date(r.created_at).toLocaleString("id-ID")}</p>
                  <p className="mt-1 line-clamp-2 text-sm">{r.uraian}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}
