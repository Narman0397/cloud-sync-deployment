// Numbering view — dipakai di legacy /admin/documents/numbering
// dan di /admin/document-center/numbering.
import { useEffect, useState } from "react";
import {
  docListNumberingRules,
  docCreateNumberingRule,
  docUpdateNumberingRule,
  docPreviewNumbering,
} from "@/lib/documents.functions";
import { Plus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import { StatusPill } from "@/components/ui-kit/StatusPill";

type Rule = {
  id: string;
  code: string;
  name: string;
  format: string;
  scope: "global" | "per_opd" | "per_category" | "per_opd_category";
  category: string | null;
  opd_id: string | null;
  reset_period: "yearly" | "never";
  padding: number;
  status: "active" | "archived";
};

export function NumberingView() {
  const [rows, setRows] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    format: "PB-{YEAR}-{SEQ}",
    scope: "global" as Rule["scope"],
    category: "",
    reset_period: "yearly" as Rule["reset_period"],
    padding: 6,
  });
  const [preview, setPreview] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const r = (await docListNumberingRules({ data: {} })) as unknown as { rows: Rule[] };
      if (!cancelled) {
        setRows(r.rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    (async () => {
      if (!form.format) return setPreview("");
      const r = (await docPreviewNumbering({
        data: { format: form.format, padding: form.padding, category: form.category },
      })) as { preview: string };
      setPreview(r.preview);
    })();
  }, [form.format, form.padding, form.category]);

  async function onCreate() {
    if (form.code.length < 2 || form.name.length < 3 || form.format.length < 3)
      return alert("Lengkapi field");
    await docCreateNumberingRule({
      data: {
        code: form.code,
        name: form.name,
        format: form.format,
        scope: form.scope,
        category: form.category || undefined,
        reset_period: form.reset_period,
        padding: form.padding,
      },
    });
    setOpen(false);
    setTick((t) => t + 1);
  }

  async function toggleArchive(r: Rule) {
    await docUpdateNumberingRule({
      data: { id: r.id, status: r.status === "active" ? "archived" : "active" },
    });
    setTick((t) => t + 1);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Penomoran"
        title="Aturan Nomor Surat"
        description="Atur format nomor surat otomatis untuk setiap jenis dokumen, OPD, atau kategori."
        actions={
          <div className="flex items-center gap-2">
            <HelpHint title="Apa itu aturan penomoran?">
              Pola otomatis yang dipakai saat dokumen baru dibuat — contoh: <code>PB-{"{YEAR}"}-{"{SEQ}"}</code> akan menghasilkan <code>PB-2026-000001</code>. Nomor urut akan reset sesuai pengaturan.
            </HelpHint>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Aturan Baru
            </button>
          </div>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Reset</th>
              <th className="px-3 py-2">Pad</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Belum ada rule.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.format}</td>
                <td className="px-3 py-2 text-xs">{r.scope}</td>
                <td className="px-3 py-2 text-xs">{r.reset_period}</td>
                <td className="px-3 py-2 text-xs">{r.padding}</td>
                <td className="px-3 py-2 text-xs">
                  <StatusPill tone={r.status === "active" ? "success" : "muted"}>
                    {r.status === "active" ? "Aktif" : "Arsip"}
                  </StatusPill>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleArchive(r)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
                    {r.status === "active" ? "Arsipkan" : "Aktifkan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-elevated">
            <h3 className="mb-3 font-display text-lg font-bold">Rule Baru</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Kode</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Nama</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium">Format</label>
                <input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm" placeholder="PB-{YEAR}-{SEQ}" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Token: {"{YEAR} {MONTH} {SEQ} {OPD} {OPD_CODE} {CATEGORY}"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">Scope</label>
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Rule["scope"] })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="global">Global</option>
                  <option value="per_opd">Per OPD</option>
                  <option value="per_category">Per Kategori</option>
                  <option value="per_opd_category">Per OPD + Kategori</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Reset</label>
                <select value={form.reset_period} onChange={(e) => setForm({ ...form, reset_period: e.target.value as Rule["reset_period"] })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="yearly">Tahunan</option>
                  <option value="never">Tidak Pernah</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Padding</label>
                <input type="number" min={1} max={12} value={form.padding} onChange={(e) => setForm({ ...form, padding: parseInt(e.target.value, 10) || 6 })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Kategori (opsional)</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-3 rounded-md bg-muted/40 p-2 font-mono text-xs">Preview: {preview}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-sm">Batal</button>
              <button onClick={onCreate} className="rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
