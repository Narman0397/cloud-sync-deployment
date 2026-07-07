// Phase 2B — Task Engine: aksi terhadap satu task (approve/reject/revise/forward/delegate/complete).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  advanceFrom,
  finalizeSubmission,
  loadInstance,
  type RuntimeContext,
} from "./workflow-runtime.service";
import type { TaskAction, TaskStatus } from "./types";
import { writeWorkflowAudit } from "../services/workflow-audit.service";

type SB = SupabaseClient<Database>;

export interface TaskRow {
  id: string;
  submission_id: string;
  workflow_version_id: string | null;
  node_key: string;
  node_type: string;
  status: TaskStatus;
  due_at: string | null;
  sla_hours: number | null;
  completed_at: string | null;
  notes: string | null;
  result: Json | null;
}

export async function loadTask(supabase: SB, taskId: string): Promise<TaskRow | null> {
  const { data } = await supabase
    .from("submission_tasks")
    .select("id,submission_id,workflow_version_id,node_key,node_type,status,due_at,sla_hours,completed_at,notes,result")
    .eq("id", taskId)
    .maybeSingle();
  return (data as unknown as TaskRow | null) ?? null;
}

export async function isAssignee(
  supabase: SB,
  taskId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("submission_assignments")
    .select("id")
    .eq("task_id", taskId)
    .eq("assignee_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return !!data;
}

/** Tandai task selesai + simpan hasil & catatan. */
async function closeTask(
  supabase: SB,
  task: TaskRow,
  newStatus: TaskStatus,
  result: Record<string, unknown>,
  notes: string | null,
): Promise<void> {
  await supabase
    .from("submission_tasks")
    .update({
      status: newStatus,
      completed_at: new Date().toISOString(),
      result: result as Json,
      notes,
    })
    .eq("id", task.id);
  await supabase
    .from("submission_assignments")
    .update({ status: "completed" })
    .eq("task_id", task.id)
    .eq("status", "active");
}

export interface ExecuteActionArgs {
  taskId: string;
  action: TaskAction;
  actorId: string;
  comment?: string | null;
  attachments?: Array<{ name: string; storage_path: string }>;
}

export interface ExecuteActionResult {
  ok: true;
  newTasks: string[];
  terminal: boolean;
}

/** Eksekusi aksi reviewer pada sebuah task. */
export async function executeAction(
  supabase: SB,
  args: ExecuteActionArgs,
): Promise<ExecuteActionResult> {
  const task = await loadTask(supabase, args.taskId);
  if (!task) throw new Error("Task tidak ditemukan");
  if (["completed", "approved", "rejected", "cancelled"].includes(task.status)) {
    throw new Error("Task sudah selesai");
  }
  const ok = await isAssignee(supabase, task.id, args.actorId);
  if (!ok) throw new Error("Hanya assignee aktif yang dapat menjalankan aksi");
  const ctx = await loadInstance(supabase, task.submission_id);
  if (!ctx) throw new Error("Workflow instance tidak ditemukan");

  // Map aksi → status task akhir.
  const finalStatus: TaskStatus =
    args.action === "approve"
      ? "approved"
      : args.action === "reject"
        ? "rejected"
        : args.action === "request_revision"
          ? "revision_requested"
          : "completed";

  await closeTask(
    supabase,
    task,
    finalStatus,
    {
      action: args.action,
      attachments: args.attachments ?? [],
    },
    args.comment ?? null,
  );

  // Audit per aksi.
  const auditKind =
    args.action === "approve"
      ? "task.approved"
      : args.action === "reject"
        ? "task.rejected"
        : args.action === "request_revision"
          ? "task.revised"
          : args.action === "forward"
            ? "task.forwarded"
            : "task.completed";
  await writeWorkflowAudit(supabase, {
    action: "workflow.update",
    resource_type: "workflow_version",
    resource_id: ctx.workflowVersionId,
    user_id: args.actorId,
    metadata: {
      kind: auditKind,
      submission_id: task.submission_id,
      task_id: task.id,
      node_key: task.node_key,
      comment: args.comment ?? null,
    },
  });

  // Revision: kembali ke pemohon (tidak perlu cari edge).
  if (args.action === "request_revision") {
    await supabase
      .from("form_submissions")
      .update({ status: "revision_required" })
      .eq("id", task.submission_id);
    return { ok: true, newTasks: [], terminal: false };
  }

  // Transition ke node berikutnya.
  const { createdTasks, reachedTerminal } = await advanceFrom(
    supabase,
    ctx as RuntimeContext,
    task.node_key,
    args.action,
    args.actorId,
  );
  if (reachedTerminal) {
    await finalizeSubmission(supabase, task.submission_id, reachedTerminal, args.actorId);
    return { ok: true, newTasks: createdTasks, terminal: true };
  }
  // Update current node pointer (ambil pertama; parallel akan beberapa).
  if (createdTasks.length > 0) {
    const { data: first } = await supabase
      .from("submission_tasks")
      .select("node_key")
      .eq("id", createdTasks[0])
      .maybeSingle();
    if (first) {
      await supabase
        .from("form_submissions")
        .update({ current_workflow_node: first.node_key as string })
        .eq("id", task.submission_id);
    }
  }
  return { ok: true, newTasks: createdTasks, terminal: false };
}

// -------------------- Listing helpers --------------------

export interface TaskInboxRow {
  id: string;
  submission_id: string;
  submission_code: string | null;
  form_id: string;
  form_judul: string;
  node_key: string;
  node_type: string;
  status: TaskStatus;
  due_at: string | null;
  sla_hours: number | null;
  created_at: string;
  current_step: string;
}

export interface InboxFilter {
  status?: TaskStatus | "open" | "all";
  formId?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}

/** Daftar task untuk user (My Tasks Inbox). */
export async function listMyTasks(
  supabase: SB,
  userId: string,
  filter: InboxFilter = {},
): Promise<{ rows: TaskInboxRow[]; total: number }> {
  const page = filter.page ?? 1;
  const size = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
  const { data: assigns } = await supabase
    .from("submission_assignments")
    .select("task_id,status")
    .eq("assignee_id", userId);
  const taskIds = (assigns ?? []).map((a) => a.task_id as string);
  if (taskIds.length === 0) return { rows: [], total: 0 };
  let q = supabase
    .from("submission_tasks")
    .select(
      "id,submission_id,node_key,node_type,status,due_at,sla_hours,created_at,form_submissions(id,code,form_id,forms(judul))",
      { count: "exact" },
    )
    .in("id", taskIds)
    .order("created_at", { ascending: false });
  if (filter.status === "open") {
    q = q.in("status", ["pending", "in_progress"]);
  } else if (filter.status && filter.status !== "all") {
    q = q.eq("status", filter.status);
  }
  const from = (page - 1) * size;
  q = q.range(from, from + size - 1);
  const { data, count } = await q;
  const rows: TaskInboxRow[] = ((data ?? []) as unknown as Array<{
    id: string;
    submission_id: string;
    node_key: string;
    node_type: string;
    status: TaskStatus;
    due_at: string | null;
    sla_hours: number | null;
    created_at: string;
    form_submissions: {
      id: string;
      code: string | null;
      form_id: string;
      forms: { judul: string } | null;
    } | null;
  }>).map((r) => ({
    id: r.id,
    submission_id: r.submission_id,
    submission_code: r.form_submissions?.code ?? null,
    form_id: r.form_submissions?.form_id ?? "",
    form_judul: r.form_submissions?.forms?.judul ?? "(Form)",
    node_key: r.node_key,
    node_type: r.node_type,
    status: r.status,
    due_at: r.due_at,
    sla_hours: r.sla_hours,
    created_at: r.created_at,
    current_step: r.node_key,
  }));
  return { rows, total: count ?? rows.length };
}
