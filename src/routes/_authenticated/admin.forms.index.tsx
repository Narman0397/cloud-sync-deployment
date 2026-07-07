// /admin/forms — daftar Forms standalone (dipisah dari Form Builder).
// Konten = list Forms (sama dengan halaman lama di hub Form Builder), tapi
// dibungkus AdminGuard + AdminShell sendiri agar muncul sebagai entry sidebar
// terpisah dari grup "Berbagi Data".
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  fbListForms,
  fbCloneForm,
  fbArchiveForm,
  fbCreateFromTemplate,
  fbListTemplates,
} from "@/lib/form-builder.functions";
import { publishForm } from "@/lib/forms.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Archive,
  Copy,
  ExternalLink,
  FileText,
  LayoutTemplate,
  Plus,
  Send,
  Search,
} from "lucide-react";

const TAB_VALUES = ["all", "my_opd", "draft", "published", "archived"] as const;
type TabValue = (typeof TAB_VALUES)[number];
const EMPLOYMENT_VALUES = ["", "PNS", "PPPK", "PPPK_PW", "NON_ASN"] as const;
type EmploymentFilter = (typeof EMPLOYMENT_VALUES)[number];

const searchSchema = z.object({
  tab: z.enum(TAB_VALUES).catch("all").default("all"),
  q: z.string().max(120).catch("").default(""),
  category: z.string().max(80).catch("").default(""),
  opdId: z.string().catch("").default(""),
  employmentType: z.enum(EMPLOYMENT_VALUES).catch("").default(""),
  page: z.number().int().min(1).catch(1).default(1),
});

export const Route = createFileRoute("/_authenticated/admin/forms/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Forms — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Forms" }]}>
        <FormsPage />
      </AdminShell>
    </AdminGuard>
  ),
});

