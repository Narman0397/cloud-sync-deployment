// Phase 2B — Task detail: aksi reviewer + timeline.
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  wfRtGetTaskDetail,
  wfRtExecuteAction,
  wfRtDelegateTask,
} from "@/lib/workflow-runtime.functions";
import {
  ArrowLeft,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  Forward,
  UserPlus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tasks/$id")({
  head: () => ({
    meta: [{ title: "Detail Tugas — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Tugas Saya", to: "/admin/tasks" }, { label: "Detail" }]}>
        <DetailPage />
      </AdminShell>
    </AdminGuard>
  ),
});

type ActionKind = "approve" | "reject" | "request_revision" | "forward" | "complete";

function DetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/tasks/$id" });
  const get = useServerFn(wfRtGetTaskDetail);
  const exec = useServerFn(wfRtExecuteAction);
  const del = useServerFn(wfRtDelegateTask);
  const qc = useQueryClient();

  const [comment, setComment] = useState("");
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateTo, setDelegateTo] = useState("");
  const [delegateReason, setDelegateReason] = useState("");

  const q = useQuery({
    queryKey: ["wf-rt-task", id],
    queryFn: () => get({ data: { taskId: id } }),
  });

  const m = useMutation({
    mutationFn: (action: ActionKind) =>
      exec({ data: { taskId: id, action, comment: comment.trim() || null } }),
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["wf-rt-task", id] });
      qc.invalidateQueries({ queryKey: ["wf-rt-my-tasks"] });
    },
  });

  const dm = useMutation({
    mutationFn: () =>
      del({ data: { taskId: id, toUserId: delegateTo, reason: delegateReason || null } }),
    onSuccess: () => {
      setDelegateOpen(false);
      setDelegateTo("");
      setDelegateReason("");
      qc.invalidateQueries({ queryKey: ["wf-rt-task", id] });
    },
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Memuat…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Gagal memuat.</p>;

  const { task, submission, timeline, can_act, node_config } = q.data;
  const cfg = (node_config ?? {}) as {
    actions?: ActionKind[];
    allow_comment?: boolean;
    allow_delegation?: boolean;
    description?: string;
  };
  const actions = cfg.actions ?? ["approve", "reject", "request_revision"];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <Link
            to="/admin/tasks"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Kembali ke Inbox
          </Link>
          <h3 className="mt-1 font-display text-lg font-bold">
            {submission.judul || "Submission"}
          </h3>
          <div className="text-xs text-muted-foreground">
            #{submission.code ?? submission.id.slice(0, 8)} • Node {task.node_key} (
            {task.node_type})
          </div>
          {cfg.description && (
            <p className="mt-2 text-sm text-muted-foreground">{cfg.description}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-2 text-sm font-semibold">Data Submission</h4>
          <pre className="max-h-72 overflow-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(submission.data, null, 2)}
          </pre>
        </div>

        {can_act && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="mb-2 text-sm font-semibold">Aksi</h4>
            {cfg.allow_comment !== false && (
              <textarea
                className="mb-3 w-full rounded-md border border-border bg-background p-2 text-sm"
                rows={3}
                placeholder="Catatan (wajib untuk Reject / Request Revision)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
            <div className="flex flex-wrap gap-2">
              {actions.includes("approve") && (
                <ActionBtn icon={Check} label="Approve" onClick={() => m.mutate("approve")} />
              )}
              {actions.includes("reject") && (
                <ActionBtn
                  icon={X}
                  label="Reject"
                  destructive
                  onClick={() => m.mutate("reject")}
                />
              )}
              {actions.includes("request_revision") && (
                <ActionBtn
                  icon={RotateCcw}
                  label="Minta Revisi"
                  onClick={() => m.mutate("request_revision")}
                />
              )}
              {actions.includes("forward") && (
                <ActionBtn
                  icon={Forward}
                  label="Forward"
                  onClick={() => m.mutate("forward")}
                />
              )}
              {actions.includes("complete") && (
                <ActionBtn
                  icon={ChevronRight}
                  label="Complete"
                  onClick={() => m.mutate("complete")}
                />
              )}
              {cfg.allow_delegation && (
                <ActionBtn
                  icon={UserPlus}
                  label="Delegasi"
                  onClick={() => setDelegateOpen((v) => !v)}
                />
              )}
            </div>
            {m.isError && (
              <p className="mt-2 text-xs text-destructive">{(m.error as Error).message}</p>
            )}
            {delegateOpen && (
              <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                <input
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                  placeholder="UUID user tujuan"
                  value={delegateTo}
                  onChange={(e) => setDelegateTo(e.target.value)}
                />
                <textarea
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                  rows={2}
                  placeholder="Alasan delegasi"
                  value={delegateReason}
                  onChange={(e) => setDelegateReason(e.target.value)}
                />
                <button
                  className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
                  disabled={!delegateTo || dm.isPending}
                  onClick={() => dm.mutate()}
                >
                  Kirim Delegasi
                </button>
                {dm.isError && (
                  <p className="text-xs text-destructive">{(dm.error as Error).message}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
        <ol className="space-y-3">
          {timeline.map((ev, i) => (
            <li key={i} className="border-l-2 border-primary/40 pl-3">
              <div className="text-xs font-mono text-muted-foreground">
                {new Date(ev.at).toLocaleString("id-ID")}
              </div>
              <div className="text-sm font-medium">{ev.kind}</div>
              {ev.node_key && (
                <div className="text-xs text-muted-foreground">node: {ev.node_key}</div>
              )}
              {ev.comment && <div className="mt-1 text-xs">{ev.comment}</div>}
            </li>
          ))}
          {timeline.length === 0 && (
            <li className="text-sm text-muted-foreground">Belum ada aktivitas.</li>
          )}
        </ol>
      </aside>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium " +
        (destructive
          ? "bg-destructive text-destructive-foreground hover:opacity-90"
          : "bg-primary text-primary-foreground hover:opacity-90")
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
