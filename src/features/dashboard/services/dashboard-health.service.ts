// Phase 4 — System Health & Alert Center.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export interface HealthSnapshot {
  workflowRuntime: { stuckSubmissions: number; lastActivity: string | null };
  documentRuntime: { failedGen: number };
  signatureRuntime: { failed: number; webhookErrors: number };
  failedJobs: number;
  deadLetter: number;
  retryQueue: number;
  providers: Array<{ code: string; name: string; active: boolean }>;
}

export async function getHealth(supabase: SB): Promise<HealthSnapshot> {
  const nowMinusDay = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  // Stuck: pending/in_progress tasks older than 24h.
  const { count: stuckCount } = await supabase
    .from("submission_tasks")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "in_progress"])
    .lt("updated_at", nowMinusDay);
  const { data: lastAct } = await supabase
    .from("workflow_audit_logs")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: failedGen } = await supabase
    .from("generated_documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: failedSig } = await supabase
    .from("signature_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: webhookErrors } = await supabase
    .from("signature_events")
    .select("id", { count: "exact", head: true })
    .eq("event", "webhook_error");

  const { count: failedJobs } = await supabase
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");
  const { count: deadLetter } = await supabase
    .from("dead_letter_jobs")
    .select("id", { count: "exact", head: true });
  const { count: retryQueue } = await supabase
    .from("retry_queue")
    .select("id", { count: "exact", head: true });

  const { data: provs } = await supabase
    .from("signature_providers")
    .select("code,name,status");
  const providers = ((provs ?? []) as Array<{ code: string; name: string; status: string }>).map(
    (p) => ({ code: p.code, name: p.name, active: p.status === "active" }),
  );

  return {
    workflowRuntime: { stuckSubmissions: stuckCount ?? 0, lastActivity: lastAct?.created_at ?? null },
    documentRuntime: { failedGen: failedGen ?? 0 },
    signatureRuntime: { failed: failedSig ?? 0, webhookErrors: webhookErrors ?? 0 },
    failedJobs: failedJobs ?? 0,
    deadLetter: deadLetter ?? 0,
    retryQueue: retryQueue ?? 0,
    providers,
  };
}

export interface AlertItem {
  kind: string;
  message: string;
  count: number;
  severity: "info" | "warning" | "critical";
}

export async function getAlerts(supabase: SB): Promise<AlertItem[]> {
  const h = await getHealth(supabase);
  const out: AlertItem[] = [];
  if (h.workflowRuntime.stuckSubmissions > 0)
    out.push({
      kind: "workflow_stuck",
      message: "Workflow stuck > 24 jam",
      count: h.workflowRuntime.stuckSubmissions,
      severity: "warning",
    });
  if (h.signatureRuntime.failed > 0)
    out.push({
      kind: "signature_failed",
      message: "Signature gagal",
      count: h.signatureRuntime.failed,
      severity: "critical",
    });
  if (h.documentRuntime.failedGen > 0)
    out.push({
      kind: "document_failed",
      message: "Generate dokumen gagal",
      count: h.documentRuntime.failedGen,
      severity: "critical",
    });
  if (h.signatureRuntime.webhookErrors > 0)
    out.push({
      kind: "webhook_error",
      message: "Webhook signature error",
      count: h.signatureRuntime.webhookErrors,
      severity: "warning",
    });
  if (h.failedJobs > 0)
    out.push({
      kind: "job_failed",
      message: "Background job gagal",
      count: h.failedJobs,
      severity: "warning",
    });
  return out;
}
