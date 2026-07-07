// Phase 4 — Document monitoring.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Scope } from "./dashboard-overview.service";

type SB = SupabaseClient<Database>;

export interface DocumentStats {
  generatedToday: number;
  draft: number;
  pendingSignature: number;
  signed: number;
  archived: number;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getDocumentStats(supabase: SB, scope: Scope): Promise<DocumentStats> {
  const today = startOfTodayIso();
  const base = () => {
    let q = supabase
      .from("generated_documents")
      .select("id,form_submissions!inner(opd_id)", { count: "exact", head: true });
    if (!scope.isElevated && scope.opdId) q = q.eq("form_submissions.opd_id", scope.opdId);
    return q;
  };

  const [todayQ, draftQ, pendingQ, signedQ, archivedQ] = await Promise.all([
    base().gte("generated_at", today),
    base().eq("status", "generated"),
    base().eq("status", "awaiting_signature"),
    base().eq("status", "signed"),
    base().not("archived_at", "is", null),
  ]);

  return {
    generatedToday: todayQ.count ?? 0,
    draft: draftQ.count ?? 0,
    pendingSignature: pendingQ.count ?? 0,
    signed: signedQ.count ?? 0,
    archived: archivedQ.count ?? 0,
  };
}
