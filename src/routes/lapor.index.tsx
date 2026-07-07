import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Loader2, Ticket, ArrowRight } from "lucide-react";
import { PageShell, PageHero } from "@/components/site/PageShell";
import { getLaporanByTicket } from "@/lib/lapor.functions";

export const Route = createFileRoute("/lapor/")({
  head: () => ({
    meta: [
      { title: "Cek Status Laporan — LAPOR! Buton Selatan" },
      {
        name: "description",
        content:
          "Lacak status tindak lanjut laporan pengaduan Anda menggunakan nomor tiket LAPOR!.",
      },
      { property: "og:title", content: "Cek Status Laporan LAPOR!" },
      {
        property: "og:description",
        content: "Masukkan nomor tiket LAPOR-YYYY-XXXXXX untuk memantau tindak lanjut.",
      },
    ],
  }),
  component: LaporIndex,
});

function LaporIndex() {
  const nav = useNavigate();
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const fnGet = useServerFn(getLaporanByTicket);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = ticket.trim().toUpperCase();
    if (!/^LAPOR-\d{4}-\d{4,8}$/.test(t)) {
      toast.error("Format tiket: LAPOR-YYYY-000001");
      return;
    }
    setBusy(true);
    try {
      const row = await fnGet({ data: { ticket: t } });
      if (!row) {
        toast.error("Tiket tidak ditemukan");
        return;
      }
      nav({ to: "/lapor/$ticket", params: { ticket: t } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="LAPOR!"
        title="Lacak status laporan Anda."
        description="Setiap laporan yang masuk mendapat nomor tiket unik. Gunakan nomor tersebut untuk memantau tindak lanjut."
      />
      <section className="container-page py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-soft">
          <form onSubmit={submit} className="space-y-3">
            <label className="text-sm font-medium">Nomor Tiket</label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <input
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                placeholder="LAPOR-2026-000123"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none uppercase"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Cek Status
            </button>
          </form>
          <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
            <Link to="/kontak" className="inline-flex items-center gap-1 text-primary hover:underline">
              Buat laporan baru <ArrowRight className="h-3 w-3" />
            </Link>
            <Link to="/lapor/saya" className="inline-flex items-center gap-1 text-primary hover:underline">
              Lihat semua laporan saya (perlu masuk) <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
