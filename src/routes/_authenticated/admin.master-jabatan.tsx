// CRUD Master Jabatan (super_admin / admin_pemda) + pengaturan RBAC per jabatan.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { POSITION_LABEL, POSITIONS, type SystemPosition } from "@/features/rbac/constants";
import {
  listMasterJabatan,
  upsertMasterJabatan,
  deleteMasterJabatan,
  listPermissionsCatalog,
  listJabatanPermissions,
  setJabatanPermissions,
} from "@/lib/master-jabatan.functions";

export const Route = createFileRoute("/_authenticated/admin/master-jabatan")({
  head: () => ({
    meta: [{ title: "Master Jabatan — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <Page />
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
  is_system?: boolean;
};

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [rbacFor, setRbacFor] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listMasterJabatan();
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
          kode: (editing.kode ?? "").toUpperCase(),
          nama: editing.nama ?? "",
          kategori: editing.kategori ?? null,
          system_position: editing.system_position ?? null,
          urutan: editing.urutan ?? 0,
          aktif: editing.aktif ?? true,
        },
      });
      toast.success("Disimpan");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function remove(id: string) {
    if (!confirm("Hapus jabatan ini?")) return;
    try {
      await deleteMasterJabatan({ data: { id } });
      toast.success("Dihapus");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AdminShell breadcrumb={[{ label: "Master Jabatan" }]}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Master Jabatan</h1>
          <p className="text-sm text-muted-foreground">
            Daftar jabatan ASN yang dapat dipilih saat registrasi & approval.
          </p>
        </div>
        <button
          onClick={() => setEditing({ kode: "", nama: "", urutan: rows.length * 10 + 10, aktif: true })}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-gradient-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Tambah Jabatan
        </button>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
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
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.kode}
                    {r.is_system && (
                      <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        Sistem
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.nama}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.kategori ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.system_position ? POSITION_LABEL[r.system_position] : "—"}
                  </td>
                  <td className="px-3 py-2">{r.urutan}</td>
                  <td className="px-3 py-2">{r.aktif ? "Ya" : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setRbacFor(r)}
                        title="Atur RBAC jabatan ini"
                        className="rounded p-1 text-primary hover:bg-primary-soft"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-muted">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => !r.is_system && remove(r.id)}
                        disabled={r.is_system}
                        title={r.is_system ? "Jabatan sistem tidak dapat dihapus" : "Hapus"}
                        className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
            <h2 className="mb-3 font-display text-lg font-bold">
              {editing.id ? "Ubah" : "Tambah"} Jabatan
            </h2>
            <div className="grid gap-3 text-sm">
              {editing.is_system && (
                <div className="rounded-md border border-primary/30 bg-primary-soft/50 px-3 py-2 text-xs text-primary">
                  Jabatan sistem — kode & klasifikasi ASN dikunci agar tetap sinkron dengan
                  sistem. Anda tetap dapat mengubah nama, kategori, urutan, dan status aktif.
                </div>
              )}
              <label className="grid gap-1">
                <span>Kode (huruf besar / angka / _)</span>
                <input
                  className="h-9 rounded-md border border-border bg-surface px-3 disabled:opacity-60"
                  value={editing.kode ?? ""}
                  disabled={Boolean(editing.is_system)}
                  onChange={(e) => setEditing({ ...editing, kode: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="grid gap-1">
                <span>Nama</span>
                <input
                  className="h-9 rounded-md border border-border bg-surface px-3"
                  value={editing.nama ?? ""}
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
                <span>Klasifikasi ASN otomatis</span>
                <select
                  className="h-9 rounded-md border border-border bg-surface px-3 disabled:opacity-60"
                  value={editing.system_position ?? ""}
                  disabled={Boolean(editing.is_system)}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      system_position: (e.target.value || null) as SystemPosition | null,
                    })
                  }
                >
                  <option value="">Deteksi otomatis dari nama jabatan</option>
                  {Object.values(POSITIONS).map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span>Urutan</span>
                <input
                  type="number"
                  className="h-9 rounded-md border border-border bg-surface px-3"
                  value={editing.urutan ?? 0}
                  onChange={(e) => setEditing({ ...editing, urutan: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.aktif ?? true}
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

      {rbacFor && (
        <JabatanRbacDialog
          jabatan={rbacFor}
          onClose={() => setRbacFor(null)}
        />
      )}
    </AdminShell>
  );
}

type PermCatalog = { code: string; label: string; kategori: string; description: string | null };

function JabatanRbacDialog({ jabatan, onClose }: { jabatan: Row; onClose: () => void }) {
  const [catalog, setCatalog] = useState<PermCatalog[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, cur] = await Promise.all([
          listPermissionsCatalog(),
          listJabatanPermissions({ data: { jabatan_id: jabatan.id } }),
        ]);
        if (cancelled) return;
        setCatalog((c.rows as PermCatalog[]) ?? []);
        setSelected(new Set(cur.codes ?? []));
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jabatan.id]);

  const grouped = useMemo(() => {
    const m = new Map<string, PermCatalog[]>();
    const q = filter.trim().toLowerCase();
    for (const p of catalog ?? []) {
      if (
        q &&
        !p.code.toLowerCase().includes(q) &&
        !(p.label ?? "").toLowerCase().includes(q) &&
        !(p.kategori ?? "").toLowerCase().includes(q)
      )
        continue;
      const k = p.kategori ?? "Lainnya";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog, filter]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function toggleCategory(items: PermCatalog[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of items) {
        if (on) next.add(p.code);
        else next.delete(p.code);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await setJabatanPermissions({
        data: { jabatan_id: jabatan.id, codes: Array.from(selected) },
      });
      toast.success("Permission jabatan tersimpan");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-bold">RBAC — {jabatan.nama}</h2>
            <p className="text-xs text-muted-foreground">
              Kode <span className="font-mono">{jabatan.kode}</span>
              {jabatan.system_position && (
                <> · Klasifikasi {POSITION_LABEL[jabatan.system_position]}</>
              )}
              {" · "}
              Permission yang dicentang otomatis berlaku untuk seluruh ASN yang memegang jabatan
              ini.
            </p>
          </div>
          <div className="text-xs">
            <span className="rounded-full bg-primary-soft px-2 py-1 font-semibold text-primary">
              {selected.size} aktif
            </span>
          </div>
        </div>
        <div className="border-b border-border p-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari permission…"
            className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {catalog === null ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Tidak ada permission cocok.
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([kategori, items]) => {
                const allOn = items.every((p) => selected.has(p.code));
                return (
                  <div key={kategori}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {kategori}
                      </h3>
                      <button
                        type="button"
                        onClick={() => toggleCategory(items, !allOn)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {allOn ? "Kosongkan" : "Pilih semua"}
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((p) => {
                        const on = selected.has(p.code);
                        return (
                          <label
                            key={p.code}
                            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition ${
                              on
                                ? "border-primary bg-primary-soft/40"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(p.code)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{p.label || p.code}</div>
                              <div className="truncate font-mono text-[10px] text-muted-foreground">
                                {p.code}
                              </div>
                              {p.description && (
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {p.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-border px-3 text-sm"
            disabled={saving}
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving || catalog === null}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-gradient-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Permission
          </button>
        </div>
      </div>
    </div>
  );
}
