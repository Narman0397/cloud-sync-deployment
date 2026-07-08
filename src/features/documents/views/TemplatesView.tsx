// Templates view — dipakai di legacy /admin/documents/templates
// dan di /admin/document-center/templates.
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { docListTemplates, docCreateTemplate } from "@/lib/documents.functions";
import { Plus, FileText, ExternalLink, Loader2, FileUp } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import { StatusPill } from "@/components/ui-kit/StatusPill";
import { WordImportDialog } from "@/features/documents/import/WordImportDialog";

type Row = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  category: string | null;
  status: string;
  current_version: number;
  updated_at: string;
};

export function TemplatesView() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"html" | "pdf" | "docx">("html");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = (await docListTemplates({ data: {} })) as unknown as { rows: Row[] };
        if (!cancelled) setRows(r.rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function onCreate() {
    if (name.trim().length < 3) return alert("Nama minimal 3 karakter");
    setBusy(true);
    try {
      const r = (await docCreateTemplate({
        data: { name: name.trim(), kind, template_html: "<p>Halo {{submission.nama}}</p>" },
      })) as { id: string };
      setOpenNew(false);
      setName("");
      nav({ to: "/admin/document-center/templates/$id", params: { id: r.id } });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Template"
        title="Pustaka Template Dokumen"
        description="Template adalah cetakan dokumen dengan placeholder (mis. {{submission.nama}}) yang akan otomatis terisi saat dokumen dibuat."
        actions={
          <div className="flex items-center gap-2">
            <HelpHint title="Apa itu template?">
              Template menentukan tampilan dan isi dokumen. Setelah <strong>Terbitkan</strong>, template dapat dipakai untuk membuat dokumen baru lewat Wizard.
            </HelpHint>
            <button
              onClick={() => setOpenImport(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              <FileUp className="h-4 w-4" /> Impor dari Word
            </button>
            <button
              onClick={() => setOpenNew(true)}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
            >
              <Plus className="h-4 w-4" /> Template Baru
            </button>
          </div>
        }
      />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Versi</th>
                <th className="px-3 py-2">Diubah</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Belum ada template.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {r.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 uppercase text-xs">{r.kind}</td>
                  <td className="px-3 py-2 text-xs">{r.category ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusPill
                      tone={r.status === "active" ? "success" : r.status === "archived" ? "muted" : "warning"}
                    >
                      {r.status === "active" ? "Terbit" : r.status === "archived" ? "Arsip" : "Draft"}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2 text-xs">v{r.current_version}</td>
                  <td className="px-3 py-2 text-xs">{new Date(r.updated_at).toLocaleDateString("id-ID")}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/document-center/templates/$id"
                      params={{ id: r.id }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3" /> Buka
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button onClick={() => setTick((t) => t + 1)} className="hidden" />

      {openNew && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-elevated">
            <h3 className="mb-3 font-display text-lg font-bold">Template Baru</h3>
            <label className="text-xs font-medium">Nama Template</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="contoh: Surat Keterangan"
            />
            <label className="mt-3 block text-xs font-medium">Jenis</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "html" | "pdf" | "docx")}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="html">HTML</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpenNew(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">
                Batal
              </button>
              <button
                onClick={onCreate}
                disabled={busy}
                className="rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                {busy ? "Membuat…" : "Buat Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openImport && (
        <WordImportDialog
          onClose={() => setOpenImport(false)}
          onCreated={(id) => {
            setOpenImport(false);
            nav({ to: "/admin/document-center/templates/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}
