// Phase 2B — Workflow Runtime server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext } from "@/features/rbac/guards";
import { startInstance } from "@/features/workflows/runtime/workflow-runtime.service";
import {
  executeAction,
  loadTask,
  listMyTasks,
  type TaskInboxRow,
} from "@/features/workflows/runtime/task-engine.service";
import {
  applyRevision,
  delegateTask,
} from "@/features/workflows/runtime/revision-engine.service";
import { runSlaScan } from "@/features/workflows/runtime/escalation-engine.service";
import {
  listInstances,
  getSubmissionTimeline,
} from "@/features/workflows/runtime/workflow-monitoring.service";
import { TASK_ACTIONS, TASK_STATUSES } from "@/features/workflows/runtime/types";
import { enqueueNotification } from "@/lib/notifications.functions";

/** Dipanggil oleh submissions.submit setelah berhasil — tidak melalui server fn publik. */
export async function startWorkflowForSubmission(submissionId: string, actorId: string) {
  const { data: s } = await supabaseAdmin
    .from("form_submissions")
    .select("id,user_id,opd_id,form_id,workflow_version_id,forms(current_workflow_version_id)")
    .eq("id", submissionId)
    .maybeSingle();
  if (!s) return { started: false, reason: "submission_not_found" };
  if (s.workflow_version_id) return { started: false, reason: "already_started" };
  const wfVer =
    ((s as { forms: { current_workflow_version_id: string | null } | null }).forms
      ?.current_workflow_version_id) ?? null;
  if (!wfVer) return { started: false, reason: "no_workflow_attached" };
  const res = await startInstance(supabaseAdmin, {
    submissionId,
    workflowVersionId: wfVer,
    applicant: {
      user_id: (s.user_id as string) ?? actorId,
      opd_id: (s.opd_id as string | null) ?? null,
    },
    actorId,
  });
  // Notifikasi ke assignee task pertama.
  for (const tid of res.tasks) {
    const { data: assigns } = await supabaseAdmin
      .from("submission_assignments")
      .select("assignee_id")
      .eq("task_id", tid)
      .eq("status", "active");
    for (const a of assigns ?? []) {
      await enqueueNotification({
        userId: a.assignee_id as string,
        tipe: "task.assigned",
        judul: "Tugas baru menunggu",
        link: `/admin/tasks/${tid}`,
        meta: { submission_id: submissionId, task_id: tid },
        dedupeKey: `assign:${tid}:${a.assignee_id}`,
      });
    }
  }
  return { started: true, tasks: res.tasks, terminal: res.terminal };
}

// -------------------- Server functions --------------------

export const wfRtListMyTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["all", "open", ...TASK_STATUSES]).default("open"),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: TaskInboxRow[]; total: number }> => {
    const { userId } = context as { userId: string };
    return listMyTasks(supabaseAdmin, userId, data);
  });

export const wfRtGetTaskDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const task = await loadTask(supabaseAdmin, data.taskId);
    if (!task) throw new Error("Task tidak ditemukan");
    const ctx = await getUserContext(supabaseAdmin, userId);
    const { data: sub } = await supabaseAdmin
      .from("form_submissions")
      .select("id,code,user_id,opd_id,status,data,current_workflow_node,form_id,workflow_version_id,forms(judul)")
      .eq("id", task.submission_id)
      .maybeSingle();
    if (!sub) throw new Error("Submission tidak ditemukan");
    const { data: assigns } = await supabaseAdmin
      .from("submission_assignments")
      .select("assignee_id,status,assigned_at")
      .eq("task_id", task.id);
    const isAssignee = (assigns ?? []).some(
      (a) => a.assignee_id === userId && a.status === "active",
    );
    const isOwner = sub.user_id === userId;
    if (!isAssignee && !isOwner && !ctx.isElevated && !(ctx.isAdminOpd && ctx.opdId === sub.opd_id)) {
      throw new Error("Akses ditolak");
    }
    const timeline = await getSubmissionTimeline(supabaseAdmin, task.submission_id);
    // Load node config dari snapshot untuk tahu aksi yang tersedia.
    let nodeConfig: import("@/integrations/supabase/types").Json | null = null;
    if (task.workflow_version_id) {
      const { data: wfv } = await supabaseAdmin
        .from("workflow_versions")
        .select("graph")
        .eq("id", task.workflow_version_id)
        .maybeSingle();
      const graph = (wfv?.graph ?? null) as { nodes?: Array<{ id: string; config?: import("@/integrations/supabase/types").Json }> } | null;
      nodeConfig = graph?.nodes?.find((n) => n.id === task.node_key)?.config ?? null;
    }
    return {
      task,
      submission: {
        id: sub.id,
        code: sub.code,
        judul: (sub as { forms: { judul: string } | null }).forms?.judul ?? "",
        data: sub.data,
        status: sub.status,
        current_node: sub.current_workflow_node,
      },
      assignments: assigns ?? [],
      timeline,
      can_act: isAssignee,
      is_owner: isOwner,
      node_config: nodeConfig,
    };
  });

