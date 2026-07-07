// Phase 4 — Signature monitoring (per provider).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Scope } from "./dashboard-overview.service";

type SB = SupabaseClient<Database>;

export interface SignatureStats {
  pending: number;
  signedToday: number;
  rejected: number;
  expired: number;
  failed: number;
  perProvider: Array<{
    code: string;
    name: string;
    pending: number;
    signed: number;
    failed: number;
  }>;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getSignatureStats(supabase: SB, scope: Scope): Promise<SignatureStats> {
  const today = startOfTodayIso();
  let q = supabase
    .from("signature_requests")
    .select("status,completed_at,provider:signature_providers(code,name),opd_id")
    .limit(5000);
  if (!scope.isElevated && scope.opdId) q = q.eq("opd_id", scope.opdId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    status: string;
    completed_at: string | null;
    provider: { code: string; name: string } | null;
    opd_id: string | null;
  }>;
  const totals = { pending: 0, signedToday: 0, rejected: 0, expired: 0, failed: 0 };
  const provMap = new Map<
    string,
    { code: string; name: string; pending: number; signed: number; failed: number }
  >();
  for (const r of rows) {
    if (r.status === "pending" || r.status === "sent") totals.pending += 1;
    if (r.status === "rejected") totals.rejected += 1;
    if (r.status === "expired") totals.expired += 1;
    if (r.status === "failed") totals.failed += 1;
    if (r.status === "signed" && r.completed_at && r.completed_at >= today) {
      totals.signedToday += 1;
    }
    const code = r.provider?.code ?? "unknown";
    const cur =
      provMap.get(code) ?? { code, name: r.provider?.name ?? code, pending: 0, signed: 0, failed: 0 };
    if (r.status === "pending" || r.status === "sent") cur.pending += 1;
    if (r.status === "signed") cur.signed += 1;
    if (r.status === "failed") cur.failed += 1;
    provMap.set(code, cur);
  }
  return { ...totals, perProvider: Array.from(provMap.values()) };
}
