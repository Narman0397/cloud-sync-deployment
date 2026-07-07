// Phase 3B — Webhook ingestion: validate, advance signer state, finalize.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { getProvider } from "../providers/registry";
import { writeSigEvent } from "./audit.service";
import { sha256Hex } from "./qr-verification.service";

type SB = SupabaseClient<Database>;

export interface WebhookHandleResult {
  ok: boolean;
  reason?: string;
  requestId?: string;
  newStatus?: string;
}

export async function handleProviderWebhook(
  supabase: SB,
  providerCode: string,
  headers: Headers,
  rawBody: string,
): Promise<WebhookHandleResult> {
  const { data: prov } = await supabase
    .from("signature_providers")
    .select("id,code,config,webhook_secret")
    .eq("code", providerCode)
    .maybeSingle();
  if (!prov) return { ok: false, reason: "unknown_provider" };

  const provider = getProvider(providerCode);
  const evt = provider.verifyWebhook(
    headers,
    rawBody,
    (prov.webhook_secret as string | null) ?? process.env[`${providerCode.toUpperCase()}_WEBHOOK_SECRET`] ?? null,
  );
  if (!evt) return { ok: false, reason: "invalid_webhook" };

  const { data: req } = await supabase
    .from("signature_requests")
    .select("id,status,mode,generated_document_id,file_hash,submission_id")
    .eq("external_request_id", evt.externalRequestId)
    .maybeSingle();
  if (!req) return { ok: false, reason: "request_not_found" };

  await writeSigEvent(supabase, {
    requestId: req.id as string,
    event: "webhook_received",
    payload: evt.payload,
  });

  // Update signer
  if (evt.externalSignerId) {
    const updates: Database["public"]["Tables"]["signature_request_signers"]["Update"] = {};
    if (evt.event === "signed") {
      updates.status = "signed";
      updates.signed_at = new Date().toISOString();
    } else if (evt.event === "rejected") {
      updates.status = "rejected";
      updates.rejected_at = new Date().toISOString();
      updates.reject_reason = evt.reason ?? "rejected";
    } else if (evt.event === "expired") updates.status = "expired";
    else if (evt.event === "cancelled") updates.status = "cancelled";
    if (Object.keys(updates).length > 0) {
      await supabase
        .from("signature_request_signers")
        .update(updates)
        .eq("request_id", req.id as string)
        .eq("external_signer_id", evt.externalSignerId);
    }
  }

  // Map event to top-level status & log
  let newStatus: string | null = null;
  if (evt.event === "signed") {
    // Check all signers status
    const { data: signers } = await supabase
      .from("signature_request_signers")
      .select("status")
      .eq("request_id", req.id as string);
    const allSigned = (signers ?? []).every((s) => (s.status as string) === "signed");
    if (allSigned) newStatus = "signed";
  } else if (evt.event === "rejected") newStatus = "rejected";
  else if (evt.event === "expired") newStatus = "expired";
  else if (evt.event === "cancelled") newStatus = "cancelled";

  await writeSigEvent(supabase, {
    requestId: req.id as string,
    event: evt.event,
    payload: { reason: evt.reason } as unknown as Record<string, unknown>,
  });

  if (newStatus === "signed") {
    // Download signed file from provider & archive into signed-documents bucket.
    try {
      const { bytes, mime } = await provider.downloadSignedDocument(
        evt.externalRequestId,
        (prov.config as Record<string, unknown>) ?? {},
      );
      const signedPath = `signed/${req.id}.pdf`;
      await supabase.storage.from("signed-documents").upload(signedPath, bytes, {
        contentType: mime,
        upsert: true,
      });
      const signedHash = await sha256Hex(bytes);
      await supabase
        .from("generated_documents")
        .update({
          status: "signed",
          archived_at: new Date().toISOString(),
        })
        .eq("id", req.generated_document_id as string);
      await writeSigEvent(supabase, {
        requestId: req.id as string,
        event: "signed",
        payload: { signed_path: signedPath, hash: signedHash } as unknown as Record<string, unknown>,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await writeSigEvent(supabase, {
        requestId: req.id as string,
        event: "failed",
        payload: { error: `download_failed: ${msg}` } as unknown as Record<string, unknown>,
      });
    }
  }

  if (newStatus) {
    await supabase
      .from("signature_requests")
      .update({
        status: newStatus,
        completed_at: ["signed", "rejected", "expired", "cancelled"].includes(newStatus)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", req.id as string);
  }

  return { ok: true, requestId: req.id as string, newStatus: newStatus ?? undefined };
}

export type { Json };
