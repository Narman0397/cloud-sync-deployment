// Phase 2B — Workflow Monitoring & Timeline.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export interface InstanceRow {
  submission_id: string;
  submission_code: string | null;
  form_judul: string;
  workflow_name: string | null;
  workflow_version_id: string | null;
  current_node: string | null;
  status: string;
  opd_id: string | null;
  active_assignees: string[];
  sla_status: "ok" | "due_soon" | "overdue" | "none";
  started_at: string;
  last_activity: string;
}

export interface MonitoringFilter {
  status?: string | null;
  formId?: string | null;
  opdId?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listInstances(
  supabase: SB,
  filter: MonitoringFilter,
  scope: { opdId: string | null; isElevated: boolean },
): Promise<{ rows: InstanceRow[]; total: number }> {
  const page = filter.page ?? 1;
  const size = Math.min(Math.max(filter.pageSize ?? 25, 1), 100);
  let q = supabase
    .from("form_submissions")
    .select(
      "id,code,opd_id,status,workflow_version_id,current_workflow_node,submitted_at,updated_at,form_id,forms(judul),workflow_versions(workflow_definitions(name))",
      { count: "exact" },
    )
    .not("workflow_version_id", "is", null)
    .order("updated_at", { ascending: false });
  if (!scope.isElevated && scope.opdId) {
    q = q.eq("opd_id", scope.opdId);
  } else if (filter.opdId) {
    q = q.eq("opd_id", filter.opdId);
  }
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.formId) q = q.eq("form_id", filter.formId);
  const from = (page - 1) * size;
  q = q.range(from, from + size - 1);
  const { data, count } = await q;
  const rowsBase = ((data ?? []) as unknown as Array<{
    id: string;
    code: string | null;
    opd_id: string | null;
    status: string;
    workflow_version_id: string | null;
    current_workflow_node: string | null;
    submitted_at: string | null;
    updated_at: string;
    forms: { judul: string } | null;
    workflow_versions: { workflow_definitions: { name: string } | null } | null;
  }>);
  // Active tasks per submission untuk SLA + assignees.
  const subIds = rowsBase.map((r) => r.id);
  let activeBySub = new Map<string, { due_at: string | null; ids: string[] }>();
  if (subIds.length > 0) {
    const { data: tasks } = await supabase
      .from("submission_tasks")
      .select("id,submission_id,due_at,status")
      .in("submission_id", subIds)
      .in("status", ["pending", "in_progress"]);
    activeBySub = new Map();
    for (const t of tasks ?? []) {
      const cur = activeBySub.get(t.submission_id as string) ?? { due_at: null, ids: [] };
      cur.ids.push(t.id as string);
      if (t.due_at && (!cur.due_at || (t.due_at as string) < cur.due_at)) {
        cur.due_at = t.due_at as string;
      }
      activeBySub.set(t.submission_id as string, cur);
    }
  }
  const allActiveTaskIds = [...activeBySub.values()].flatMap((v) => v.ids);
  const assigneesByTask = new Map<string, string[]>();
  if (allActiveTaskIds.length > 0) {
    const { data: assigns } = await supabase
      .from("submission_assignments")
      .select("task_id,assignee_id,status")
      .in("task_id", allActiveTaskIds)
      .eq("status", "active");
    for (const a of assigns ?? []) {
      const arr = assigneesByTask.get(a.task_id as string) ?? [];
      arr.push(a.assignee_id as string);
      assigneesByTask.set(a.task_id as string, arr);
    }
  }
  const now = Date.now();
  const rows: InstanceRow[] = rowsBase.map((r) => {
    const active = activeBySub.get(r.id);
    let sla: InstanceRow["sla_status"] = "none";
    if (active?.due_at) {
      const t = Date.parse(active.due_at);
      if (t < now) sla = "overdue";
      else if (t - now < 24 * 3600 * 1000) sla = "due_soon";
      else sla = "ok";
    }
    const taskIds = active?.ids ?? [];
    const assigneeSet = new Set<string>();
    for (const tid of taskIds) {
      for (const a of assigneesByTask.get(tid) ?? []) assigneeSet.add(a);
    }
    return {
      submission_id: r.id,
      submission_code: r.code,
      form_judul: r.forms?.judul ?? "(Form)",
      workflow_name: r.workflow_versions?.workflow_definitions?.name ?? null,
      workflow_version_id: r.workflow_version_id,
      current_node: r.current_workflow_node,
      status: r.status,
      opd_id: r.opd_id,
      active_assignees: [...assigneeSet],
      sla_status: sla,
      started_at: r.submitted_at ?? r.updated_at,
      last_activity: r.updated_at,
    };
  });
  return { rows, total: count ?? rows.length };
}

export interface TimelineEvent {
  at: string;
  kind: string;
  actor: string | null;
  comment: string | null;
  node_key: string | null;
  task_id: string | null;
}

/** Timeline immutable berasal dari workflow_audit_logs + submission_tasks. */
export async function getSubmissionTimeline(
  supabase: SB,
  submissionId: string,
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  const { data: audits } = await supabase
    .from("workflow_audit_logs")
    .select("created_at,action,user_id,metadata")
    .order("created_at", { ascending: true });
  for (const a of audits ?? []) {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    if (meta.submission_id !== submissionId) continue;
    events.push({
      at: a.created_at as string,
      kind: (meta.kind as string) ?? (a.action as string),
      actor: (a.user_id as string | null) ?? null,
      comment: (meta.comment as string) ?? null,
      node_key: (meta.node_key as string | null) ?? null,
      task_id: (meta.task_id as string | null) ?? null,
    });
  }
  return events;
}
