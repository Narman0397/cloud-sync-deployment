// Phase 3A — Numbering service.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export async function assignDocumentNumber(
  supabase: SB,
  args: { rule_id: string; opd_id?: string | null; category?: string | null },
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_doc_next_number", {
    _rule_id: args.rule_id,
    _opd_id: args.opd_id ?? undefined,
    _category: args.category ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export function previewFormat(
  format: string,
  opts: { opd?: string; opd_code?: string; category?: string; padding?: number },
): string {
  const seq = "1".padStart(opts.padding ?? 6, "0");
  const now = new Date();
  return format
    .replace("{YEAR}", String(now.getFullYear()))
    .replace("{MONTH}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace("{SEQ}", seq)
    .replace("{OPD}", opts.opd ?? "OPD")
    .replace("{OPD_CODE}", opts.opd_code ?? "000")
    .replace("{CATEGORY}", opts.category ?? "");
}
