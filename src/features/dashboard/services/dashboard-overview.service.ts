// Phase 4 — Overview KPIs (scoped by OPD when not elevated).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;
export type Scope = { opdId: string | null; isElevated: boolean };

export interface OverviewKpi {
  totalSubmission: number;
  submissionToday: number;
  pendingWorkflow: number;
  completedWorkflow: number;
  overdueWorkflow: number;
  escalatedTasks: number;
  pendingSignature: number;
  signedDocuments: number;
  generatedDocuments: number;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function subBase(supabase: SB, scope: Scope) {
  let q = supabase.from("form_submissions").select("id", { count: "exact", head: true });
  if (!scope.isElevated && scope.opdId) q = q.eq("opd_id", scope.opdId);
  return q;
}

export async function getOverview(supabase: SB, scope: Scope): Promise<OverviewKpi> {
  const today = startOfTodayIso();
  const nowIso = new Date().toISOString();

  const [total, todayCnt, pending, completed] = await Promise.all([
    subBase(supabase, scope),
    subBase(supabase, scope).gte("created_at", today),
    subBase(supabase, scope).in("status", ["pending", "in_review", "in_progress"]),
    subBase(supabase, scope).eq("status", "approved"),
  ]);

  let overdueQ = supabase
    .from("submission_tasks")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true })
    .in("status", ["pending", "in_progress"])
    .lt("due_at", nowIso);
  if (!scope.isElevated && scope.opdId) {
    overdueQ = overdueQ.eq("form_submissions.opd_id", scope.opdId);
  }
  const { count: overdueWorkflow } = await overdueQ;

  let escQ = supabase
    .from("submission_tasks")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true })
    .eq("status", "escalated");
  if (!scope.isElevated && scope.opdId) {
    escQ = escQ.eq("form_submissions.opd_id", scope.opdId);
  }
  const { count: escalatedTasks } = await escQ;

  let sigQ = supabase
    .from("signature_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "sent"]);
  if (!scope.isElevated && scope.opdId) sigQ = sigQ.eq("opd_id", scope.opdId);
  const { count: pendingSignature } = await sigQ;

  let docQ = supabase
    .from("generated_documents")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true });
  if (!scope.isElevated && scope.opdId) {
    docQ = docQ.eq("form_submissions.opd_id", scope.opdId);
  }
  const { count: generatedDocuments } = await docQ;

  let signedQ = supabase
    .from("generated_documents")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true })
    .eq("status", "signed");
  if (!scope.isElevated && scope.opdId) {
    signedQ = signedQ.eq("form_submissions.opd_id", scope.opdId);
  }
  const { count: signedDocuments } = await signedQ;

  return {
    totalSubmission: total.count ?? 0,
    submissionToday: todayCnt.count ?? 0,
    pendingWorkflow: pending.count ?? 0,
    completedWorkflow: completed.count ?? 0,
    overdueWorkflow: overdueWorkflow ?? 0,
    escalatedTasks: escalatedTasks ?? 0,
    pendingSignature: pendingSignature ?? 0,
    signedDocuments: signedDocuments ?? 0,
    generatedDocuments: generatedDocuments ?? 0,
  };
}
