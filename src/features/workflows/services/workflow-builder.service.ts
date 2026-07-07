// Phase 2A — Workflow builder service (CRUD pada workflow_definitions).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WorkflowSummary } from "../schema/types";

type SB = SupabaseClient<Database>;

export interface WorkflowListFilter {
  tab: "all" | "active" | "draft" | "archived";
  search?: string;
  category?: string;
  opdId?: string | null;
  scopeOpdId?: string | null;
  isElevated: boolean;
}

interface DefinitionRow {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  status: string;
  opd_pemilik_id: string | null;
  form_id: string | null;
  current_version_id: string | null;
  updated_at: string;
}

export async function listWorkflows(
  supabase: SB,
  filter: WorkflowListFilter,
): Promise<WorkflowSummary[]> {
  let q = supabase
    .from("workflow_definitions")
    .select(
      "id,name,code,category,status,opd_pemilik_id,form_id,current_version_id,updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (filter.tab === "active") q = q.eq("status", "active");
  else if (filter.tab === "draft") q = q.eq("status", "draft");
  else if (filter.tab === "archived") q = q.eq("status", "archived");
  if (filter.search) q = q.ilike("name", `%${filter.search}%`);
  if (filter.category) q = q.eq("category", filter.category);
  if (!filter.isElevated && filter.scopeOpdId) q = q.eq("opd_pemilik_id", filter.scopeOpdId);
  else if (filter.opdId) q = q.eq("opd_pemilik_id", filter.opdId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DefinitionRow[];
  if (rows.length === 0) return [];

  const versionIds = rows.map((r) => r.current_version_id).filter((id): id is string => !!id);
  const versionMap = new Map<string, { version_number: number; status: string; locked: boolean; submission_count: number }>();
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from("workflow_versions")
      .select("id,version_number,status,locked,submission_count")
      .in("id", versionIds);
    for (const v of versions ?? []) {
      versionMap.set(v.id as string, {
        version_number: v.version_number as number,
        status: v.status as string,
        locked: v.locked as boolean,
        submission_count: (v.submission_count as number) ?? 0,
      });
    }
  }
  return rows.map((r) => {
    const v = r.current_version_id ? versionMap.get(r.current_version_id) : undefined;
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      category: r.category,
      status: r.status as WorkflowSummary["status"],
      opd_pemilik_id: r.opd_pemilik_id,
      form_id: r.form_id,
      current_version_id: r.current_version_id,
      current_version_number: v?.version_number ?? null,
      current_version_status: v?.status ?? null,
      current_version_locked: v?.locked ?? false,
      current_version_submission_count: v?.submission_count ?? 0,
      updated_at: r.updated_at,
    };
  });
}

export async function getWorkflowById(
  supabase: SB,
  id: string,
): Promise<DefinitionRow | null> {
  const { data, error } = await supabase
    .from("workflow_definitions")
    .select(
      "id,name,code,category,status,opd_pemilik_id,form_id,current_version_id,updated_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DefinitionRow | null) ?? null;
}

export async function createWorkflow(
  supabase: SB,
  input: {
    name: string;
    code?: string | null;
    category?: string | null;
    description?: string | null;
    opd_pemilik_id?: string | null;
    form_id?: string | null;
    userId: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("workflow_definitions")
    .insert({
      name: input.name,
      code: input.code ?? null,
      category: input.category ?? null,
      description: input.description ?? null,
      opd_pemilik_id: input.opd_pemilik_id ?? null,
      form_id: input.form_id ?? null,
      status: "draft",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Gagal membuat workflow");
  return { id: data.id as string };
}

export async function archiveWorkflow(supabase: SB, id: string): Promise<void> {
  const { error } = await supabase
    .from("workflow_definitions")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloneWorkflow(
  supabase: SB,
  id: string,
  userId: string,
): Promise<{ id: string }> {
  const src = await getWorkflowById(supabase, id);
  if (!src) throw new Error("Workflow tidak ditemukan");
  const { data, error } = await supabase
    .from("workflow_definitions")
    .insert({
      name: `${src.name} (Copy)`,
      code: null,
      category: src.category,
      opd_pemilik_id: src.opd_pemilik_id,
      form_id: src.form_id,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Gagal clone");
  // Clone current version graph as v1 draft
  if (src.current_version_id) {
    const { data: ver } = await supabase
      .from("workflow_versions")
      .select("graph")
      .eq("id", src.current_version_id)
      .maybeSingle();
    if (ver) {
      await supabase.from("workflow_versions").insert({
        workflow_id: data.id as string,
        version_number: 1,
        status: "draft",
        graph: ver.graph,
        created_by: userId,
      });
    }
  }
  return { id: data.id as string };
}
