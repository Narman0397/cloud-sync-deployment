// Phase 2B — Revision & Delegation engines.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { writeWorkflowAudit } from "../services/workflow-audit.service";

type SB = SupabaseClient<Database>;

/** Saat pemohon mengirim revisi: simpan submission_versions baru, kembali ke in_review. */
export async function applyRevision(
  supabase: SB,
  submissionId: string,
  userId: string,
  newValues: Record<string, unknown>,
  reason: string | null,
): Promise<void> {
  const { data: s } = await supabase
    .from("form_submissions")
    .select("id,user_id,status,workflow_version_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (!s) throw new Error("Submission tidak ditemukan");
  if (s.user_id !== userId) throw new Error("Hanya pemohon yang dapat mengirim revisi");
  if (s.status !== "revision_required") throw new Error("Submission tidak dalam status revisi");
  // Hitung version berikutnya
  const { data: last } = await supabase
    .from("submission_versions")
    .select("version_number")
    .eq("submission_id", submissionId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = ((last?.version_number as number | undefined) ?? 0) + 1;
  await supabase.from("submission_versions").insert({
    submission_id: submissionId,
    version_number: next,
    values: newValues as Json,
    reason,
    created_by: userId,
  });
  await supabase
    .from("form_submissions")
    .update({ data: newValues as Json, status: "in_review" })
    .eq("id", submissionId);
  await writeWorkflowAudit(supabase, {
    action: "workflow.update",
    resource_type: "workflow_version",
    resource_id: s.workflow_version_id as string | null,
    user_id: userId,
    metadata: { kind: "submission.revised", submission_id: submissionId, version: next },
  });
}

/** Delegasi task ke user lain. */
export async function delegateTask(
  supabase: SB,
  taskId: string,
  fromUserId: string,
  toUserId: string,
  reason: string | null,
): Promise<void> {
  if (fromUserId === toUserId) throw new Error("Tidak dapat mendelegasikan ke diri sendiri");
  const { data: assign } = await supabase
    .from("submission_assignments")
    .select("id,assignee_id,status")
    .eq("task_id", taskId)
    .eq("assignee_id", fromUserId)
    .eq("status", "active")
    .maybeSingle();
  if (!assign) throw new Error("Anda bukan assignee aktif");
  // Verifikasi target user verified
  const { data: target } = await supabase
    .from("profiles")
    .select("id,verification_status")
    .eq("id", toUserId)
    .maybeSingle();
  if (!target || target.verification_status !== "verified") {
    throw new Error("Target delegasi belum terverifikasi");
  }
  await supabase
    .from("submission_assignments")
    .update({ status: "delegated" })
    .eq("id", assign.id as string);
  await supabase.from("submission_assignments").insert({
    task_id: taskId,
    assignee_id: toUserId,
    assigned_by: fromUserId,
    status: "active",
  });
  await supabase.from("submission_delegations").insert({
    task_id: taskId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    reason,
  });
  const { data: t } = await supabase
    .from("submission_tasks")
    .select("submission_id,workflow_version_id")
    .eq("id", taskId)
    .maybeSingle();
  await writeWorkflowAudit(supabase, {
    action: "workflow.update",
    resource_type: "workflow_version",
    resource_id: (t?.workflow_version_id as string | null) ?? null,
    user_id: fromUserId,
    metadata: {
      kind: "task.delegated",
      submission_id: t?.submission_id as string | undefined,
      task_id: taskId,
      to: toUserId,
      reason,
    },
  });
}
