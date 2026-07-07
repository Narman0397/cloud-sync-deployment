// Phase 2A — Workflow editor page (designer untuk satu workflow).
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { wfGetWorkflow } from "@/lib/workflow-builder.functions";
import { WorkflowDesigner } from "@/features/workflows/designer/WorkflowDesigner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/form-builder/workflows/$id")({
  head: () => ({
    meta: [{ title: "Workflow Designer — Form Builder" }, { name: "robots", content: "noindex" }],
  }),
  component: EditorPage,
});

function EditorPage() {
  const params = useParams({ from: "/_authenticated/admin/form-builder/workflows/$id" });
  const get = useServerFn(wfGetWorkflow);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["wf-detail", params.id, activeVersionId],
    queryFn: () => get({ data: { id: params.id } }),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Gagal memuat workflow.</p>;

  const { workflow, versions, current } = q.data;
  const selected =
    versions.find((v) => v.id === (activeVersionId ?? current.id)) ?? current;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Link
          to="/admin/form-builder/workflows"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Workflows
        </Link>
        <span className="text-sm text-muted-foreground">/</span>
        <h2 className="font-display text-lg font-bold">{workflow.name}</h2>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase">{workflow.status}</span>
        <select
          className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-sm"
          value={selected.id}
          onChange={(e) => setActiveVersionId(e.target.value)}
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version_number} • {v.status}
              {v.locked ? " (locked)" : ""}
            </option>
          ))}
        </select>
      </div>

      <WorkflowDesigner
        workflowId={workflow.id}
        versionId={selected.id}
        versionNumber={selected.version_number}
        locked={selected.locked}
        submissionCount={selected.submission_count}
        versionStatus={selected.status}
        initialGraph={selected.graph}
        onAfterCreateVersion={(id) => {
          setActiveVersionId(id);
          q.refetch();
        }}
      />
    </div>
  );
}
