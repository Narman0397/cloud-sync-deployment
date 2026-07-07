// Phase 4 — Dashboard server functions (role-scoped, RLS-enforced).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserContext } from "@/features/rbac/guards";
import { getOverview } from "@/features/dashboard/services/dashboard-overview.service";
import {
  getWorkflowStats,
  listActiveWorkflowInstances,
} from "@/features/dashboard/services/dashboard-workflow.service";
import {
  getTaskStats,
  getWorkloadPerUser,
} from "@/features/dashboard/services/dashboard-task.service";
import { getDocumentStats } from "@/features/dashboard/services/dashboard-document.service";
import { getSignatureStats } from "@/features/dashboard/services/dashboard-signature.service";
import { getHealth, getAlerts } from "@/features/dashboard/services/dashboard-health.service";

async function scopeFor(supabase: Parameters<typeof getUserContext>[0], userId: string) {
  const ctx = await getUserContext(supabase, userId);
  return { opdId: ctx.opdId, isElevated: ctx.isElevated, ctx };
}

async function logView(
  supabase: Parameters<typeof getUserContext>[0],
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("workflow_audit_logs").insert({
      action,
      user_id: userId,
      resource_type: "dashboard",
      metadata: { ...metadata, source: "dashboard" },
    });
  } catch {
    // non-fatal
  }
}

export const dashOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    await logView(context.supabase, context.userId, "dashboard.view", { module: "overview" });
    return await getOverview(context.supabase, { opdId: s.opdId, isElevated: s.isElevated });
  });

export const dashWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    const scope = { opdId: s.opdId, isElevated: s.isElevated };
    await logView(context.supabase, context.userId, "monitoring.view", { module: "workflow" });
    const [stats, rows] = await Promise.all([
      getWorkflowStats(context.supabase, scope),
      listActiveWorkflowInstances(context.supabase, scope, 100),
    ]);
    return { stats, rows };
  });

export const dashTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    const scope = { opdId: s.opdId, isElevated: s.isElevated };
    await logView(context.supabase, context.userId, "monitoring.view", { module: "tasks" });
    const [stats, workload] = await Promise.all([
      getTaskStats(context.supabase, scope, context.userId),
      getWorkloadPerUser(context.supabase, scope),
    ]);
    return { stats, workload };
  });

export const dashDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    await logView(context.supabase, context.userId, "monitoring.view", { module: "documents" });
    return await getDocumentStats(context.supabase, { opdId: s.opdId, isElevated: s.isElevated });
  });

export const dashSignature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    await logView(context.supabase, context.userId, "monitoring.view", { module: "signature" });
    return await getSignatureStats(context.supabase, { opdId: s.opdId, isElevated: s.isElevated });
  });

export const dashHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    if (!s.isElevated) throw new Error("Forbidden");
    await logView(context.supabase, context.userId, "monitoring.view", { module: "health" });
    const [health, alerts] = await Promise.all([
      getHealth(context.supabase),
      getAlerts(context.supabase),
    ]);
    return { health, alerts };
  });

export const dashExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { module: "overview" | "workflow" | "tasks" | "documents" | "signature" }) => data)
  .handler(async ({ data, context }) => {
    const s = await scopeFor(context.supabase, context.userId);
    const scope = { opdId: s.opdId, isElevated: s.isElevated };
    await logView(context.supabase, context.userId, "dashboard.export", { module: data.module });
    const generated_at = new Date().toISOString();
    if (data.module === "overview") {
      return { module: "overview" as const, generated_at, payload: await getOverview(context.supabase, scope) };
    }
    if (data.module === "workflow") {
      return { module: "workflow" as const, generated_at, payload: await listActiveWorkflowInstances(context.supabase, scope, 1000) };
    }
    if (data.module === "tasks") {
      return { module: "tasks" as const, generated_at, payload: await getWorkloadPerUser(context.supabase, scope) };
    }
    if (data.module === "documents") {
      return { module: "documents" as const, generated_at, payload: await getDocumentStats(context.supabase, scope) };
    }
    return { module: "signature" as const, generated_at, payload: await getSignatureStats(context.supabase, scope) };
  });