export const wfRtExecuteAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        action: z.enum(TASK_ACTIONS),
        comment: z.string().max(2000).optional().nullable(),
        attachments: z
          .array(z.object({ name: z.string(), storage_path: z.string() }))
          .max(20)
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    if ((data.action === "reject" || data.action === "request_revision") && !data.comment) {
      throw new Error("Catatan wajib untuk reject / request revision");
    }
    if (data.action === "delegate") {
      throw new Error("Gunakan wfRtDelegateTask untuk delegasi");
    }
    const res = await executeAction(supabaseAdmin, {
      taskId: data.taskId,
      action: data.action,
      actorId: userId,
      comment: data.comment ?? null,
      attachments: data.attachments,
    });
    // Notifikasi: task baru.
    for (const tid of res.newTasks) {
      const { data: assigns } = await supabaseAdmin
        .from("submission_assignments")
        .select("assignee_id")
        .eq("task_id", tid)
        .eq("status", "active");
      for (const a of assigns ?? []) {
        await enqueueNotification({
          userId: a.assignee_id as string,
          tipe: "task.assigned",
          judul: "Tugas baru menunggu",
          link: `/admin/tasks/${tid}`,
          meta: { task_id: tid },
          dedupeKey: `assign:${tid}:${a.assignee_id}`,
        });
      }
    }
    // Notif pemohon jika revision_required atau terminal.
    const { data: t } = await supabaseAdmin
      .from("submission_tasks")
      .select("submission_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (t) {
      const { data: sub } = await supabaseAdmin
        .from("form_submissions")
        .select("user_id,status")
        .eq("id", t.submission_id as string)
        .maybeSingle();
      if (sub?.user_id) {
        const tipe =
          data.action === "request_revision"
            ? "submission.revision_requested"
            : data.action === "reject"
              ? "submission.rejected"
              : res.terminal
                ? "submission.completed"
                : "submission.progress";
        await enqueueNotification({
          userId: sub.user_id as string,
          tipe,
          judul:
            data.action === "request_revision"
              ? "Permohonan Anda perlu revisi"
              : data.action === "reject"
                ? "Permohonan Anda ditolak"
                : res.terminal
                  ? "Permohonan Anda selesai"
                  : "Permohonan Anda diproses",
          link: `/permohonan/${t.submission_id}`,
          meta: { submission_id: t.submission_id, action: data.action },
        });
      }
    }
    return res;
  });

export const wfRtDelegateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        toUserId: z.string().uuid(),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await delegateTask(supabaseAdmin, data.taskId, userId, data.toUserId, data.reason ?? null);
    await enqueueNotification({
      userId: data.toUserId,
      tipe: "task.delegated",
      judul: "Anda menerima delegasi tugas",
      link: `/admin/tasks/${data.taskId}`,
      meta: { task_id: data.taskId, from: userId },
    });
    return { ok: true as const };
  });

export const wfRtSubmitRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        values: z.record(z.string(), z.unknown()),
        reason: z.string().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await applyRevision(supabaseAdmin, data.submissionId, userId, data.values, data.reason ?? null);
    return { ok: true as const };
  });

export const wfRtListInstances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.string().max(40).optional().nullable(),
        formId: z.string().uuid().optional().nullable(),
        opdId: z.string().uuid().optional().nullable(),
        page: z.number().int().min(1).max(1000).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd && !ctx.isPimpinan) {
      throw new Error("Akses ditolak");
    }
    return listInstances(supabaseAdmin, data, {
      opdId: ctx.opdId,
      isElevated: ctx.isElevated,
    });
  });

export const wfRtGetTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ submissionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    return { events: await getSubmissionTimeline(supabaseAdmin, data.submissionId) };
  });

export const wfRtRunSlaScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated) throw new Error("Akses ditolak");
    return runSlaScan(supabaseAdmin);
  });
