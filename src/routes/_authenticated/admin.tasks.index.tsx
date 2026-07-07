// Phase 2B — Inbox: My Tasks (default child of /admin/tasks).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { wfRtListMyTasks } from "@/lib/workflow-runtime.functions";
import { Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tasks/")({
  component: InboxPage,
});

const STATUS_OPTIONS = [
  { value: "open", label: "Aktif" },
  { value: "all", label: "Semua" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
  { value: "revision_requested", label: "Minta Revisi" },
  { value: "completed", label: "Selesai" },
  { value: "delegated", label: "Didelegasikan" },
] as const;

function InboxPage() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("open");
  const [page, setPage] = useState(1);
  const list = useServerFn(wfRtListMyTasks);
  const q = useQuery({
    queryKey: ["wf-rt-my-tasks", status, page],
    queryFn: () => list({ data: { status, page, pageSize: 20 } }),
  });
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as typeof status);
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          Total: {q.data?.total ?? 0}
        </span>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}
      {q.isError && <p className="text-sm text-destructive">Gagal memuat tugas.</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Submission</th>
              <th className="px-3 py-2">Form</th>
              <th className="px-3 py-2">Node</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Diterima</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {(q.data?.rows ?? []).map((r) => {
              const overdue = r.due_at && new Date(r.due_at).getTime() < Date.now();
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.submission_code ?? r.submission_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{r.form_judul}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{r.node_type}</span>{" "}
                    <span className="text-xs text-muted-foreground">{r.node_key}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs uppercase">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.due_at ? (
                      <span
                        className={
                          "inline-flex items-center gap-1 text-xs " +
                          (overdue ? "text-destructive" : "text-muted-foreground")
                        }
                      >
                        {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {new Date(r.due_at).toLocaleString("id-ID")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/tasks/$id"
                      params={{ id: r.id }}
                      className="text-xs text-primary hover:underline"
                    >
                      Buka
                    </Link>
                  </td>
                </tr>
              );
            })}
            {q.data && q.data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada tugas.
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
          ‹ Sebelumnya
        </button>
        <span className="text-muted-foreground">Hal. {page}</span>
        <button
          className="h-8 rounded-md border border-border bg-background px-3 disabled:opacity-50"
          disabled={!q.data || q.data.rows.length < 20}
          onClick={() => setPage((p) => p + 1)}
        >
          Selanjutnya ›
        </button>
      </div>
    </div>
  );
}
