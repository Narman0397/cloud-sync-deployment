// Phase 1B.2 — Wizard draft service + helpers.
// Tidak mengandung server fn; murni business logic + DB queries.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { FormField } from "@/features/forms/schema/types";
import { createFormVersion } from "@/features/forms/services/form-version.service";
import { assertValidFields } from "@/features/forms/services/form-validation.service";

type SB = SupabaseClient<Database>;

export interface WizardDraftRow {
  id: string;
  user_id: string;
  form_id: string | null;
  step: string;
  title: string | null;
  payload: Json;
  updated_at: string;
  created_at: string;
}

export async function listWizardDrafts(supabase: SB, userId: string): Promise<WizardDraftRow[]> {
  const { data, error } = await supabase
    .from("form_wizard_drafts")
    .select("id,user_id,form_id,step,title,payload,updated_at,created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    payload: (r.payload ?? {}) as Json,
  })) as WizardDraftRow[];
}

export async function getWizardDraft(
  supabase: SB,
  id: string,
  userId: string,
): Promise<WizardDraftRow | null> {
  const { data, error } = await supabase
    .from("form_wizard_drafts")
    .select("id,user_id,form_id,step,title,payload,updated_at,created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...data, payload: (data.payload ?? {}) as Json } as WizardDraftRow;
}

export async function upsertWizardDraft(
  supabase: SB,
  params: {
    id?: string;
    userId: string;
    formId?: string | null;
    step: string;
    title: string | null;
    payload: Json;
  },
): Promise<{ id: string; updated_at: string }> {
  if (params.id) {
    const { data, error } = await supabase
      .from("form_wizard_drafts")
      .update({
        step: params.step,
        title: params.title,
        payload: params.payload as unknown as Json,
        form_id: params.formId ?? null,
      })
      .eq("id", params.id)
      .eq("user_id", params.userId)
      .select("id,updated_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Gagal menyimpan draft");
    return { id: data.id as string, updated_at: data.updated_at as string };
  }
  const { data, error } = await supabase
    .from("form_wizard_drafts")
    .insert({
      user_id: params.userId,
      form_id: params.formId ?? null,
      step: params.step,
      title: params.title,
      payload: params.payload as unknown as Json,
    })
    .select("id,updated_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Gagal membuat draft");
  return { id: data.id as string, updated_at: data.updated_at as string };
}

export async function deleteWizardDraft(supabase: SB, id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("form_wizard_drafts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------
// Version safety: cek apakah form punya submission.
// ------------------------------------------------------------
export interface FormEditSafety {
  submission_count: number;
  can_edit_directly: boolean;
  current_version_number: number;
}

export async function getFormEditSafety(supabase: SB, formId: string): Promise<FormEditSafety> {
  const [{ count }, { data: form }] = await Promise.all([
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("form_id", formId),
    supabase.from("forms").select("version_number,status").eq("id", formId).maybeSingle(),
  ]);
  const c = count ?? 0;
  return {
    submission_count: c,
    can_edit_directly: c === 0,
    current_version_number: (form?.version_number as number | null) ?? 1,
  };
}

// ------------------------------------------------------------
// Persist wizard fields ke form_fields + buat versi baru (opsional).
// ------------------------------------------------------------
export async function persistFormFields(
  supabase: SB,
  params: { formId: string; fields: FormField[]; userId: string; createVersion: boolean },
): Promise<{ field_count: number; version?: { id: string; number: number } }> {
  const valid = assertValidFields(params.fields);
  // Replace strategy: hapus semua field lama lalu insert ulang.
  await supabase.from("form_fields").delete().eq("form_id", params.formId);
  if (valid.length > 0) {
    const { error } = await supabase.from("form_fields").insert(
      valid.map((f, i) => ({
        form_id: params.formId,
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
    if (error) throw new Error(error.message);
  }
  let version: { id: string; number: number } | undefined;
  if (params.createVersion) {
    const v = await createFormVersion(supabase, {
      formId: params.formId,
      fields: valid,
      userId: params.userId,
    });
    version = { id: v.version_id, number: v.version_number };
  }
  return { field_count: valid.length, version };
}
