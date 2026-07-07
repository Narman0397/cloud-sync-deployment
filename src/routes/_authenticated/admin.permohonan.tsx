// Halaman Permohonan (terpisah dari Command Center).
// Berisi blok status + filter + tabel daftar permohonan.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Inbox,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { deletePermohonan } from "@/lib/admin-actions.functions";
import { STATUS_LABEL, STATUS_TONE, fmtTanggal, type StatusPermohonan } from "@/lib/permohonan";

export const Route = createFileRoute("/_authenticated/admin/permohonan")({
  head: () => ({
    meta: [{ title: "Permohonan — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <PermohonanPage />
    </AdminGuard>
  ),
});

type Permohonan = {
  id: string;
  kode: string;
  judul: string;
  kategori: string;
  status: StatusPermohonan;
  tanggal_masuk: string;
  tenggat: string | null;
  updated_at: string;
  opd_id: string;
  pemohon_id: string;
};
type Opd = { id: string; nama: string; singkatan: string; kategori: string[] };

const STATUS_OPTIONS: ("semua" | StatusPermohonan)[] = [
  "semua",
  "baru",
  "diproses",
  "selesai",
  "ditolak",
];

function PermohonanPage() {
  const { isSuperAdmin, user } = useAuth();
  const [opdList, setOpdList] = useState<Opd[]>([]);
  const [opdAktifId, setOpdAktifId] = useState<string>("");
  const [items, setItems] = useState<Permohonan[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"semua" | StatusPermohonan>("semua");
  const [kategori, setKategori] = useState<string>("semua");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("opd")
      .select("id,nama,singkatan,kategori")
      .order("nama")
      .then(({ data }) => setOpdList((data ?? []) as Opd[]));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isSuperAdmin) {
      supabase
        .from("profiles")
        .select("opd_id")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setOpdAktifId(data?.opd_id ?? ""));
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    let qry = supabase
      .from("permohonan")
      .select("id,kode,judul,kategori,status,tanggal_masuk,tenggat,updated_at,opd_id,pemohon_id")
      .order("tanggal_masuk", { ascending: false })
      .limit(200);
    if (opdAktifId) qry = qry.eq("opd_id", opdAktifId);
    qry.then(({ data }) => {
      setItems((data ?? []) as Permohonan[]);
      setLoading(false);
    });
  }, [opdAktifId]);

  const opd = opdList.find((o) => o.id === opdAktifId);

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        if (status !== "semua" && p.status !== status) return false;
        if (kategori !== "semua" && p.kategori !== kategori) return false;
        if (q.trim()) {
          const n = q.toLowerCase();
          if (!p.kode.toLowerCase().includes(n) && !p.judul.toLowerCase().includes(n)) return false;
        }
        return true;
      }),
    [items, status, kategori, q],
  );

  const kpi = useMemo(() => {
    const c: Record<string, number> = { baru: 0, diproses: 0, selesai: 0, ditolak: 0 };
    items.forEach((p) => {
      if (p.status in c) c[p.status]++;
    });
    return c;
  }, [items]);

  return (
    <AdminShell
      opdAktifId={opdAktifId}
      onChangeOpd={isSuperAdmin ? setOpdAktifId : undefined}
      breadcrumb={[{ label: "Pelayanan Publik" }, { label: "Permohonan" }]}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
          Daftar Permohonan
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola permohonan layanan publik berdasarkan status dan kategori.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Baru" value={kpi.baru} delta="Menunggu verifikasi" tone="accent" icon={Inbox} />
        <StatCard label="Diproses" value={kpi.diproses} delta="Sedang dikerjakan" tone="gold" icon={Loader2} />
        <StatCard label="Selesai" value={kpi.selesai} delta="Total" tone="success" icon={CheckCircle2} />
        <StatCard label="Ditolak" value={kpi.ditolak} delta="Berkas tidak lengkap" tone="destructive" icon={XCircle} />
      </div>

      <section id="tabel" className="mt-6 rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Daftar Permohonan</h2>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
              {filtered.length}
            </span>
          </div>
          <div className="md:ml-auto flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari kode / judul…"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm sm:w-64"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "semua" | StatusPermohonan)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "semua" ? "Semua status" : STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {opd && (
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="semua">Semua kategori</option>
                {opd.kategori.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Judul</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Tidak ada permohonan.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-surface/60">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.kode}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.judul}</td>
                  <td className="px-4 py-3">{p.kategori}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {fmtTanggal(p.tanggal_masuk)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        to="/permohonan/$id"
                        params={{ id: p.id }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Detail <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      {isSuperAdmin && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Hapus permohonan ${p.kode}? Riwayat, rating & berkas terkait ikut terhapus.`)) return;
                            try {
                              await deletePermohonan({ data: { id: p.id } });
                              setItems((prev) => prev.filter((x) => x.id !== p.id));
                              toast.success("Permohonan dihapus");
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          title="Hapus permohonan"
                        >
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
