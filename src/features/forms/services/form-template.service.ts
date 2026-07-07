// Phase 1B — Template service. CRUD helpers untuk form_templates.
// Authorization & server fn wrapping ada di src/lib/form-builder.functions.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { FormField } from "@/features/forms/schema/types";

type SB = SupabaseClient<Database>;
type EmploymentType = Database["public"]["Enums"]["employment_type"];

export interface TemplateListFilter {
  scope?: "global" | "opd";
  category?: string;
  search?: string;
  opdId?: string | null;
  status?: "draft" | "published" | "archived";
}

export interface TemplateListItem {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  scope: string;
  status: string;
  owner_opd_id: string | null;
  allowed_employee_types: EmploymentType[];
  created_at: string;
  updated_at: string;
}

export async function listTemplates(
  supabase: SB,
  filter: TemplateListFilter,
): Promise<TemplateListItem[]> {
  let q = supabase
    .from("form_templates")
    .select(
      "id,code,name,description,category,scope,status,owner_opd_id,allowed_employee_types,created_at,updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filter.scope) q = q.eq("scope", filter.scope);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.category) q = q.eq("category", filter.category);
  if (filter.opdId) q = q.eq("owner_opd_id", filter.opdId);
  if (filter.search) {
    const s = filter.search.replace(/[%_]/g, "");
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TemplateListItem[];
}

export interface CreateTemplateInput {
  name: string;
  code?: string | null;
  description?: string | null;
  category?: string | null;
  scope: "global" | "opd";
  owner_opd_id?: string | null;
  allowed_employee_types?: EmploymentType[];
  fields?: FormField[];
  userId: string;
}

export async function createTemplate(
  supabase: SB,
  input: CreateTemplateInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      scope: input.scope,
      owner_opd_id: input.scope === "global" ? null : (input.owner_opd_id ?? null),
      allowed_employee_types: input.allowed_employee_types ?? [],
      fields: (input.fields ?? []) as unknown as Json,
      status: "draft",
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Gagal membuat template");
  return { id: data.id as string };
}
