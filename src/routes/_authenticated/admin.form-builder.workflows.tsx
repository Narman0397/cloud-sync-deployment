// Phase 2A — List Workflows + Create modal.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard } from "@/components/admin/AdminGuard";
import {
  wfListWorkflows,
  wfCreateWorkflow,
  wfArchiveWorkflow,
  wfListTemplates,
  wfSeedBuiltInTemplates,
  wfPublishTemplate,
  wfArchiveTemplate,
} from "@/lib/workflow-builder.functions";
import { Plus, Copy, Archive, Send, FileCog, Database, FilePlus2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui-kit/StatusPill";

export const Route = createFileRoute("/_authenticated/admin/form-builder/workflows")({
  head: () => ({
    meta: [{ title: "Workflows — Form Builder" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <WorkflowsPage />
    </AdminGuard>
  ),
});

type TabKey = "all" | "active" | "draft" | "archived" | "templates";

function WorkflowsPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const list = useServerFn(wfListWorkflows);
  const listTpl = useServerFn(wfListTemplates);
  const seed = useServerFn(wfSeedBuiltInTemplates);
  const archive = useServerFn(wfArchiveWorkflow);
  const create = useServerFn(wfCreateWorkflow);

  const qc = useQueryClient();
  const wfQuery = useQuery({
    queryKey: ["wf-list", tab, search],
    queryFn: () =>
      list({
        data: {
          tab: tab === "templates" ? "all" : tab,
          search: search || undefined,
        },
      }),
    enabled: tab !== "templates",
  });
  const tplQuery = useQuery({
    queryKey: ["wf-templates", search],
    queryFn: () => listTpl({ data: { search: search || undefined } }),
    enabled: tab === "templates",
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wf-list"] }),
  });
  const cloneMut = useMutation({
    mutationFn: (id: string) =>
      create({ data: { name: "Clone", clone_from_id: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wf-list"] }),
  });
  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wf-templates"] }),
  });
  const useTplMut = useMutation({
    mutationFn: (id: string) => create({ data: { name: "Workflow dari Template", from_template_id: id } }),
    onSuccess: () => {
      toast.success("Workflow baru dibuat dari template");
      qc.invalidateQueries({ queryKey: ["wf-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pubTplFn = useServerFn(wfPublishTemplate);
  const arcTplFn = useServerFn(wfArchiveTemplate);
  const pubTplMut = useMutation({
    mutationFn: (id: string) => pubTplFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template diterbitkan");
      qc.invalidateQueries({ queryKey: ["wf-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const arcTplMut = useMutation({
    mutationFn: (id: string) => arcTplFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Template diarsipkan");
      qc.invalidateQueries({ queryKey: ["wf-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold">Workflows</h2>
        <div className="ml-auto flex items-center gap-2">
          <input
            placeholder="Cari workflow…"
            className="input h-8 w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tab === "templates" ? (
            <button
              type="button"
              onClick={() => seedMut.mutate()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted"
              title="Seed built-in templates"
            >
              <Database className="h-4 w-4" />
              Seed
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create Workflow
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {(["all", "active", "draft", "archived", "templates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {labelFor(t)}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <TemplateTable
          rows={tplQuery.data ?? []}
          loading={tplQuery.isLoading}
          onUse={(id) => useTplMut.mutate(id)}
          onPublish={(id) => pubTplMut.mutate(id)}
          onArchive={(id) => arcTplMut.mutate(id)}
          busyId={
            (useTplMut.isPending && (useTplMut.variables as string)) ||
            (pubTplMut.isPending && (pubTplMut.variables as string)) ||
            (arcTplMut.isPending && (arcTplMut.variables as string)) ||
            null
          }
        />
      ) : (
        <WorkflowTable
          rows={wfQuery.data ?? []}
          loading={wfQuery.isLoading}
          onArchive={(id) => archiveMut.mutate(id)}
          onClone={(id) => cloneMut.mutate(id)}
        />
      )}

      {openCreate ? (
        <CreateDialog
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            setOpenCreate(false);
            qc.invalidateQueries({ queryKey: ["wf-list"] });
          }}
        />
      ) : null}
    </>
  );
}

function labelFor(t: TabKey): string {
  return (
    {
      all: "All Workflows",
      active: "Active",
      draft: "Draft",
      archived: "Archived",
      templates: "Templates",
    } as const
  )[t];
}

interface WfRow {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  status: string;
  opd_pemilik_id: string | null;
  current_version_number: number | null;
  updated_at: string;
}

function WorkflowTable({
  rows,
  loading,
  onArchive,
  onClone,
}: {
  rows: WfRow[];
  loading: boolean;
  onArchive: (id: string) => void;
  onClone: (id: string) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada workflow.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <Th>Name</Th>
            <Th>Code</Th>
            <Th>Category</Th>
            <Th>OPD</Th>
            <Th>Version</Th>
            <Th>Status</Th>
            <Th>Last Updated</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <Td>
                <Link
                  to="/admin/form-builder/workflows/$id"
                  params={{ id: r.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {r.name}
                </Link>
              </Td>
              <Td className="text-muted-foreground">{r.code ?? "—"}</Td>
              <Td>{r.category ?? "—"}</Td>
              <Td className="text-xs text-muted-foreground">
                {r.opd_pemilik_id ? r.opd_pemilik_id.slice(0, 8) : "—"}
              </Td>
              <Td>v{r.current_version_number ?? "—"}</Td>
              <Td>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase">
                  {r.status}
                </span>
              </Td>
              <Td className="text-xs text-muted-foreground">
                {new Date(r.updated_at).toLocaleString("id-ID")}
              </Td>
              <Td>
                <div className="flex gap-1">
                  <button
                    onClick={() => onClone(r.id)}
                    title="Clone"
                    className="rounded-md border border-border p-1 hover:bg-muted"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onArchive(r.id)}
                    title="Archive"
                    className="rounded-md border border-border p-1 hover:bg-muted"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TplRow {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  scope: string;
  status: string;
  updated_at: string;
}
function TemplateTable({
  rows,
  loading,
  onUse,
  onPublish,
  onArchive,
  busyId,
}: {
  rows: TplRow[];
  loading: boolean;
  onUse: (id: string) => void;
  onPublish: (id: string) => void;
  onArchive: (id: string) => void;
  busyId: string | null;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada template. Klik <strong>Seed</strong> untuk memuat template bawaan.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <Th>Name</Th>
            <Th>Code</Th>
            <Th>Category</Th>
            <Th>Scope</Th>
            <Th>Status</Th>
            <Th>Last Updated</Th>
            <Th>Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <Td className="font-medium">{r.name}</Td>
              <Td className="text-muted-foreground">{r.code ?? "—"}</Td>
              <Td>{r.category ?? "—"}</Td>
              <Td className="uppercase text-xs">{r.scope}</Td>
              <Td>
                <StatusPill
                  tone={
                    r.status === "published"
                      ? "success"
                      : r.status === "archived"
                        ? "warning"
                        : "muted"
                  }
                >
                  {r.status}
                </StatusPill>
              </Td>
              <Td className="text-xs text-muted-foreground">
                {new Date(r.updated_at).toLocaleString("id-ID")}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <button
                    disabled={r.status !== "published" || busyId === r.id}
                    onClick={() => onUse(r.id)}
                    title={
                      r.status === "published"
                        ? "Buat workflow baru dari template"
                        : "Terbitkan dulu sebelum dipakai"
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                  >
                    <FilePlus2 className="h-3 w-3" /> Pakai
                  </button>
                  {r.status === "draft" && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => onPublish(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Terbitkan
                    </button>
                  )}
                  {r.status !== "archived" && (
                    <button
                      disabled={busyId === r.id}
                      onClick={() => onArchive(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <Archive className="h-3 w-3" /> Arsip
                    </button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<"blank" | "template" | "clone">("blank");
  const [templateId, setTemplateId] = useState("");
  const [cloneId, setCloneId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = useServerFn(wfCreateWorkflow);
  const listTpl = useServerFn(wfListTemplates);
  const list = useServerFn(wfListWorkflows);
  const tpls = useQuery({
    queryKey: ["wf-templates-pick"],
    queryFn: () => listTpl({ data: {} }),
  });
  const wfs = useQuery({
    queryKey: ["wf-list-pick"],
    queryFn: () => list({ data: { tab: "all" } }),
    enabled: mode === "clone",
  });

  const submit = async () => {
    if (mode !== "clone" && name.trim().length < 3) {
      setErr("Nama wajib minimal 3 karakter.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await create({
        data: {
          name: name || "Workflow Baru",
          code: code || null,
          category: category || null,
          from_template_id: mode === "template" ? templateId || null : null,
          clone_from_id: mode === "clone" ? cloneId || null : null,
        },
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <FileCog className="h-4 w-4" /> Create Workflow
        </h3>
        <div className="mb-3 flex gap-1 rounded-md border border-border p-1">
          {(["blank", "template", "clone"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-2 py-1 text-xs ${
                mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {m === "blank" ? "From Scratch" : m === "template" ? "From Template" : "Clone Existing"}
            </button>
          ))}
        </div>
        {mode !== "clone" ? (
          <>
            <label className="mb-2 block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Code</span>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">Category</span>
                <input
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}
        {mode === "template" ? (
          <label className="mb-2 block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Template</span>
            <select
              className="input"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">— pilih template —</option>
              {(tpls.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {mode === "clone" ? (
          <label className="mb-2 block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Source Workflow</span>
            <select className="input" value={cloneId} onChange={(e) => setCloneId(e.target.value)}>
              <option value="">— pilih workflow —</option>
              {(wfs.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {err ? <p className="mb-2 text-xs text-destructive">{err}</p> : null}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Buat
          </button>
        </div>
      </div>
    </div>
  );
}
