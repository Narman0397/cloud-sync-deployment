// Phase 1B — Version service. Membaca daftar versi form dan menyiapkan
// snapshot saat publish/create-version. Tidak mengandung server fn; konsumen
// memanggil dari createServerFn (lihat src/lib/form-builder.functions.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { FormField, FormSchemaSnapshot } from "@/features/forms/schema/types";

type SB = SupabaseClient<Database>;

export interface FormVersionListItem {
  id: string;
  version_number: number;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  is_current: boolean;
}

export async function listFormVersions(
  supabase: SB,
  formId: string,
): Promise<FormVersionListItem[]> {
  const [{ data: versions }, { data: form }] = await Promise.all([
    supabase
      .from("form_versions")
      .select("id,version_number,published_at,published_by,created_at")
      .eq("form_id", formId)
      .order("version_number", { ascending: false }),
    supabase.from("forms").select("current_version_id").eq("id", formId).maybeSingle(),
  ]);
  const currentId = (form?.current_version_id as string | null) ?? null;
  return (versions ?? []).map((v) => ({
    id: v.id as string,
    version_number: v.version_number as number,
    published_at: v.published_at as string | null,
    published_by: v.published_by as string | null,
    created_at: v.created_at as string,
    is_current: v.id === currentId,
  }));
}

export function buildSnapshot(fields: FormField[]): FormSchemaSnapshot {
  return {
    version: 1,
    fields: fields.map((f, i) => ({
      ...f,
      urutan: typeof f.urutan === "number" ? f.urutan : i,
    })) as FormSchemaSnapshot["fields"],
    publishedAt: new Date().toISOString(),
  };
}

export interface CreateVersionResult {
  version_id: string;
  version_number: number;
}

/**
 * Membuat baris form_versions baru dan menjadikannya current.
 * Pemanggil bertanggung jawab atas authorization.
 */
export async function createFormVersion(
  supabase: SB,
  params: { formId: string; fields: FormField[]; userId: string; meta?: Record<string, unknown> },
): Promise<CreateVersionResult> {
  const { data: last } = await supabase
    .from("form_versions")
    .select("version_number")
    .eq("form_id", params.formId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((last?.version_number as number | null) ?? 0) + 1;
  const snapshot = buildSnapshot(params.fields);

  const { data: ver, error } = await supabase
    .from("form_versions")
    .insert({
      form_id: params.formId,
      version_number: nextNumber,
      fields: snapshot.fields as unknown as Json,
      meta: (params.meta ?? {}) as Json,
      created_by: params.userId,
      published_at: new Date().toISOString(),
      published_by: params.userId,
    })
    .select("id,version_number")
    .single();
  if (error || !ver) throw new Error(error?.message ?? "Gagal membuat versi form");

  await supabase
    .from("forms")
    .update({
      current_version_id: ver.id,
      schema_snapshot: snapshot as unknown as Json,
    })
    .eq("id", params.formId);

  return { version_id: ver.id as string, version_number: ver.version_number as number };
}
