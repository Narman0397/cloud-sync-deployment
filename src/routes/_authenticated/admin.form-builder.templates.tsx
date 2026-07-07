// Templates tab — list, filter, dan aksi siklus hidup (Pakai, Terbitkan, Arsipkan).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  fbListTemplates,
  fbCreateTemplate,
  fbCreateFromTemplate,
  fbPublishTemplate,
  fbArchiveTemplate,
} from "@/lib/form-builder.functions";
import { useAuth } from "@/lib/auth-context";
import { LayoutTemplate, Plus, FilePlus2, CheckCircle2, Archive, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatusPill } from "@/components/ui-kit/StatusPill";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import { EmptyState } from "@/components/ui-kit/EmptyState";

export const Route = createFileRoute("/_authenticated/admin/form-builder/templates")({
  head: () => ({
    meta: [{ title: "Templates — Form Builder" }, { name: "robots", content: "noindex" }],
  }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  scope: string;
  status: string;
  allowed_employee_types: string[];
  updated_at: string;
};

type Tab = "all" | "draft" | "published" | "archived";

function TemplatesPage() {
  const { isSuperAdmin, isAdminPemda } = useAuth();
  const isElevated = isSuperAdmin || isAdminPemda;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const listFn = useServerFn(fbListTemplates);
  const useFn = useServerFn(fbCreateFromTemplate);
  const pubFn = useServerFn(fbPublishTemplate);
  const arcFn = useServerFn(fbArchiveTemplate);

  const q = useQuery({
    queryKey: ["fb-tpl", tab, search],
    queryFn: () =>
      listFn({
        data: {
          status: tab === "all" ? undefined : tab,
          search: search || undefined,
        },
      }) as Promise<Template[]>,
  });
  const items = q.data ?? [];

  const useMut = useMutation({
    mutationFn: (id: string) => useFn({ data: { templateId: id } }),
    onSuccess: (r) => {
      toast.success("Form baru dibuat dari template");
      navigate({ to: "/admin/forms/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pubMut = useMutation({
    mutationFn: (id: string) => pubFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template diterbitkan");
      qc.invalidateQueries({ queryKey: ["fb-tpl"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const arcMut = useMutation({
    mutationFn: (id: string) => arcFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template diarsipkan");
      qc.invalidateQueries({ queryKey: ["fb-tpl"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const all = items.length;
    return {
      all,
      draft: items.filter((t) => t.status === "draft").length,
      published: items.filter((t) => t.status === "published").length,
      archived: items.filter((t) => t.status === "archived").length,
    };
  }, [items]);

  return (
    <div>
      <PageHeader
        eyebrow="Form Builder"
        title="Pustaka Template"
        description="Hemat waktu dengan memulai form baru dari template yang sudah disusun. Template global dibuat Super Admin / Admin Pemda."
        actions={
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <Plus className="h-4 w-4" /> Template Baru
          </button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {(["all", "draft", "published", "archived"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {labelFor(t)}{" "}
              <span className="ml-1 text-[10px] opacity-70">({counts[t]})</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode…"
            className="h-9 w-64 rounded-md border border-border bg-background pl-7 pr-2 text-sm"
          />
        </div>
        <HelpHint title="Cara pakai template">
          Klik <strong>Pakai</strong> untuk membuat form baru dari template. Anda akan diarahkan ke editor form yang siap diatur lebih lanjut.
        </HelpHint>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Belum ada template"
          description="Buat template baru untuk memulai, atau gunakan tombol di pojok kanan atas."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => {
            const busy =
              (useMut.isPending && useMut.variables === t.id) ||
              (pubMut.isPending && pubMut.variables === t.id) ||
              (arcMut.isPending && arcMut.variables === t.id);
            const canPublish = t.status === "draft";
            const canArchive = t.status !== "archived";
            const canUse = t.status === "published";
            return (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate font-display font-semibold">{t.name}</span>
                    </div>
                    {t.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    ) : null}
                  </div>
                  <StatusPill tone={statusTone(t.status)}>{statusLabel(t.status)}</StatusPill>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{t.category ?? "Umum"}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                      t.scope === "global" ? "bg-primary-soft text-primary" : "bg-muted"
                    }`}
                  >
                    {t.scope}
                  </span>
                  <span className="ml-auto">
                    Diperbarui {new Date(t.updated_at).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    disabled={!canUse || busy}
                    onClick={() => useMut.mutate(t.id)}
                    title={canUse ? "Buat form baru dari template ini" : "Terbitkan template terlebih dahulu"}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {useMut.isPending && useMut.variables === t.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FilePlus2 className="h-3 w-3" />
                    )}
                    Pakai
                  </button>
                  {canPublish && (
                    <button
                      disabled={busy}
                      onClick={() => pubMut.mutate(t.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Terbitkan
                    </button>
                  )}
                  {canArchive && (
                    <button
                      disabled={busy}
                      onClick={() => arcMut.mutate(t.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <Archive className="h-3 w-3" /> Arsipkan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewTemplateDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            qc.invalidateQueries({ queryKey: ["fb-tpl"] });
          }}
          isElevated={isElevated}
        />
      )}
    </div>
  );
}

function labelFor(t: Tab): string {
  return { all: "Semua", draft: "Draft", published: "Terbit", archived: "Arsip" }[t];
}
function statusTone(s: string) {
  if (s === "published") return "success" as const;
  if (s === "draft") return "muted" as const;
  if (s === "archived") return "warning" as const;
  return "neutral" as const;
}
function statusLabel(s: string) {
  return { draft: "Draft", published: "Terbit", archived: "Arsip" }[s] ?? s;
}

function NewTemplateDialog({
  onClose,
  onCreated,
  isElevated,
}: {
  onClose: () => void;
  onCreated: () => void;
  isElevated: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState<"opd" | "global">("opd");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (name.trim().length < 3) return alert("Nama minimal 3 karakter");
    setBusy(true);
    try {
      await fbCreateTemplate({
        data: {
          name: name.trim(),
          category: category.trim() || null,
          scope,
        },
      });
      onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-elevated">
        <h3 className="mb-3 font-display text-lg font-bold">Template Baru</h3>
        <label className="block text-xs font-medium">Nama Template</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <label className="mt-3 block text-xs font-medium">Kategori</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <label className="mt-3 block text-xs font-medium">Scope</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "opd" | "global")}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="opd">OPD (lokal)</option>
          {isElevated && <option value="global">Global (Pemda-wide)</option>}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Batal
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            {busy ? "Membuat…" : "Buat"}
          </button>
        </div>
      </div>
    </div>
  );
}
