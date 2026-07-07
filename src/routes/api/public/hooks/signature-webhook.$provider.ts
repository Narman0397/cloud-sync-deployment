// Phase 3B — Public webhook endpoint for signature providers.
import { createFileRoute } from "@tanstack/react-router";
import { handleProviderWebhook } from "@/features/signature/services/webhook.service";

export const Route = createFileRoute("/api/public/hooks/signature-webhook/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = params.provider;
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const result = await handleProviderWebhook(supabaseAdmin, provider, request.headers, raw);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
