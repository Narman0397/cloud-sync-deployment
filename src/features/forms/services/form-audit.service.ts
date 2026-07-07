// Phase 1B — Audit helper khusus Form Builder.
// Menulis ke tabel form_audit_logs (immutable, trigger memblokir UPDATE/DELETE).
// Dipanggil dari server functions setelah operasi sukses; kegagalan audit
// tidak boleh membatalkan operasi utama (best-effort logging).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export type FormAuditAction =
  | "form.create"
  | "form.update"
  | "form.publish"
  | "form.archive"
  | "form.clone"
  | "form.create_from_template"
  | "form.create_version"
  | "form.delete"
  | "template.create"
  | "template.publish"
  | "template.clone"
  | "template.archive"
  | "template.import";

export type FormAuditResource = "form" | "form_template" | "form_version";

export interface FormAuditEntry {
  action: FormAuditAction;
  resource_type: FormAuditResource;
  resource_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeFormAudit(supabase: SB, entry: FormAuditEntry): Promise<void> {
  try {
    await supabase.from("form_audit_logs").insert({
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      user_id: entry.user_id ?? null,
      metadata: (entry.metadata ?? {}) as Json,
    });
  } catch {
    // best-effort: jangan pernah throw dari logger
  }
}
