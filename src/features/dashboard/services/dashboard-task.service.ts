// Phase 4 — Task monitoring (per-user, workload).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Scope } from "./dashboard-overview.service";

type SB = SupabaseClient<Database>;

export interface TaskStats {
  myTasks: number;
  pending: number;
  overdue: number;
  delegated: number;
  completedToday: number;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getTaskStats(
  supabase: SB,
  scope: Scope,
  userId: string,
): Promise<TaskStats> {
  const nowIso = new Date().toISOString();
  const today = startOfTodayIso();

  // My tasks: active assignments for this user
  const { data: mine } = await supabase
    .from("submission_assignments")
    .select("task_id,status")
    .eq("assignee_id", userId)
    .eq("status", "active");
  const myTaskIds = (mine ?? []).map((r) => r.task_id as string);

  // Pending tasks scoped by OPD
  let pendQ = supabase
    .from("submission_tasks")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true })
    .in("status", ["pending", "in_progress"]);
  if (!scope.isElevated && scope.opdId) pendQ = pendQ.eq("form_submissions.opd_id", scope.opdId);
  const { count: pending } = await pendQ;

  let overQ = supabase
    .from("submission_tasks")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true })
    .in("status", ["pending", "in_progress"])
    .lt("due_at", nowIso);
  if (!scope.isElevated && scope.opdId) overQ = overQ.eq("form_submissions.opd_id", scope.opdId);
  const { count: overdue } = await overQ;

  const { count: delegated } = await supabase
    .from("submission_delegations")
    .select("id", { count: "exact", head: true });

  let doneQ = supabase
    .from("submission_tasks")
    .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("completed_at", today);
  if (!scope.isElevated && scope.opdId) doneQ = doneQ.eq("form_submissions.opd_id", scope.opdId);
  const { count: completedToday } = await doneQ;

  return {
    myTasks: myTaskIds.length,
    pending: pending ?? 0,
    overdue: overdue ?? 0,
    delegated: delegated ?? 0,
    completedToday: completedToday ?? 0,
  };
}

export interface WorkloadRow {
  user_id: string;
  nama: string | null;
  assigned: number;
  completed: number;
}

export async function getWorkloadPerUser(supabase: SB, scope: Scope): Promise<WorkloadRow[]> {
  const { data } = await supabase
    .from("submission_assignments")
    .select("assignee_id,status,profiles:assignee_id(nama_lengkap,opd_id)")
    .limit(2000);
  const rows = (data ?? []) as unknown as Array<{
    assignee_id: string;
    status: string;
    profiles: { nama_lengkap: string | null; opd_id: string | null } | null;
  }>;
  const map = new Map<string, WorkloadRow>();
  for (const r of rows) {
    if (!scope.isElevated && scope.opdId && r.profiles?.opd_id !== scope.opdId) continue;
    const cur = map.get(r.assignee_id) ?? {
      user_id: r.assignee_id,
      nama: r.profiles?.nama_lengkap ?? null,
      assigned: 0,
      completed: 0,
    };
    if (r.status === "active") cur.assigned += 1;
    if (r.status === "completed") cur.completed += 1;
    map.set(r.assignee_id, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.assigned - a.assigned).slice(0, 50);
}
