// Phase 3A — Build merge context from submission + workflow + profile snapshots.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { MergeContext } from "../placeholder/engine";

type SB = SupabaseClient<Database>;

export async function buildMergeContext(
  supabase: SB,
  args: { submission_id: string; doc_number?: string | null; template_version?: number },
): Promise<MergeContext> {
  const { data: sub } = await supabase
    .from("form_submissions")
    .select(
      "id,user_id,opd_id,form_id,workflow_version_id,current_workflow_node,status,created_at,reviewed_at,reviewed_by,data",
    )
    .eq("id", args.submission_id)
    .maybeSingle();
  if (!sub) throw new Error("Submission tidak ditemukan");

  const { data: values } = await supabase
    .from("submission_values")
    .select("field_kode,value")
    .eq("submission_id", args.submission_id);
  const valueMap: Record<string, unknown> = {};
  for (const v of values ?? []) {
    valueMap[(v.field_kode as string) ?? ""] = v.value;
  }

  const dataObj =
    sub.data && typeof sub.data === "object" && !Array.isArray(sub.data)
      ? (sub.data as Record<string, unknown>)
      : {};

  const submission: Record<string, unknown> = {
    ...dataObj,
    ...valueMap,
    id: sub.id,
    status: sub.status,
    created_at: sub.created_at,
  };

  let profile: Record<string, unknown> = {};
  if (sub.user_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id,full_name,nip,email,opd_id")
      .eq("id", sub.user_id)
      .maybeSingle();
    if (p) profile = p as unknown as Record<string, unknown>;
  }
  if (sub.opd_id) {
    const { data: opd } = await supabase
      .from("opd")
      .select("nama,singkatan")
      .eq("id", sub.opd_id)
      .maybeSingle();
    if (opd) {
      submission.opd = opd.nama;
      profile.opd_name = opd.nama;
    }
  }

  const workflow: Record<string, unknown> = {
    current_step: sub.current_workflow_node ?? "",
    version: sub.workflow_version_id ?? "",
    completed_at: sub.reviewed_at ?? "",
    approved_by: sub.reviewed_by ?? "",
  };

  const now = new Date();
  const system: Record<string, unknown> = {
    tanggal: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    tahun: now.getFullYear(),
    app_name: "SIPemda",
  };

  const document: Record<string, unknown> = {
    nomor_surat: args.doc_number ?? "",
    template_version: args.template_version ?? 1,
    generated_at: now.toISOString(),
  };

  return { submission, profile, workflow, system, document };
}
