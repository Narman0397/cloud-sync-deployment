// Phase 3B — Signature queue listing.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export interface QueueFilters {
  status?: string | null;
  providerCode?: string | null;
  signerUserId?: string | null;
  opdId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface QueueRow {
  id: string;
  status: string;
  mode: string;
  external_request_id: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  provider_code: string;
  provider_name: string;
  doc_number: string | null;
  doc_name: string | null;
  signer_names: string[];
}

export async function listQueue(supabase: SB, filters: QueueFilters): Promise<QueueRow[]> {
  let q = supabase
    .from("signature_requests")
    .select(
      "id,status,mode,external_request_id,sent_at,completed_at,created_at,opd_id,provider:signature_providers(code,name),document:generated_documents(doc_number,name),signers:signature_request_signers(user_id,position)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.opdId) q = q.eq("opd_id", filters.opdId);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as unknown as Array<{
    id: string;
    status: string;
    mode: string;
    external_request_id: string | null;
    sent_at: string | null;
    completed_at: string | null;
    created_at: string;
    provider: { code: string; name: string } | null;
    document: { doc_number: string | null; name: string | null } | null;
    signers: Array<{ user_id: string | null; position: string | null }>;
  }>;
  if (filters.providerCode) {
    rows = rows.filter((r) => r.provider?.code === filters.providerCode);
  }
  if (filters.signerUserId) {
    rows = rows.filter((r) => r.signers.some((s) => s.user_id === filters.signerUserId));
  }
  // Hydrate signer names
  const userIds = Array.from(
    new Set(rows.flatMap((r) => r.signers.map((s) => s.user_id).filter((x): x is string => !!x))),
  );
  let nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,nama_lengkap")
      .in("id", userIds);
    nameMap = new Map((profs ?? []).map((p) => [p.id as string, (p.nama_lengkap as string) ?? ""]));
  }
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    mode: r.mode,
    external_request_id: r.external_request_id,
    sent_at: r.sent_at,
    completed_at: r.completed_at,
    created_at: r.created_at,
    provider_code: r.provider?.code ?? "",
    provider_name: r.provider?.name ?? "",
    doc_number: r.document?.doc_number ?? null,
    doc_name: r.document?.name ?? null,
    signer_names: r.signers.map((s) => (s.user_id ? nameMap.get(s.user_id) ?? "—" : s.position ?? "—")),
  }));
}
