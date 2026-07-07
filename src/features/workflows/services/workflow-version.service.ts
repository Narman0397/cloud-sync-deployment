// Phase 2A — Version safety, snapshot, dan create-new-version untuk workflow.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { WorkflowGraph } from "../schema/types";

type SB = SupabaseClient<Database>;

export interface WorkflowVersionRow {
  id: string;
  workflow_id: string;
  version_number: number;
  status: string;
  locked: boolean;
  submission_count: number;
  graph: WorkflowGraph;
  published_at: string | null;
  created_at: string;
}

export async function listVersions(supabase: SB, workflowId: string): Promise<WorkflowVersionRow[]> {
  const { data, error } = await supabase
    .from("workflow_versions")
    .select("id,workflow_id,version_number,status,locked,submission_count,graph,published_at,created_at")
    .eq("workflow_id", workflowId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    graph: (r.graph as unknown as WorkflowGraph) ?? { nodes: [], edges: [] },
  })) as WorkflowVersionRow[];
}

export async function getVersion(supabase: SB, versionId: string): Promise<WorkflowVersionRow | null> {
  const { data, error } = await supabase
    .from("workflow_versions")
    .select("id,workflow_id,version_number,status,locked,submission_count,graph,published_at,created_at")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    graph: (data.graph as unknown as WorkflowGraph) ?? { nodes: [], edges: [] },
  } as WorkflowVersionRow;
}

export async function ensureDraftVersion(
  supabase: SB,
  workflowId: string,
  userId: string,
  fallbackGraph: WorkflowGraph,
): Promise<WorkflowVersionRow> {
  const { data: existing } = await supabase
    .from("workflow_versions")
    .select("id,workflow_id,version_number,status,locked,submission_count,graph,published_at,created_at")
    .eq("workflow_id", workflowId)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return {
      ...existing,
      graph: (existing.graph as unknown as WorkflowGraph) ?? fallbackGraph,
    } as WorkflowVersionRow;
  }
  const { data: max } = await supabase
    .from("workflow_versions")
    .select("version_number")
    .eq("workflow_id", workflowId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (max?.version_number ?? 0) + 1;
  const { data: inserted, error } = await supabase
    .from("workflow_versions")
    .insert({
      workflow_id: workflowId,
      version_number: nextNumber,
      status: "draft",
      locked: false,
      submission_count: 0,
      graph: fallbackGraph as unknown as Json,
      created_by: userId,
    })
    .select("id,workflow_id,version_number,status,locked,submission_count,graph,published_at,created_at")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Gagal membuat versi draft");
  return {
    ...inserted,
    graph: (inserted.graph as unknown as WorkflowGraph) ?? fallbackGraph,
  } as WorkflowVersionRow;
}

export async function saveDraftGraph(
  supabase: SB,
  versionId: string,
  graph: WorkflowGraph,
): Promise<void> {
  const { data: v } = await supabase
    .from("workflow_versions")
    .select("status,locked,submission_count")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) throw new Error("Versi tidak ditemukan");
  if (v.locked || v.status !== "draft" || (v.submission_count ?? 0) > 0) {
    throw new Error("Versi terkunci. Buat versi baru untuk mengubah.");
  }
  const { error } = await supabase
    .from("workflow_versions")
    .update({ graph: graph as unknown as Json })
    .eq("id", versionId);
  if (error) throw new Error(error.message);

  // Sinkronkan nodes/edges projection (best-effort)
  await supabase.from("workflow_nodes").delete().eq("workflow_version_id", versionId);
  await supabase.from("workflow_edges").delete().eq("workflow_version_id", versionId);
  if (graph.nodes.length) {
    await supabase.from("workflow_nodes").insert(
      graph.nodes.map((n) => ({
        workflow_version_id: versionId,
        node_key: n.id,
        node_type: n.type,
        label: n.label,
        sla_hours: n.sla_hours ?? null,
        config: n.config as unknown as Json,
      })),
    );
  }
  if (graph.edges.length) {
    await supabase.from("workflow_edges").insert(
      graph.edges.map((e) => ({
        workflow_version_id: versionId,
        from_node: e.from,
        to_node: e.to,
        label: e.label ?? null,
        condition: (e.condition ?? { kind: e.kind }) as unknown as Json,
      })),
    );
  }
}

export async function publishVersion(
  supabase: SB,
  versionId: string,
  userId: string,
): Promise<void> {
  const { data: v } = await supabase
    .from("workflow_versions")
    .select("id,workflow_id")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) throw new Error("Versi tidak ditemukan");
  const { error } = await supabase
    .from("workflow_versions")
    .update({
      status: "published",
      locked: true,
      published_at: new Date().toISOString(),
      published_by: userId,
    })
    .eq("id", versionId);
  if (error) throw new Error(error.message);
  await supabase
    .from("workflow_definitions")
    .update({ current_version_id: versionId, status: "active" })
    .eq("id", v.workflow_id);
}

export async function createNewDraftFromVersion(
  supabase: SB,
  workflowId: string,
  baseVersionId: string,
  userId: string,
): Promise<WorkflowVersionRow> {
  const base = await getVersion(supabase, baseVersionId);
  if (!base) throw new Error("Versi acuan tidak ditemukan");
  const { data: max } = await supabase
    .from("workflow_versions")
    .select("version_number")
    .eq("workflow_id", workflowId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (max?.version_number ?? 0) + 1;
  const { data: inserted, error } = await supabase
    .from("workflow_versions")
    .insert({
      workflow_id: workflowId,
      version_number: nextNumber,
      status: "draft",
      locked: false,
      submission_count: 0,
      graph: base.graph as unknown as Json,
      created_by: userId,
    })
    .select("id,workflow_id,version_number,status,locked,submission_count,graph,published_at,created_at")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Gagal membuat versi baru");
  return {
    ...inserted,
    graph: (inserted.graph as unknown as WorkflowGraph) ?? base.graph,
  } as WorkflowVersionRow;
}
