// Pengaturan Jabatan Sistem — daftar 10 jabatan bawaan aplikasi yang selalu
// tersinkron dengan master_jabatan. Baris ini dilindungi trigger DB agar
// tidak dapat dihapus dan kode/klasifikasinya tidak berubah — tetap tersedia
// meskipun kode project dipindah ke repositori lain.
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, ShieldCheck, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { SuperAdminOnly } from "@/components/admin/SuperAdminOnly";
import { POSITION_LABEL, type SystemPosition } from "@/features/rbac/constants";
import { listSystemJabatan, upsertMasterJabatan } from "@/lib/master-jabatan.functions";

export const Route = createFileRoute("/_authenticated/admin/system/jabatan-sistem")({
  head: () => ({
    meta: [
      { title: "Jabatan Sistem — Pengaturan Sistem" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminGuard>
      <SuperAdminOnly>
        <Page />
      </SuperAdminOnly>
    </AdminGuard>
  ),
});

type Row = {
  id: string;
  kode: string;
  nama: string;
  kategori: string | null;
  system_position: SystemPosition | null;
  urutan: number;
  aktif: boolean;
  is_system: boolean;
};

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listSystemJabatan();
      setRows((r.rows as Row[]) ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!editing) return;
    try {
      await upsertMasterJabatan({
        data: {
          id: editing.id,
          kode: editing.kode,
          nama: editing.nama,
          kategori: editing.kategori,
          system_position: editing.system_position,
          urutan: editing.urutan,
          aktif: editing.aktif,
        },
      });
      toast.success("Disimpan");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AdminShell
      breadcrumb={[{ label: "Pengaturan Sistem", to: "/admin/sistem" }, { label: "Jabatan Sistem" }]}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Jabatan Sistem</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Jabatan bawaan aplikasi yang selalu tersinkron dengan master jabatan. Baris ini tidak
            bisa dihapus dan kode/klasifikasinya dikunci agar sistem tetap konsisten meskipun kode
            project dipindah ke repositori lain. Anda tetap dapat menyesuaikan nama, kategori,
            urutan, dan status aktif.
          </p>
        </div>
        <Link
          to="/admin/master-jabatan"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
        >
          Master Jabatan lengkap <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/40 px-3 py-2 text-xs text-primary">
        <ShieldCheck className="h-4 w-4" />
        Terdapat <b className="mx-1">{rows.length}</b> jabatan sistem terdaftar. Dilindungi oleh
        trigger database.
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Kode</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-left">Klasifikasi ASN</th>
                <th className="px-3 py-2 text-left">Urutan</th>
                <th className="px-3 py-2 text-left">Aktif</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{r.kode}</td>
                  <td className="px-3 py-2 font-medium">{r.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.kategori ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.system_position ? POSITION_LABEL[r.system_position] : "—"}
                  </td>
                  <td className="px-3 py-2">{r.urutan}</td>
                  <td className="px-3 py-2">{r.aktif ? "Ya" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      className="rounded p-1 hover:bg-muted"
                      title="Ubah nama / kategori / urutan / aktif"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-1 font-display text-lg font-bold">Ubah Jabatan Sistem</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Kode dan klasifikasi ASN dikunci. Perubahan lain akan langsung tercermin di master
              jabatan.
            </p>
            <div className="grid gap-3 text-sm">
              <label className="grid gap-1">
                <span>Kode</span>
                <input
                  className="h-9 rounded-md border border-border bg-muted px-3 opacity-60"
                  value={editing.kode}
                  disabled
                />
              </label>
              <label className="grid gap-1">
                <span>Klasifikasi ASN</span>
                <input
                  className="h-9 rounded-md border border-border bg-muted px-3 opacity-60"
                  value={editing.system_position ? POSITION_LABEL[editing.system_position] : "—"}
                  disabled
                />
              </label>
              <label className="grid gap-1">
                <span>Nama</span>
                <input
                  className="h-9 rounded-md border border-border bg-surface px-3"
                  value={editing.nama}
                  onChange={(e) => setEditing({ ...editing, nama: e.target.value })}
                />
              </label>
              <label className="grid gap-1">
                <span>Kategori</span>
                <input
                  className="h-9 rounded-md border border-border bg-surface px-3"
                  value={editing.kategori ?? ""}
                  onChange={(e) => setEditing({ ...editing, kategori: e.target.value })}
                />
              </label>
              <label className="grid gap-1">
                <span>Urutan</span>
                <input
                  type="number"
                  className="h-9 rounded-md border border-border bg-surface px-3"
                  value={editing.urutan}
                  onChange={(e) => setEditing({ ...editing, urutan: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.aktif}
                  onChange={(e) => setEditing({ ...editing, aktif: e.target.checked })}
                />
                Aktif
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="h-9 rounded-md border border-border px-3 text-sm"
              >
                Batal
              </button>
              <button
                onClick={save}
                className="h-9 rounded-md bg-gradient-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
