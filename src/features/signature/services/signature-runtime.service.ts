// Phase 3B — Signature runtime: build request from generated_document, send to provider.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { getProvider } from "../providers/registry";
import type { SendDocumentInput, SignerDescriptor } from "../providers/types";
import { resolveSigner, type SignerInput } from "./signer-resolver.service";
import { writeSigEvent } from "./audit.service";
import { sha256Hex } from "./qr-verification.service";

type SB = SupabaseClient<Database>;

export interface CreateSignatureRequestArgs {
  generatedDocumentId: string;
  providerCode: string;
  mode: "sequential" | "parallel";
  signers: SignerInput[];
  createdBy: string;
  callbackBaseUrl: string;
  submissionId?: string | null;
  opdId?: string | null;
}

export interface CreateSignatureRequestResult {
  requestId: string;
  externalRequestId: string | null;
  status: string;
}

async function downloadGeneratedDocument(
  supabase: SB,
  generatedDocumentId: string,
): Promise<{ bytes: Uint8Array; mime: string; name: string; docNumber: string | null }> {
  const { data: gd, error } = await supabase
    .from("generated_documents")
    .select("id,storage_path,mime,name,doc_number")
    .eq("id", generatedDocumentId)
    .maybeSingle();
  if (error || !gd) throw new Error("Generated document tidak ditemukan");
  const { data: blob, error: dErr } = await supabase.storage
    .from("documents")
    .download(gd.storage_path as string);
  if (dErr || !blob) throw new Error(`Unduh dokumen gagal: ${dErr?.message ?? "no body"}`);
  const buf = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes: buf,
    mime: (gd.mime as string) ?? "application/pdf",
    name: (gd.name as string) ?? (gd.doc_number as string) ?? "document",
    docNumber: (gd.doc_number as string | null) ?? null,
  };
}

export async function createSignatureRequest(
  supabase: SB,
  args: CreateSignatureRequestArgs,
): Promise<CreateSignatureRequestResult> {
  const { data: prov, error: provErr } = await supabase
    .from("signature_providers")
    .select("id,code,config,status,webhook_secret")
    .eq("code", args.providerCode)
    .maybeSingle();
  if (provErr || !prov) throw new Error(`Provider ${args.providerCode} tidak ditemukan`);
  if ((prov.status as string) !== "active") throw new Error("Provider tidak aktif");

  const doc = await downloadGeneratedDocument(supabase, args.generatedDocumentId);
  const fileHash = await sha256Hex(doc.bytes);

  // Insert request
  const { data: req, error: rErr } = await supabase
    .from("signature_requests")
    .insert({
      generated_document_id: args.generatedDocumentId,
      submission_id: args.submissionId ?? null,
      provider_id: prov.id as string,
      mode: args.mode,
      status: "pending",
      file_hash: fileHash,
      created_by: args.createdBy,
      opd_id: args.opdId ?? null,
    })
    .select("id")
    .single();
  if (rErr || !req) throw new Error(rErr?.message ?? "Gagal membuat request");

  // Resolve & insert signers
  const resolved: SignerDescriptor[] = [];
  for (let i = 0; i < args.signers.length; i++) {
    const s = args.signers[i];
    const r = await resolveSigner(supabase, { ...s, order_index: s.order_index ?? i });
    if (!r) throw new Error(`Signer #${i + 1} tidak dapat di-resolve`);
    const { data: row, error: sErr } = await supabase
      .from("signature_request_signers")
      .insert({
        request_id: req.id as string,
        order_index: r.order_index,
        signer_type: s.signer_type,
        user_id: r.user_id,
        role: s.role ?? null,
        position: r.position,
        opd_id: s.opd_id ?? null,
        status: "pending",
      })
      .select("id")
      .single();
    if (sErr || !row) throw new Error(sErr?.message ?? "Gagal insert signer");
    resolved.push({
      id: row.id as string,
      full_name: r.full_name,
      nip: r.nip,
      position: r.position,
      order_index: r.order_index,
    });
  }

  await writeSigEvent(supabase, {
    requestId: req.id as string,
    event: "requested",
    actor: args.createdBy,
    payload: { provider: args.providerCode, mode: args.mode, hash: fileHash },
  });

  // Send to provider
  const provider = getProvider(args.providerCode);
  try {
    const input: SendDocumentInput = {
      requestId: req.id as string,
      documentName: doc.name,
      documentBytes: doc.bytes,
      mime: doc.mime,
      mode: args.mode,
      signers: resolved,
      callbackUrl: `${args.callbackBaseUrl.replace(/\/$/, "")}/api/public/hooks/signature-webhook/${args.providerCode}`,
      config: (prov.config as Record<string, unknown>) ?? {},
    };
    const sent = await provider.sendDocument(input);
    await supabase
      .from("signature_requests")
      .update({
        external_request_id: sent.externalRequestId,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", req.id as string);
    await supabase
      .from("signature_request_signers")
      .update({ status: "sent" })
      .eq("request_id", req.id as string);
    await writeSigEvent(supabase, {
      requestId: req.id as string,
      event: "sent",
      actor: args.createdBy,
      payload: { external_request_id: sent.externalRequestId } as unknown as Record<string, unknown>,
    });
    // Provider internal → langsung tanda tangan (tidak perlu callback eksternal).
    if (args.providerCode === "internal") {
      const { signRequestInternally } = await import("./internal-signer.service");
      const res = await signRequestInternally(supabase, req.id as string, args.callbackBaseUrl);
      return {
        requestId: req.id as string,
        externalRequestId: sent.externalRequestId,
        status: res.status,
      };
    }
    return { requestId: req.id as string, externalRequestId: sent.externalRequestId, status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("signature_requests")
      .update({ status: "failed", error: msg })
      .eq("id", req.id as string);
    await writeSigEvent(supabase, {
      requestId: req.id as string,
      event: "failed",
      actor: args.createdBy,
      payload: { error: msg } as unknown as Record<string, unknown>,
    });
    return { requestId: req.id as string, externalRequestId: null, status: "failed" };
  }
}

export type { Json };
