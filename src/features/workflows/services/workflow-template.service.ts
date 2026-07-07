// Phase 2A — Workflow template service.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { WorkflowGraph, WorkflowTemplateSummary } from "../schema/types";
import { BUILTIN_TEMPLATES } from "../schema/defaults";

type SB = SupabaseClient<Database>;

export interface TemplateListFilter {
  scope?: "global" | "opd";
  status?: "draft" | "published" | "archived";
  category?: string;
  search?: string;
  opdId?: string | null;
}

export async function listWorkflowTemplates(
  supabase: SB,
  filter: TemplateListFilter,
): Promise<WorkflowTemplateSummary[]> {
  let q = supabase
    .from("workflow_templates")
    .select("id,name,code,description,category,scope,owner_opd_id,status,updated_at")
    .order("updated_at", { ascending: false });
  if (filter.scope) q = q.eq("scope", filter.scope);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.category) q = q.eq("category", filter.category);
  if (filter.search) q = q.ilike("name", `%${filter.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkflowTemplateSummary[];
}

export async function createWorkflowTemplate(
  supabase: SB,
  input: {
    name: string;
    code?: string | null;
    description?: string | null;
    category?: string | null;
    scope: "global" | "opd";
    owner_opd_id?: string | null;
    graph?: WorkflowGraph;
    userId: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("workflow_templates")
    .insert({
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      scope: input.scope,
      owner_opd_id: input.scope === "global" ? null : (input.owner_opd_id ?? null),
      graph: (input.graph ?? { nodes: [], edges: [] }) as unknown as Json,
      created_by: input.userId,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Gagal membuat template");
  return { id: data.id as string };
}

export async function seedBuiltInTemplates(supabase: SB, userId: string): Promise<number> {
  let inserted = 0;
  for (const tpl of BUILTIN_TEMPLATES) {
    const { data: exists } = await supabase
      .from("workflow_templates")
      .select("id")
      .eq("code", tpl.code)
      .maybeSingle();
    if (exists) continue;
    const { error } = await supabase.from("workflow_templates").insert({
      name: tpl.name,
      code: tpl.code,
      description: tpl.description,
      category: tpl.category,
      scope: "global",
      owner_opd_id: null,
      graph: tpl.graph as unknown as Json,
      status: "published",
      created_by: userId,
    });
    if (!error) inserted += 1;
  }
  return inserted;
}

export async function getTemplateGraph(supabase: SB, templateId: string): Promise<WorkflowGraph> {
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("graph")
    .eq("id", templateId)
    .maybeSingle();
  if (error || !data) throw new Error("Template tidak ditemukan");
  return (data.graph as unknown as WorkflowGraph) ?? { nodes: [], edges: [] };
}
