// Dialog impor template dari file .docx. Semua parsing dijalankan di browser.
// Alur: upload -> mammoth ekstrak HTML+teks -> deteksi label -> user konfirmasi
// -> ganti nilai jadi placeholder token {{...}} di HTML -> simpan via docCreateTemplate.
import { useMemo, useState } from "react";
import mammoth from "mammoth/mammoth.browser";
import { Loader2, Upload, FileText, Wand2 } from "lucide-react";
import { detectMappings, type DetectedRow } from "./label-catalog";
import { PLACEHOLDER_CATALOG } from "@/features/documents/placeholder/catalog";
import { docCreateTemplate } from "@/lib/documents.functions";

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

type Row = DetectedRow & { enabled: boolean; chosenToken: string };

const ALL_TOKENS = PLACEHOLDER_CATALOG.flatMap((g) =>
  g.items.map((i) => ({ token: i.token, label: `${g.label} — ${i.label}` })),
);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function WordImportDialog({ onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [html, setHtml] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledCount = useMemo(() => rows.filter((r) => r.enabled && r.chosenToken).length, [rows]);

  async function onFile(f: File) {
    setError(null);
    if (!f.name.toLowerCase().endsWith(".docx")) {
      setError("Hanya format .docx yang didukung. Simpan file .doc lama sebagai .docx.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10 MB.");
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.docx$/i, ""));
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const [htmlRes, textRes] = await Promise.all([
        mammoth.convertToHtml({ arrayBuffer: buf }),
        mammoth.extractRawText({ arrayBuffer: buf }),
      ]);
      setHtml(htmlRes.value);
      const detected = detectMappings(textRes.value);
      setRows(
        detected.map((d) => ({
          ...d,
          enabled: d.suggestedToken != null,
          chosenToken: d.suggestedToken ?? "",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca file");
    } finally {
      setParsing(false);
    }
  }

  function tokenizeHtml(): string {
    let out = html;
    for (const r of rows) {
      if (!r.enabled || !r.chosenToken) continue;
      const escaped = escapeHtml(r.value);
      const token = `{{${r.chosenToken}}}`;
      // Replace escaped value first (as it appears in HTML), fall back to raw.
      const reEsc = new RegExp(escapeRegExp(escaped), "g");
      if (reEsc.test(out)) {
        out = out.replace(reEsc, token);
      } else {
        out = out.replace(new RegExp(escapeRegExp(r.value), "g"), token);
      }
    }
    return out;
  }

  async function onSave() {
    if (!file) return setError("Pilih file terlebih dahulu");
    if (name.trim().length < 3) return setError("Nama template minimal 3 karakter");
    setSaving(true);
    setError(null);
    try {
      const finalHtml = tokenizeHtml();
      const r = (await docCreateTemplate({
        data: {
          name: name.trim(),
          category: category.trim() || undefined,
          kind: "html",
          template_html: finalHtml,
          description: `Diimpor dari ${file.name}`,
        },
      })) as { id: string };
      onCreated(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Impor Template dari Word</h3>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Tutup
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!file && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background p-8 text-sm text-muted-foreground hover:bg-muted/40">
              <Upload className="h-6 w-6" />
              <span>Klik untuk memilih file .docx (maks 10 MB)</span>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
              />
            </label>
          )}

          {file && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium">Nama Template</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Kategori</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="opsional"
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                File: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
              </div>

              {parsing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memproses dokumen…
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold">Saran Pemetaan Placeholder</h4>
                      <span className="text-xs text-muted-foreground">
                        ({enabledCount} dari {rows.length} akan diterapkan)
                      </span>
                    </div>
                    {rows.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        Tidak ada baris <code>Label : Nilai</code> terdeteksi. Anda tetap bisa menyimpan
                        template lalu menyunting placeholder manual di editor.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-md border border-border">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted/40 text-left">
                            <tr>
                              <th className="w-8 px-2 py-1.5"></th>
                              <th className="px-2 py-1.5">Label</th>
                              <th className="px-2 py-1.5">Nilai Ditemukan</th>
                              <th className="px-2 py-1.5">Placeholder</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {rows.map((r, idx) => (
                              <tr key={idx} className={r.enabled ? "" : "opacity-50"}>
                                <td className="px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={r.enabled}
                                    onChange={(e) =>
                                      setRows((prev) =>
                                        prev.map((x, i) =>
                                          i === idx ? { ...x, enabled: e.target.checked } : x,
                                        ),
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-2 py-1.5 font-medium">{r.label}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">
                                  <span className="line-clamp-1">{r.value}</span>
                                </td>
                                <td className="px-2 py-1.5">
                                  <select
                                    value={r.chosenToken}
                                    onChange={(e) =>
                                      setRows((prev) =>
                                        prev.map((x, i) =>
                                          i === idx
                                            ? {
                                                ...x,
                                                chosenToken: e.target.value,
                                                enabled: e.target.value ? x.enabled : false,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                    className="h-7 w-full rounded border border-border bg-background px-1 text-xs"
                                  >
                                    <option value="">— tidak dipetakan —</option>
                                    {ALL_TOKENS.map((t) => (
                                      <option key={t.token} value={t.token}>
                                        {t.token}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <details className="rounded-md border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                      Preview Isi Dokumen
                    </summary>
                    <div
                      className="prose prose-sm max-w-none px-3 py-2 text-xs"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </details>
                </>
              )}
            </>
          )}

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            disabled={saving}
          >
            Batal
          </button>
          <button
            onClick={() => void onSave()}
            disabled={!file || parsing || saving}
            className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? "Menyimpan…" : "Simpan sebagai Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
