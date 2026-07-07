// Phase 3B — Resolve a signer descriptor (user|role|position) to a concrete user_id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export interface SignerInput {
  signer_type: "user" | "role" | "position";
  user_id?: string | null;
  role?: string | null;
  position?: string | null;
  /** Kode klasifikasi ASN (SystemPosition). Jika diisi, resolver akan
   * mencari nama jabatan di master_jabatan lalu mencocokkan profiles.jabatan. */
  system_position?: string | null;
  opd_id?: string | null;
  order_index?: number;
}

export interface ResolvedSigner {
  user_id: string;
  full_name: string;
  nip: string | null;
  position: string | null;
  order_index: number;
}

export async function resolveSigner(
  supabase: SB,
  input: SignerInput,
): Promise<ResolvedSigner | null> {
  let userId: string | null = null;
  if (input.signer_type === "user") {
    userId = input.user_id ?? null;
  } else if (input.signer_type === "role") {
    if (!input.role) return null;
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", input.role as never);
    const ids = (data ?? []).map((r) => r.user_id as string);
    if (ids.length === 0) return null;
    let scoped = ids;
    if (input.opd_id) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id")
        .in("id", ids)
        .eq("opd_id", input.opd_id);
      scoped = (profs ?? []).map((p) => p.id as string);
    }
    userId = scoped[0] ?? null;
  } else if (input.signer_type === "position") {
    // Prioritas: system_position → master_jabatan.nama → profiles.jabatan
    let jabatanNames: string[] = [];
    if (input.system_position) {
      const { data: mj } = await supabase
        .from("master_jabatan")
        .select("nama")
        .eq("system_position", input.system_position as never)
        .eq("aktif", true);
      jabatanNames = (mj ?? []).map((r) => r.nama as string).filter(Boolean);
    } else if (input.position) {
      jabatanNames = [input.position];
    }
    if (jabatanNames.length === 0) return null;
    let q = supabase.from("profiles").select("id").in("jabatan", jabatanNames);
    if (input.opd_id) q = q.eq("opd_id", input.opd_id);
    const { data } = await q.limit(1);
    userId = (data?.[0]?.id as string | undefined) ?? null;
  }
  if (!userId) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("id,nama_lengkap,nip,jabatan")
    .eq("id", userId)
    .maybeSingle();
  if (!prof) return null;
  return {
    user_id: prof.id as string,
    full_name: (prof.nama_lengkap as string) ?? "",
    nip: (prof.nip as string | null) ?? null,
    position: (prof.jabatan as string | null) ?? input.position ?? null,
    order_index: input.order_index ?? 0,
  };
}
