// Phase 2B — Workflow Runtime Service.
// Orchestrator: start instance, advance, terminate.
// Bekerja atas snapshot graph yang sudah disimpan di form_submissions.workflow_version_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  EdgePathKind,
} from "../schema/types";
import { resolveAssignees, type ApplicantContext } from "./assignment-engine.service";
import type { TaskAction } from "./types";
import { writeWorkflowAudit } from "../services/workflow-audit.service";

type SB = SupabaseClient<Database>;

export interface StartInstanceArgs {
  submissionId: string;
  workflowVersionId: string;
  applicant: ApplicantContext;
  actorId: string;
}

export interface RuntimeContext {
  submissionId: string;
  workflowVersionId: string;
  graph: WorkflowGraph;
  applicant: ApplicantContext;
}

/** Load snapshot graph dari workflow_versions.graph (immutable). */
export async function loadGraphSnapshot(
  supabase: SB,
  workflowVersionId: string,
): Promise<WorkflowGraph> {
  const { data, error } = await supabase
    .from("workflow_versions")
    .select("graph")
    .eq("id", workflowVersionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Workflow version tidak ditemukan");
  const g = data.graph as unknown as WorkflowGraph;
  if (!g || !Array.isArray(g.nodes)) throw new Error("Workflow snapshot tidak valid");
  return g;
}

export function findNode(graph: WorkflowGraph, key: string): WorkflowNode | null {
  return graph.nodes.find((n) => n.id === key) ?? null;
}

export function outgoingEdges(graph: WorkflowGraph, fromKey: string): WorkflowEdge[] {
  return graph.edges.filter((e) => e.from === fromKey);
}

export function incomingEdges(graph: WorkflowGraph, toKey: string): WorkflowEdge[] {
  return graph.edges.filter((e) => e.to === toKey);
}

/** Map TaskAction → EdgePathKind preferensi pencarian. */
function preferredEdgeKinds(action: TaskAction): EdgePathKind[] {
  switch (action) {
    case "approve":
    case "complete":
    case "forward":
      return ["approve", "default"];
    case "reject":
      return ["reject", "default"];
    case "request_revision":
      return ["revision", "default"];
    default:
      return ["default"];
  }
}

/** Pilih edge berikutnya berdasarkan aksi reviewer. */
export function pickNextEdges(
  graph: WorkflowGraph,
  fromKey: string,
  action: TaskAction,
): WorkflowEdge[] {
  const outs = outgoingEdges(graph, fromKey);
  if (outs.length === 0) return [];
  const prefs = preferredEdgeKinds(action);
  for (const kind of prefs) {
    const matched = outs.filter((e) => e.kind === kind);
    if (matched.length > 0) return matched;
  }
  // fallback: pertama
  return [outs[0]];
}

function calcDueAt(slaHours: number | null | undefined): string | null {
  if (!slaHours || slaHours <= 0) return null;
  return new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
}

/**
 * Buat task untuk node tujuan + assignment records.
 * Mengembalikan task id (atau null bila node tidak butuh task — e.g. parallel/terminal).
 */
export async function createTaskForNode(
  supabase: SB,
  ctx: RuntimeContext,
  node: WorkflowNode,
  actorId: string,
): Promise<{ taskId: string | null; assignees: string[]; exception?: string }> {
  // Terminal: completed / rejected → tidak buat task, caller akan finalize submission.
  if (node.type === "completed" || node.type === "rejected") {
    return { taskId: null, assignees: [] };
  }
  // Start / parallel: tidak butuh assignment; advance otomatis (parallel akan fan-out).
  if (node.type === "start" || node.type === "parallel") {
    return { taskId: null, assignees: [] };
  }
  // Signature node (Phase 3B): tandai event audit, biarkan task signer dibuat oleh
  // signature-runtime (sigSendDocument) saat generate dokumen selesai. Tidak membuat task workflow.
  if (node.type === "signature") {
    await writeWorkflowAudit(supabase, {
      action: "workflow.update",
      resource_type: "workflow_version",
      resource_id: ctx.workflowVersionId,
      user_id: actorId,
      metadata: {
        kind: "signature.node_reached",
        submission_id: ctx.submissionId,
        node_key: node.id,
      },
    });
    return { taskId: null, assignees: [] };
  }
  // Resolve assignees.
  const { assignees, reason } = await resolveAssignees(
    supabase,
    node.config.assignment ?? null,
    ctx.applicant,
  );
  if (assignees.length === 0) {
    await writeWorkflowAudit(supabase, {
      action: "workflow.update",
      resource_type: "workflow_version",
      resource_id: ctx.workflowVersionId,
      user_id: actorId,
      metadata: {
        kind: "assignment.exception",
        submission_id: ctx.submissionId,
        node_key: node.id,
        reason,
      },
    });
    return { taskId: null, assignees: [], exception: reason };
  }
  const dueAt = calcDueAt(node.sla_hours ?? null);
  const { data: task, error } = await supabase
    .from("submission_tasks")
    .insert({
      submission_id: ctx.submissionId,
      workflow_version_id: ctx.workflowVersionId,
      node_key: node.id,
      node_type: node.type,
      status: "pending",
      due_at: dueAt,
      sla_hours: node.sla_hours ?? null,
    })
    .select("id")
    .single();
  if (error || !task) throw new Error(error?.message ?? "Gagal membuat task");
  // Assignments (fan-out untuk role-based).
  const rows = assignees.map((uid) => ({
    task_id: task.id,
    assignee_id: uid,
    assigned_by: actorId,
    status: "active",
  }));
  await supabase.from("submission_assignments").insert(rows);
  return { taskId: task.id, assignees };
}

/** Hitung node setelah start: skip start/submit/parallel sampai dapat node beraksi atau terminal. */
export async function advanceFrom(
  supabase: SB,
  ctx: RuntimeContext,
  fromKey: string,
  edgeKindHint: TaskAction,
  actorId: string,
): Promise<{ createdTasks: string[]; reachedTerminal: WorkflowNode | null }> {
  const edges = pickNextEdges(ctx.graph, fromKey, edgeKindHint);
  const createdTasks: string[] = [];
  let reachedTerminal: WorkflowNode | null = null;
  for (const edge of edges) {
    const next = findNode(ctx.graph, edge.to);
    if (!next) continue;
    if (next.type === "completed" || next.type === "rejected") {
      reachedTerminal = next;
      continue;
    }
    if (next.type === "parallel") {
      // Fan-out: untuk tiap outgoing edge parallel, advance lagi.
      const fanned = await advanceFrom(supabase, ctx, next.id, "complete", actorId);
      createdTasks.push(...fanned.createdTasks);
      if (fanned.reachedTerminal) reachedTerminal = fanned.reachedTerminal;
      continue;
    }
    const res = await createTaskForNode(supabase, ctx, next, actorId);
    if (res.taskId) createdTasks.push(res.taskId);
  }
  return { createdTasks, reachedTerminal };
}

/** Inisialisasi workflow instance dari submission yang baru di-submit. */
export async function startInstance(
  supabase: SB,
  args: StartInstanceArgs,
): Promise<{ tasks: string[]; terminal: boolean }> {
  const graph = await loadGraphSnapshot(supabase, args.workflowVersionId);
  // Tentukan start node (type=start, fallback ke node[0]).
  const startNode =
    graph.nodes.find((n) => n.type === "start") ?? graph.nodes[0];
  if (!startNode) throw new Error("Workflow tidak memiliki node start");
  // Persist snapshot pointer & current node.
  await supabase
    .from("form_submissions")
    .update({
      workflow_version_id: args.workflowVersionId,
      current_workflow_node: startNode.id,
      status: "in_review",
    })
    .eq("id", args.submissionId);
  await writeWorkflowAudit(supabase, {
    action: "workflow.update",
    resource_type: "workflow_version",
    resource_id: args.workflowVersionId,
    user_id: args.actorId,
    metadata: {
      kind: "workflow.started",
      submission_id: args.submissionId,
    },
  });
  // Increment submission_count pada workflow_versions.
  const { data: cur } = await supabase
    .from("workflow_versions")
    .select("submission_count")
    .eq("id", args.workflowVersionId)
    .maybeSingle();
  if (cur) {
    await supabase
      .from("workflow_versions")
      .update({ submission_count: (cur.submission_count ?? 0) + 1, locked: true })
      .eq("id", args.workflowVersionId);
  }
  const ctx: RuntimeContext = {
    submissionId: args.submissionId,
    workflowVersionId: args.workflowVersionId,
    graph,
    applicant: args.applicant,
  };
  const { createdTasks, reachedTerminal } = await advanceFrom(
    supabase,
    ctx,
    startNode.id,
    "complete",
    args.actorId,
  );
  if (reachedTerminal) {
    await finalizeSubmission(supabase, args.submissionId, reachedTerminal, args.actorId);
  }
  return { tasks: createdTasks, terminal: !!reachedTerminal };
}

/** Update form_submissions status sesuai terminal node. */
export async function finalizeSubmission(
  supabase: SB,
  submissionId: string,
  terminal: WorkflowNode,
  actorId: string,
): Promise<void> {
  const newStatus = terminal.type === "rejected" ? "rejected" : "completed";
  await supabase
    .from("form_submissions")
    .update({
      status: newStatus,
      current_workflow_node: terminal.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorId,
    })
    .eq("id", submissionId);
  await writeWorkflowAudit(supabase, {
    action: "workflow.update",
    resource_type: "workflow_version",
    resource_id: null,
    user_id: actorId,
    metadata: {
      kind: terminal.type === "rejected" ? "workflow.cancelled" : "workflow.completed",
      submission_id: submissionId,
      terminal_node: terminal.id,
    },
  });
}

/** Cek apakah node tujuan join (parallel) sudah siap berdasarkan parallel_mode. */
export async function isJoinReady(
  supabase: SB,
  ctx: RuntimeContext,
  joinNode: WorkflowNode,
): Promise<boolean> {
  const incoming = incomingEdges(ctx.graph, joinNode.id);
  // Hitung task completed untuk tiap predecessor.
  const predKeys = incoming.map((e) => e.from);
  if (predKeys.length === 0) return true;
  const { data: tasks } = await supabase
    .from("submission_tasks")
    .select("node_key,status")
    .eq("submission_id", ctx.submissionId)
    .in("node_key", predKeys);
  const completed = new Set(
    (tasks ?? [])
      .filter((t) => ["approved", "completed", "rejected"].includes(t.status as string))
      .map((t) => t.node_key as string),
  );
  const mode = (joinNode.config.parallel_mode ?? "all") as "all" | "any";
  return mode === "any" ? completed.size > 0 : predKeys.every((k) => completed.has(k));
}

/** Helper untuk membaca form_submissions + applicant context. */
export async function loadInstance(
  supabase: SB,
  submissionId: string,
): Promise<RuntimeContext | null> {
  const { data: s } = await supabase
    .from("form_submissions")
    .select("id,user_id,opd_id,workflow_version_id,current_workflow_node,status")
    .eq("id", submissionId)
    .maybeSingle();
  if (!s || !s.workflow_version_id) return null;
  const graph = await loadGraphSnapshot(supabase, s.workflow_version_id);
  return {
    submissionId: s.id as string,
    workflowVersionId: s.workflow_version_id as string,
    graph,
    applicant: {
      user_id: (s.user_id as string) ?? "",
      opd_id: (s.opd_id as string | null) ?? null,
    },
  };
}

export type { Json };
