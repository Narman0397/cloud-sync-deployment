// Phase 2A — Audit helper untuk Workflow Builder (tabel workflow_audit_logs).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export type WorkflowAuditAction =
  | "workflow.create"
  | "workflow.update"
  | "workflow.publish"
  | "workflow.archive"
  | "workflow.clone"
  | "workflow.version.create"
  | "node.add"
  | "node.remove"
  | "edge.add"
  | "edge.remove"
  | "assignment.update"
  | "sla.update"
  | "escalation.update"
  | "template.create"
  | "template.publish"
  | "template.clone"
  | "template.archive"
  | "template.import";

export type WorkflowAuditResource =
  | "workflow"
  | "workflow_version"
  | "workflow_template"
  | "workflow_node"
  | "workflow_edge";

export interface WorkflowAuditEntry {
  action: WorkflowAuditAction;
  resource_type: WorkflowAuditResource;
  resource_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeWorkflowAudit(supabase: SB, entry: WorkflowAuditEntry): Promise<void> {
  try {
    await supabase.from("workflow_audit_logs").insert({
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      user_id: entry.user_id ?? null,
      metadata: (entry.metadata ?? {}) as Json,
    });
  } catch {
    /* best-effort */
  }
}
