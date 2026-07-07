// Phase 2B — Workflow Instances Monitoring.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { wfRtListInstances } from "@/lib/workflow-runtime.functions";

export const Route = createFileRoute("/_authenticated/admin/workflow-instances")({
  head: () => ({
    meta: [{ title: "Workflow Instances — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Workflow Instances" }]}>
        <Page />
      </AdminShell>
    </AdminGuard>
  ),
});

function Page() {
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const list = useServerFn(wfRtListInstances);
  const q = useQuery({
    queryKey: ["wf-rt-instances", status, page],
    queryFn: () =>
      list({ data: { status: status || null, page, pageSize: 25 } }),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold">Workflow Instances</h2>
        <select
          className="ml-2 h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Semua status</option>
          <option value="in_review">In Review</option>
          <option value="revision_required">Revision Required</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          Total: {q.data?.total ?? 0}
        </span>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}
      {q.isError && <p className="text-sm text-destructive">Gagal memuat instances.</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Submission</th>
              <th className="px-3 py-2">Form</th>
              <th className="px-3 py-2">Workflow</th>
              <th className="px-3 py-2">Node</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Assignees</th>
              <th className="px-3 py-2">Mulai</th>
              <th className="px-3 py-2">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {(q.data?.rows ?? []).map((r) => (
              <tr key={r.submission_id}>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to="/permohonan/$id" params={{ id: r.submission_id }} className="hover:underline">
                    {r.submission_code ?? r.submission_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.form_judul}</td>
                <td className="px-3 py-2">{r.workflow_name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.current_node ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase">
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={
                      r.sla_status === "overdue"
                        ? "text-destructive"
                        : r.sla_status === "due_soon"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    }
                  >
                    {r.sla_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.active_assignees.length}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.started_at).toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.last_activity).toLocaleString("id-ID")}
                </td>
              </tr>
            ))}
            {q.data && q.data.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Belum ada workflow instance.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm">
        <button
          className="h-8 rounded-md border border-border bg-background px-3 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ‹
        </button>
        <span className="text-muted-foreground">Hal. {page}</span>
        <button
          className="h-8 rounded-md border border-border bg-background px-3 disabled:opacity-50"
          disabled={!q.data || q.data.rows.length < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
