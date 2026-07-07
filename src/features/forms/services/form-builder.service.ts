// Phase 1B — Form Builder service layer.
// Berisi business logic murni (tanpa createServerFn) untuk:
// - list/filter forms dengan kriteria enterprise (category/employment_type/OPD)
// - clone form
// - create form dari template
// - archive/restore form
//
// Server fn wrappers ada di src/lib/form-builder.functions.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { FormField } from "@/features/forms/schema/types";

type SB = SupabaseClient<Database>;
type EmploymentType = Database["public"]["Enums"]["employment_type"];

export interface FormListFilter {
  status?: "draft" | "published" | "archived";
  tab?: "all" | "my_opd" | "draft" | "published" | "archived";
  category?: string;
  opdId?: string | null;
  employmentType?: EmploymentType;
  search?: string;
  scopeOpdId?: string | null; // dari user context — untuk tab my_opd
  page?: number;
  pageSize?: number;
}

export interface FormListRow {
  id: string;
  code: string | null;
  judul: string;
  category: string | null;
  status: string;
  opd_pemilik_id: string | null;
  allowed_employee_types: EmploymentType[];
  version_number: number;
  deadline: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormListResult {
  rows: FormListRow[];
  total: number;
}

export async function listFormsAdvanced(
  supabase: SB,
  filter: FormListFilter,
): Promise<FormListResult> {
  const page = filter.page ?? 0;
  const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 50);
  let q = supabase
    .from("forms")
    .select(
      "id,code,judul,category,status,opd_pemilik_id,allowed_employee_types,version_number,deadline,published_at,created_at,updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // tab mapping
  const tab = filter.tab ?? "all";
  if (tab === "draft" || tab === "published" || tab === "archived") {
    q = q.eq("status", tab);
  } else if (filter.status) {
    q = q.eq("status", filter.status);
  }
  if (tab === "my_opd" && filter.scopeOpdId) {
    q = q.eq("opd_pemilik_id", filter.scopeOpdId);
  }
  if (filter.category) q = q.eq("category", filter.category);
  if (filter.opdId) q = q.eq("opd_pemilik_id", filter.opdId);
  if (filter.employmentType) {
    q = q.contains("allowed_employee_types", [filter.employmentType]);
  }
  if (filter.search) {
    const s = filter.search.replace(/[%_]/g, "");
    q = q.or(`judul.ilike.%${s}%,code.ilike.%${s}%,category.ilike.%${s}%`);
  }
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as FormListRow[], total: count ?? 0 };
}

export interface CloneFormResult {
  id: string;
}

export async function cloneForm(
  supabase: SB,
  params: { sourceFormId: string; userId: string; ownerOpdId: string | null },
): Promise<CloneFormResult> {
  const { data: src, error: e1 } = await supabase
    .from("forms")
    .select(
      "judul,deskripsi,category,sla_days,allow_multiple_submit,allowed_employee_types,opd_pemilik_id",
    )
    .eq("id", params.sourceFormId)
    .maybeSingle();
  if (e1 || !src) throw new Error("Form sumber tidak ditemukan");

  const { data: created, error: e2 } = await supabase
    .from("forms")
    .insert({
      judul: `${src.judul} (Salinan)`,
      deskripsi: src.deskripsi,
      category: src.category,
      sla_days: src.sla_days,
      allow_multiple_submit: src.allow_multiple_submit,
      allowed_employee_types: src.allowed_employee_types ?? [],
      opd_pemilik_id: params.ownerOpdId ?? src.opd_pemilik_id,
      status: "draft",
      created_by: params.userId,
    })
    .select("id")
    .single();
  if (e2 || !created) throw new Error(e2?.message ?? "Gagal menyalin form");

  const { data: fields } = await supabase
    .from("form_fields")
    .select("kode,label,tipe,required,placeholder,help_text,options,validation,visible_if,urutan")
    .eq("form_id", params.sourceFormId)
    .order("urutan");
  if (fields && fields.length > 0) {
    await supabase.from("form_fields").insert(
      fields.map((f, i) => ({
        form_id: created.id as string,
        kode: f.kode as string,
        label: f.label as string,
        tipe: f.tipe as string,
        required: !!f.required,
        placeholder: (f.placeholder as string | null) ?? null,
        help_text: (f.help_text as string | null) ?? null,
        options: (f.options ?? []) as Json,
        validation: (f.validation ?? {}) as Json,
        visible_if: (f.visible_if ?? null) as Json,
        urutan: typeof f.urutan === "number" ? f.urutan : i,
      })),
    );
  }
  return { id: created.id as string };
}

export interface CreateFromTemplateParams {
  templateId: string;
  userId: string;
  ownerOpdId: string | null;
  overrideName?: string;
}

export async function createFormFromTemplate(
  supabase: SB,
  params: CreateFromTemplateParams,
): Promise<CloneFormResult> {
  const { data: tpl, error } = await supabase
    .from("form_templates")
    .select("name,description,category,allowed_employee_types,fields,scope,owner_opd_id")
    .eq("id", params.templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !tpl) throw new Error("Template tidak ditemukan");

  const { data: created, error: e2 } = await supabase
    .from("forms")
    .insert({
      judul: params.overrideName ?? tpl.name,
      deskripsi: tpl.description,
      category: tpl.category,
      allowed_employee_types: (tpl.allowed_employee_types ?? []) as EmploymentType[],
      opd_pemilik_id: params.ownerOpdId,
      status: "draft",
      created_by: params.userId,
    })
    .select("id")
    .single();
  if (e2 || !created) throw new Error(e2?.message ?? "Gagal membuat form dari template");

  const fields = Array.isArray(tpl.fields) ? (tpl.fields as unknown as FormField[]) : [];
  if (fields.length > 0) {
    await supabase.from("form_fields").insert(
      fields.map((f, i) => ({
        form_id: created.id as string,
        kode: f.kode,
        label: f.label,
        tipe: f.tipe,
        required: !!f.required,
        placeholder: f.placeholder ?? null,
        help_text: f.help_text ?? null,
        options: (f.options ?? []) as unknown as Json,
        validation: (f.validation ?? {}) as unknown as Json,
        visible_if: (f.visible_if ?? null) as unknown as Json,
        urutan: typeof f.urutan === "number" ? f.urutan : i,
      })),
    );
  }
  return { id: created.id as string };
}
