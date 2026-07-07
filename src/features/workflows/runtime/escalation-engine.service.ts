// Phase 2B — Escalation Engine + SLA scan worker.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadInstance, findNode } from "./workflow-runtime.service";
import { resolveAssignees } from "./assignment-engine.service";
import { writeWorkflowAudit } from "../services/workflow-audit.service";
import { enqueueNotification } from "@/lib/notifications.functions";

type SB = SupabaseClient<Database>;

export interface SlaScanResult {
  scanned: number;
  escalated: number;
  errors: number;
}

/**
 * Pindai semua task pending/in_progress yang due_at < now.
 * Untuk tiap task overdue: buat submission_escalations + tambah assignee fallback.
 */
export async function runSlaScan(supabase: SB): Promise<SlaScanResult> {
  const now = new Date().toISOString();
  const { data: overdue, error } = await supabase
    .from("submission_tasks")
    .select("id,submission_id,node_key,due_at,workflow_version_id")
    .in("status", ["pending", "in_progress"])
    .not("due_at", "is", null)
    .lt("due_at", now)
    .limit(500);
  if (error) throw new Error(error.message);
  let escalated = 0;
  let errors = 0;
  for (const t of overdue ?? []) {
    try {
      const taskId = t.id as string;
      const submissionId = t.submission_id as string;
      // Skip bila sudah ada escalation level 1 untuk task ini (dedupe).
      const { data: existing } = await supabase
        .from("submission_escalations")
        .select("id,level")
        .eq("task_id", taskId)
        .order("level", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextLevel = ((existing?.level as number | undefined) ?? 0) + 1;
      if (nextLevel > 3) continue; // batas max 3 level
      const ctx = await loadInstance(supabase, submissionId);
      if (!ctx) continue;
      const node = findNode(ctx.graph, t.node_key as string);
      if (!node) continue;
      const esc = node.config.escalation;
      let escalateTo: string | null = null;
      if (esc?.enabled) {
        if (esc.escalate_to_type === "user" && esc.escalate_to_user_id) {
          escalateTo = esc.escalate_to_user_id;
        } else if (esc.escalate_to_type === "role" && esc.escalate_to_role) {
          const { assignees } = await resolveAssignees(
            supabase,
            { type: "role", role: esc.escalate_to_role },
            ctx.applicant,
          );
          escalateTo = assignees[0] ?? null;
        } else if (esc.escalate_to_type === "manager") {
          const { assignees } = await resolveAssignees(
            supabase,
            { type: "current_user_manager" },
            ctx.applicant,
          );
          escalateTo = assignees[0] ?? null;
        }
      }
      await supabase.from("submission_escalations").insert({
        task_id: taskId,
        level: nextLevel,
        reason: `Overdue (level ${nextLevel})`,
        escalated_to: escalateTo,
      });
      if (escalateTo) {
        // Tambahkan sebagai assignee tambahan (jangan hapus existing).
        const { data: already } = await supabase
          .from("submission_assignments")
          .select("id")
          .eq("task_id", taskId)
          .eq("assignee_id", escalateTo)
          .maybeSingle();
        if (!already) {
          await supabase.from("submission_assignments").insert({
            task_id: taskId,
            assignee_id: escalateTo,
            assigned_by: null,
            status: "active",
          });
        }
        await enqueueNotification({
          userId: escalateTo,
          tipe: "task.escalated",
          judul: "Task eskalasi diterima",
          link: `/admin/tasks/${taskId}`,
          meta: { submission_id: submissionId, task_id: taskId, level: nextLevel },
          dedupeKey: `esc:${taskId}:${nextLevel}`,
        });
      }
      await writeWorkflowAudit(supabase, {
        action: "workflow.update",
        resource_type: "workflow_version",
        resource_id: (t.workflow_version_id as string | null) ?? null,
        user_id: null,
        metadata: {
          kind: "task.escalated",
          submission_id: submissionId,
          task_id: taskId,
          level: nextLevel,
          escalate_to: escalateTo,
        },
      });
      escalated += 1;
    } catch {
      errors += 1;
    }
  }
  return { scanned: (overdue ?? []).length, escalated, errors };
}
