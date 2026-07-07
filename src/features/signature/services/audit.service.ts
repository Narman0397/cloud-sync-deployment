// Phase 3B — Signature audit helpers.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export type SignatureEventName =
  | "requested"
  | "sent"
  | "viewed"
  | "signed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "downloaded"
  | "webhook_received"
  | "retry"
  | "failed";

export async function writeSigEvent(
  supabase: SB,
  args: {
    requestId: string;
    signerId?: string | null;
    event: SignatureEventName;
    payload?: Record<string, unknown>;
    actor?: string | null;
  },
): Promise<void> {
  await supabase.from("signature_events").insert({
    request_id: args.requestId,
    signer_id: args.signerId ?? null,
    event: args.event,
    payload: (args.payload ?? {}) as unknown as Json,
    actor: args.actor ?? null,
  });
}
