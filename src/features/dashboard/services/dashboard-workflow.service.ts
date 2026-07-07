// Phase 4 — Workflow monitoring aggregates.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Scope } from "./dashboard-overview.service";

type SB = SupabaseClient<Database>;

export interface WorkflowStats {
  active: number;
  completed: number;
  failed: number;
  revisionRequested: number;
  escalations: number;
}

export async function getWorkflowStats(supabase: SB, scope: Scope): Promise<WorkflowStats> {
  const base = () => {
    let q = supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .not("workflow_version_id", "is", null);
    if (!scope.isElevated && scope.opdId) q = q.eq("opd_id", scope.opdId);
    return q;
  };
  const [active, completed, failed, revision] = await Promise.all([
    base().in("status", ["pending", "in_review", "in_progress"]),
    base().eq("status", "approved"),
    base().eq("status", "rejected"),
    base().eq("status", "revision_requested"),
  ]);

  let escQ = supabase
    .from("submission_escalations")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true });
  if (!scope.isElevated && scope.opdId) escQ = escQ.eq("form_submissions.opd_id", scope.opdId);
  const { count: escalations } = await escQ;

  return {
    active: active.count ?? 0,
    completed: completed.count ?? 0,
    failed: failed.count ?? 0,
    revisionRequested: revision.count ?? 0,
    escalations: escalations ?? 0,
  };
}

export interface WorkflowRow {
  submission_id: string;
  code: string | null;
  form_title: string;
  status: string;
  current_node: string | null;
  opd_id: string | null;
  updated_at: string;
}

export async function listActiveWorkflowInstances(
  supabase: SB,
  scope: Scope,
  limit = 50,
): Promise<WorkflowRow[]> {
  let q = supabase
    .from("form_submissions")
    .select("id,code,status,current_workflow_node,opd_id,updated_at,forms(judul)")
    .not("workflow_version_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!scope.isElevated && scope.opdId) q = q.eq("opd_id", scope.opdId);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    code: string | null;
    status: string;
    current_workflow_node: string | null;
    opd_id: string | null;
    updated_at: string;
    forms: { judul: string } | null;
  }>;
  return rows.map((r) => ({
    submission_id: r.id,
    code: r.code,
    form_title: r.forms?.judul ?? "(Form)",
    status: r.status,
    current_node: r.current_workflow_node,
    opd_id: r.opd_id,
    updated_at: r.updated_at,
  }));
}