type Row = {
  id: string;
  code: string | null;
  judul: string;
  category: string | null;
  status: string;
  opd_pemilik_id: string | null;
  allowed_employee_types: string[];
  version_number: number;
  deadline: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Opd = { id: string; nama: string; singkatan: string };
type Template = { id: string; name: string; category: string | null; scope: string };

function FormsPage() {
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  const { isSuperAdmin, isAdminPemda } = useAuth();
  const isElevated = isSuperAdmin || isAdminPemda;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opdList, setOpdList] = useState<Opd[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showFromTpl, setShowFromTpl] = useState(false);
  const [tick, setTick] = useState(0);

  const pageSize = 20;
  const page0 = search.page - 1;

  useEffect(() => {
    void supabase
      .from("opd")
      .select("id,nama,singkatan")
      .order("nama")
      .then(({ data }) => setOpdList((data ?? []) as Opd[]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = (await fbListForms({
          data: {
            tab: search.tab,
            search: search.q || undefined,
            category: search.category || undefined,
            opdId: search.opdId || undefined,
            employmentType: search.employmentType || undefined,
            page: page0,
            pageSize,
          },
        })) as { rows: Row[]; total: number };
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    search.tab,
    search.q,
    search.category,
    search.opdId,
    search.employmentType,
    page0,
    tick,
  ]);

  function updateSearch(patch: Partial<typeof search>) {
    void nav({
      search: (prev: Record<string, unknown>) => ({ ...(prev ?? {}), ...patch }),
      replace: true,
    });
  }

  async function openTemplatePicker() {
    setShowFromTpl(true);
    if (templates.length === 0) {
      const list = (await fbListTemplates({
        data: { status: "published" },
      })) as Template[];
      setTemplates(list);
    }
  }

  async function onClone(id: string) {
    if (!confirm("Salin form ini menjadi draft baru?")) return;
    try {
      const r = (await fbCloneForm({ data: { id } })) as { id: string };
      setTick((t) => t + 1);
      void nav({ to: "/admin/forms/$id", params: { id: r.id } });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyalin");
    }
  }

  async function onArchive(id: string) {
    if (!confirm("Arsipkan form ini? Form tidak akan dapat diisi lagi.")) return;
    try {
      await fbArchiveForm({ data: { id } });
      setTick((t) => t + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal mengarsipkan");
    }
  }

  async function onPublish(id: string) {
    if (!confirm("Publish form ini sekarang?")) return;
    try {
      await publishForm({ data: { id } });
      setTick((t) => t + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal publish");
    }
  }

  const opdMap = useMemo(() => new Map(opdList.map((o) => [o.id, o.singkatan])), [opdList]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">Forms</h2>
        <p className="text-sm text-muted-foreground">
          Daftar form yang tersedia. Untuk membuat form baru gunakan{" "}
          <Link to="/admin/form-builder/wizard" className="underline">
            Form Builder
          </Link>
          .
        </p>
      </div>
      <div className="mb-4 overflow-x-auto">
        <div className="inline-flex gap-1 rounded-md border border-border bg-card p-1">
          {(
            [
              ["all", "Semua"],
              ["my_opd", "OPD Saya"],
              ["draft", "Draft"],
              ["published", "Published"],
              ["archived", "Diarsip"],
            ] as Array<[TabValue, string]>
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateSearch({ tab: val, page: 1 })}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold ${
                search.tab === val
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-2 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search.q}
              onChange={(e) => updateSearch({ q: e.target.value, page: 1 })}
              placeholder="Cari nama, kode, kategori…"
              className="h-9 w-64 rounded-md border border-border bg-background pl-7 pr-2 text-sm"
            />
          </div>
          <input
            value={search.category}
            onChange={(e) => updateSearch({ category: e.target.value, page: 1 })}
            placeholder="Kategori"
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm"
          />
          <select
            value={search.employmentType}
            onChange={(e) =>
              updateSearch({ employmentType: e.target.value as EmploymentFilter, page: 1 })
            }
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Semua Tipe Pegawai</option>
            <option value="PNS">PNS</option>
            <option value="PPPK">PPPK</option>
            <option value="PPPK_PW">PPPK PW</option>
            <option value="NON_ASN">Non-ASN</option>
          </select>
          {isElevated && (
            <select
              value={search.opdId}
              onChange={(e) => updateSearch({ opdId: e.target.value, page: 1 })}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Semua OPD</option>
              {opdList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.singkatan}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            onClick={openTemplatePicker}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <LayoutTemplate className="h-4 w-4" /> Dari Template
          </button>
          <Link
            to="/admin/form-builder/wizard"
            search={{ new: true }}
            className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <Plus className="h-4 w-4" /> Form Baru
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">OPD</th>
                <th className="px-3 py-2">Tipe Pegawai</th>
                <th className="px-3 py-2">Versi</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Tidak ada form yang cocok dengan filter.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.judul}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.category ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.opd_pemilik_id ? (opdMap.get(r.opd_pemilik_id) ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(r.allowed_employee_types ?? []).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
                        >
                          {t}
                        </span>
                      ))}
                      {(!r.allowed_employee_types || r.allowed_employee_types.length === 0) && (
                        <span className="text-[10px] text-muted-foreground">semua</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">v{r.version_number}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        r.status === "published"
                          ? "bg-success/15 text-success"
                          : r.status === "archived"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to="/admin/forms/$id"
                        params={{ id: r.id }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <ExternalLink className="h-3 w-3" /> Buka
                      </Link>
                      {r.status === "draft" && (
                        <button
                          onClick={() => void onPublish(r.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          title="Publish"
                        >
                          <Send className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => void onClone(r.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        title="Salin"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {r.status !== "archived" && (
                        <button
                          onClick={() => void onArchive(r.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          title="Arsipkan"
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page0}
          pageSize={pageSize}
          total={total}
          loading={loading}
          onPageChange={(p) => updateSearch({ page: p + 1 })}
          onPageSizeChange={() => {}}
        />
      </div>

      {showFromTpl && (
        <FromTemplateDialog
          templates={templates}
          onClose={() => setShowFromTpl(false)}
          onCreated={(id) => {
            setShowFromTpl(false);
            void nav({ to: "/admin/forms/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}

function FromTemplateDialog({
  templates,
  onClose,
  onCreated,
}: {
  templates: Template[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = (await fbCreateFromTemplate({
        data: { templateId: selected },
      })) as { id: string };
      onCreated(r.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-elevated">
        <h3 className="mb-3 font-display text-lg font-bold">Buat dari Template</h3>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada template yang dipublish. Buka tab <strong>Templates</strong> di Form Builder untuk membuat.
          </p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {templates.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${
                  selected === t.id ? "border-primary bg-primary-soft" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="tpl"
                  checked={selected === t.id}
                  onChange={() => setSelected(t.id)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.category ?? "—"} · {t.scope}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Tutup
          </button>
          <button
            onClick={() => void submit()}
            disabled={!selected || busy}
            className="rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            Buat
          </button>
        </div>
      </div>
    </div>
  );
}
