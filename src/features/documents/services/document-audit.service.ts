// Phase 3A — Audit helper for document events (uses public.audit_log + document_history).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;
export type DocAction =
  | "document.template.created"
  | "document.template.updated"
  | "document.template.cloned"
  | "document.template.published"
  | "document.template.archived"
  | "document.generated"
  | "document.downloaded"
  | "document.archived"
  | "document.number.assigned"
  | "document.numbering.rule.created"
  | "document.numbering.rule.updated";

export async function writeDocAudit(
  supabase: SB,
  args: {
    action: DocAction;
    user_id: string | null;
    entity: string;
    entity_id: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      user_id: args.user_id,
      aksi: args.action,
      entitas: args.entity,
      entitas_id: args.entity_id,
      data_sesudah: (args.metadata ?? {}) as Json,
    });
  } catch {
    /* best-effort */
  }
}

export async function writeDocHistory(
  supabase: SB,
  args: {
    document_id: string;
    action:
      | "created"
      | "generated"
      | "downloaded"
      | "archived"
      | "sent_for_signature"
      | "signed"
      | "rejected"
      | "restored";
    actor_id: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("document_history").insert({
      document_id: args.document_id,
      action: args.action,
      actor_id: args.actor_id,
      metadata: (args.metadata ?? {}) as Json,
    });
  } catch {
    /* best-effort */
  }
}
