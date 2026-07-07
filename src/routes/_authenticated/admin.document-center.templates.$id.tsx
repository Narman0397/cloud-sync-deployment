// Phase 3A — Template editor with placeholder picker & preview.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  docGetTemplate,
  docUpdateTemplate,
  docPublishTemplate,
  docArchiveTemplate,
  docCloneTemplate,
  docPreview,
  docListPublishedForms,
  docFormFieldsCatalog,
  docListNumberingRules,
} from "@/lib/documents.functions";
import { PLACEHOLDER_CATALOG } from "@/features/documents/placeholder/catalog";
import { ArrowLeft, Save, Send, Archive, Copy, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui-kit/StatusPill";
import { HelpHint } from "@/components/ui-kit/HelpHint";

type Tpl = {
  id: string;
  name: string;
  description: string | null;
  kind: "html" | "pdf" | "docx";
  category: string | null;
  status: string;
  current_version: number;
  template_html: string;
  numbering_rule_id: string | null;
};

type Version = { id: string; version_number: number; kind: string; created_at: string };
type Rule = { id: string; code: string; name: string; format: string };
type FormOpt = { id: string; judul: string };
type FormGroup = { category: "submission"; label: string; items: { token: string; label: string }[] };

export const Route = createFileRoute("/_authenticated/admin/document-center/templates/$id")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [preview, setPreview] = useState("");
  const [tab, setTab] = useState<"editor" | "preview" | "versions">("editor");
  const [busy, setBusy] = useState(false);
  const [forms, setForms] = useState<FormOpt[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [formGroup, setFormGroup] = useState<FormGroup | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const r = (await docGetTemplate({ data: { id } })) as unknown as {
        template: Tpl;
        versions: Version[];
      };
      setTpl(r.template);
      setVersions(r.versions);
      const rl = (await docListNumberingRules({ data: {} })) as unknown as { rows: Rule[] };
      setRules(rl.rows);
      try {
        const lf = (await docListPublishedForms({ data: {} })) as unknown as { rows: FormOpt[] };
        setForms(lf.rows);
      } catch {
        /* ignore */
      }
    })();
  }, [id]);

  async function loadFormPlaceholders(formId: string) {
    setSelectedFormId(formId);
    if (!formId) {
      setFormGroup(null);
      return;
    }
    try {
      const r = (await docFormFieldsCatalog({ data: { formId } })) as unknown as {
        group: FormGroup;
      };
      setFormGroup(r.group);
    } catch {
      setFormGroup(null);
    }
  }


  async function doPreview() {
    if (!tpl) return;
    const r = (await docPreview({
      data: { template_html: tpl.template_html },
    })) as { merged: string };
    setPreview(r.merged);
    setTab("preview");
  }

  async function save(bump = false) {
    if (!tpl) return;
    setBusy(true);
    try {
      await docUpdateTemplate({
        data: {
          id,
          name: tpl.name,
          description: tpl.description,
          kind: tpl.kind,
          category: tpl.category,
          template_html: tpl.template_html,
          numbering_rule_id: tpl.numbering_rule_id,
          bumpVersion: bump,
        },
      });
      const r = (await docGetTemplate({ data: { id } })) as unknown as {
        template: Tpl;
        versions: Version[];
      };
      setTpl(r.template);
      setVersions(r.versions);
    } finally {
      setBusy(false);
    }
  }

  function insertToken(token: string) {
    if (!tpl || !taRef.current) return;
    const ta = taRef.current;
    const start = ta.selectionStart ?? tpl.template_html.length;
    const end = ta.selectionEnd ?? tpl.template_html.length;
    const text = `{{${token}}}`;
    const next = tpl.template_html.slice(0, start) + text + tpl.template_html.slice(end);
    setTpl({ ...tpl, template_html: next });
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    }, 0);
  }

  const catalog = useMemo(() => PLACEHOLDER_CATALOG, []);

  if (!tpl)
    return (
      <div className="p-6 text-sm text-muted-foreground">Memuat…</div>
    );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/admin/document-center/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Templates
        </Link>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            tone={
              tpl.status === "active" ? "success" : tpl.status === "archived" ? "muted" : "warning"
            }
          >
            {tpl.status === "active" ? "Terbit" : tpl.status === "archived" ? "Arsip" : "Draft"}
          </StatusPill>
          <HelpHint title="Editor template">
            Tulis HTML template dan sisipkan placeholder dari panel kanan. Gunakan <strong>Pratinjau</strong> untuk melihat hasil contoh sebelum menerbitkan.
          </HelpHint>
          <button onClick={doPreview} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button onClick={() => save(false)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
            <Save className="h-3.5 w-3.5" /> Simpan
          </button>
          <button onClick={() => save(true)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
            <Plus className="h-3.5 w-3.5" /> Simpan & Versi Baru
          </button>
          <button
            onClick={async () => {
              await docCloneTemplate({ data: { id } });
              toast.success("Template berhasil diklon");
            }}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm"
          >
            <Copy className="h-3.5 w-3.5" /> Clone
          </button>
          {tpl.status !== "active" && (
            <button
              onClick={async () => {
                await docPublishTemplate({ data: { id } });
                setTpl({ ...tpl, status: "active" });
                toast.success("Template diterbitkan dan siap dipakai");
              }}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              <Send className="h-3.5 w-3.5" /> Publish
            </button>
          )}
          {tpl.status !== "archived" && (
            <button
              onClick={async () => {
                if (!confirm("Arsipkan template? Template yang diarsipkan tidak bisa dipakai untuk membuat dokumen baru.")) return;
                await docArchiveTemplate({ data: { id } });
                setTpl({ ...tpl, status: "archived" });
                toast.success("Template diarsipkan");
              }}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm"
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium">Nama</label>
          <input
            value={tpl.name}
            onChange={(e) => setTpl({ ...tpl, name: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Jenis</label>
          <select
            value={tpl.kind}
            onChange={(e) => setTpl({ ...tpl, kind: e.target.value as Tpl["kind"] })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Kategori</label>
          <input
            value={tpl.category ?? ""}
            onChange={(e) => setTpl({ ...tpl, category: e.target.value || null })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="contoh: surat-keterangan"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Numbering Rule</label>
          <select
            value={tpl.numbering_rule_id ?? ""}
            onChange={(e) => setTpl({ ...tpl, numbering_rule_id: e.target.value || null })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">— Tidak ada —</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.format}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="text-xs font-medium">Deskripsi</label>
          <input
            value={tpl.description ?? ""}
            onChange={(e) => setTpl({ ...tpl, description: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mb-2 flex gap-1 rounded-md border bg-card p-1 w-fit">
        {(["editor", "preview", "versions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1 text-xs font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "editor" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
          <div className="rounded-xl border bg-card p-2">
            <textarea
              ref={taRef}
              value={tpl.template_html}
              onChange={(e) => setTpl({ ...tpl, template_html: e.target.value })}
              className="h-[500px] w-full resize-none rounded-md bg-background p-3 font-mono text-xs"
              placeholder="<p>Halo {{submission.nama}}</p>"
            />
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Placeholder Picker
            </div>
            <div className="mb-2">
              <label className="text-[10px] uppercase text-muted-foreground">
                Form Sumber (auto-mapping field)
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => loadFormPlaceholders(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">— Pilih form published —</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.judul}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[460px] space-y-3 overflow-y-auto">
              {formGroup && formGroup.items.length > 0 && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
                  <div className="mb-1 text-[11px] font-bold uppercase text-primary">
                    {formGroup.label}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formGroup.items.map((it) => (
                      <button
                        key={it.token}
                        onClick={() => insertToken(it.token)}
                        title={it.label}
                        className="rounded border border-primary/40 bg-background px-2 py-0.5 text-[11px] font-mono hover:bg-primary hover:text-primary-foreground"
                      >
                        {it.token}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {catalog.map((g) => (
                <div key={g.category}>
                  <div className="mb-1 text-[11px] font-bold uppercase text-foreground">
                    {g.label}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((it) => (
                      <button
                        key={it.token}
                        onClick={() => insertToken(it.token)}
                        title={it.label}
                        className="rounded border px-2 py-0.5 text-[11px] font-mono hover:bg-primary hover:text-primary-foreground"
                      >
                        {it.token}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "preview" && (
        <div className="rounded-xl border bg-card p-2">
          <iframe
            title="Preview"
            className="h-[600px] w-full rounded-md bg-white"
            srcDoc={preview || "<p style='font-family:sans-serif;padding:24px;color:#666'>Klik Preview untuk merender</p>"}
          />
        </div>
      )}

      {tab === "versions" && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Versi</th>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-medium">v{v.version_number}</td>
                  <td className="px-3 py-2 uppercase text-xs">{v.kind}</td>
                  <td className="px-3 py-2 text-xs">
                    {new Date(v.created_at).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    Belum ada versi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
