// Phase 3B — Signature monitoring (counts per status & provider failures).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export interface MonitoringSnapshot {
  pending: number;
  sent: number;
  signed: number;
  rejected: number;
  expired: number;
  cancelled: number;
  failed: number;
  total: number;
  perProvider: Array<{ code: string; name: string; failed: number; pending: number }>;
}

export async function getMonitoring(supabase: SB): Promise<MonitoringSnapshot> {
  const { data, error } = await supabase
    .from("signature_requests")
    .select("status,provider:signature_providers(code,name)");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{
    status: string;
    provider: { code: string; name: string } | null;
  }>;
  const counts = {
    pending: 0,
    sent: 0,
    signed: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
    failed: 0,
    total: rows.length,
  };
  const provMap = new Map<string, { code: string; name: string; failed: number; pending: number }>();
  for (const r of rows) {
    if (r.status in counts) (counts as Record<string, number>)[r.status] += 1;
    const code = r.provider?.code ?? "unknown";
    const cur = provMap.get(code) ?? { code, name: r.provider?.name ?? code, failed: 0, pending: 0 };
    if (r.status === "failed") cur.failed += 1;
    if (r.status === "pending" || r.status === "sent") cur.pending += 1;
    provMap.set(code, cur);
  }
  return { ...counts, perProvider: Array.from(provMap.values()) };
}
