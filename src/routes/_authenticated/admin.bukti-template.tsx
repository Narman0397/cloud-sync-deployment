// Super Admin — Template Global "Bukti Permohonan".
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Save, Loader2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { SuperAdminOnly } from "@/components/admin/SuperAdminOnly";
import { getBuktiTemplate, saveBuktiTemplate } from "@/lib/bukti-template.functions";

export const Route = createFileRoute("/_authenticated/admin/bukti-template")({
  head: () => ({
    meta: [
      { title: "Template Bukti Permohonan — Super Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const PLACEHOLDERS: Array<{ key: string; desc: string }> = [
  { key: "{{permohonan.kode}}", desc: "Kode unik permohonan" },
  { key: "{{permohonan.judul}}", desc: "Judul permohonan" },
  { key: "{{permohonan.kategori}}", desc: "Kategori layanan" },
  { key: "{{permohonan.tanggal_masuk}}", desc: "Tanggal pengajuan" },
  { key: "{{permohonan.deskripsi}}", desc: "Deskripsi permohonan" },
  { key: "{{pemohon.nama}}", desc: "Nama pemohon" },
  { key: "{{pemohon.nik}}", desc: "NIK pemohon" },
  { key: "{{pemohon.no_hp}}", desc: "No HP pemohon" },
  { key: "{{pemohon.alamat}}", desc: "Alamat pemohon" },
  { key: "{{pemohon.desa}}", desc: "Desa pemohon" },
  { key: "{{opd.nama}}", desc: "Nama OPD tujuan" },
  { key: "{{opd.singkatan}}", desc: "Singkatan OPD" },
  { key: "{{layanan.judul}}", desc: "Judul layanan (dari master)" },
  { key: "{{layanan.dasar_hukum}}", desc: "Dasar hukum layanan" },
  { key: "{{layanan.produk_layanan}}", desc: "Produk layanan" },
  { key: "{{sistem.tanggal_terbit}}", desc: "Tanggal bukti dicetak" },
  { key: "{{sistem.qr_verifikasi_url}}", desc: "URL verifikasi bukti (juga dijadikan QR)" },
];

function Page() {
  const get = useServerFn(getBuktiTemplate);
  const save = useServerFn(saveBuktiTemplate);
  const [html, setHtml] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await get();
        setHtml(r.html);
        setInitial(r.html);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memuat template");
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  async function onSave() {
    setBusy(true);
    try {
      await save({ data: { html } });
      setInitial(html);
      toast.success("Template global bukti permohonan disimpan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Template Bukti Permohonan" }]}>
        <SuperAdminOnly>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5" /> Template Bukti Permohonan (Global)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                Template default yang dipakai untuk semua permohonan bila layanan terkait belum
                punya template khusus. Gunakan placeholder di bawah untuk mengisi data pemohon,
                layanan, OPD, dan QR verifikasi.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs"
              >
                <Eye className="h-3.5 w-3.5" /> {showPreview ? "Sembunyikan" : "Preview"}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={busy || loading || html === initial}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Simpan
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-xl border border-border bg-card p-4">
              <label className="mb-2 block text-sm font-medium">Template HTML</label>
              {loading ? (
                <div className="grid h-96 place-items-center text-sm text-muted-foreground">
                  Memuat…
                </div>
              ) : (
                <textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={22}
                  spellCheck={false}
                  className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
                  placeholder="Tulis template HTML di sini. Kosongkan untuk pakai layout default sistem."
                />
              )}
              {showPreview && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Preview (placeholder belum di-render)
                  </div>
                  <div
                    className="prose prose-sm max-w-none rounded-md border border-border bg-surface p-4"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 text-sm font-medium">Placeholder tersedia</div>
              <p className="mb-3 text-xs text-muted-foreground">
                Klik untuk menyalin.
              </p>
              <ul className="space-y-1.5 text-xs">
                {PLACEHOLDERS.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(p.key).catch(() => {});
                        toast.success(`Disalin: ${p.key}`);
                      }}
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <code className="font-mono text-primary">{p.key}</code>
                      <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-md bg-primary-soft p-3 text-xs">
                <strong>Prioritas template:</strong>
                <ol className="mt-1 ml-4 list-decimal space-y-0.5">
                  <li>Template khusus layanan (bila diset di Jenis Layanan)</li>
                  <li>Template global ini</li>
                  <li>Layout default sistem</li>
                </ol>
              </div>
            </div>
          </div>
        </SuperAdminOnly>
      </AdminShell>
    </AdminGuard>
  );
}
