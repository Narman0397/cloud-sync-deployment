// Dashboard operasional TTE: agregasi event provider 7 hari terakhir,
// dipakai oleh tim ops untuk memantau success-rate, kegagalan, dan throughput.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext } from "@/features/rbac/guards";

export const tteOpsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const c = await getUserContext(supabaseAdmin, context.userId);
    if (!c.isSuper && !c.isAdminOpd && !c.isPimpinan) throw new Error("Forbidden");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("signature_events")
      .select("event,created_at")
      .gte("created_at", since)
      .limit(50_000);
    if (error) throw new Error(error.message);
    const byEvent: Record<string, number> = {};
    const daily: Record<string, number> = {};
    for (const r of rows ?? []) {
      const ev = String(r.event ?? "unknown");
      byEvent[ev] = (byEvent[ev] ?? 0) + 1;
      const d = String(r.created_at ?? "").slice(0, 10);
      if (d) daily[d] = (daily[d] ?? 0) + 1;
    }
    const total = (rows ?? []).length;
    const ok = (byEvent["signed"] ?? 0) + (byEvent["verified"] ?? 0);
    const failed = (byEvent["failed"] ?? 0) + (byEvent["error"] ?? 0);
    return {
      windowDays: data.days,
      total,
      successRate: total > 0 ? Math.round((ok / total) * 10_000) / 100 : 0,
      failed,
      byEvent,
      daily,
    };
  });
