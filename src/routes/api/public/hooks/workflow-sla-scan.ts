// Phase 2B — Workflow Runtime SLA scanner (overdue task → escalation).
import { createFileRoute } from "@tanstack/react-router";
import { verifyCronCaller } from "@/lib/cron-auth.server";
import { log } from "@/lib/logger";

export const Route = createFileRoute("/api/public/hooks/workflow-sla-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = verifyCronCaller(request);
        if (unauth) return unauth;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runSlaScan } = await import(
            "@/features/workflows/runtime/escalation-engine.service"
          );
          const result = await runSlaScan(supabaseAdmin);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          log.error("workflow-sla-scan.fail", {
            error: e instanceof Error ? e.message : String(e),
          });
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
