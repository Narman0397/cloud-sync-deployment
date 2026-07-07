// Internal signer — menyelesaikan signature_request memakai TTD spesimen internal.
// Dipanggil otomatis setelah createSignatureRequest / retry (provider = internal),
// dan bisa dijalankan ulang lewat sigProcessInternal / sigRunQueue.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { stampSignature } from "@/features/digital-signature/services/pdf.service";
import { generateQrPng } from "@/features/digital-signature/services/qr.service";
import { sha256Hex, buildVerificationUrl } from "./qr-verification.service";
import { writeSigEvent } from "./audit.service";

type SB = SupabaseClient<Database>;

export interface InternalSignResult {
  ok: boolean;
  requestId: string;
  status: "signed" | "failed";
  signedPath?: string;
  verifyUrl?: string;
  hash?: string;
  error?: string;
}

async function loadSpecimenPng(supabase: SB, userId: string | null): Promise<Uint8Array | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("digital_signatures")
    .select("signature_path")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();
  const path = (data?.signature_path as string | null) ?? null;
  if (!path) return null;
  const { data: blob } = await supabase.storage.from("signatures").download(path);
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

export async function signRequestInternally(
  supabase: SB,
  requestId: string,
  baseUrl: string,
): Promise<InternalSignResult> {
  // 1) Load request + signers + generated doc
  const { data: req, error } = await supabase
    .from("signature_requests")
    .select(
      "id,status,generated_document_id,file_hash,submission_id,document:generated_documents(id,storage_path,mime,name,doc_number),signers:signature_request_signers(id,order_index,user_id,position,status)",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error || !req) return { ok: false, requestId, status: "failed", error: "request_not_found" };
  if ((req.status as string) === "signed")
    return { ok: true, requestId, status: "signed", verifyUrl: buildVerificationUrl(baseUrl, requestId) };

  const doc = req.document as unknown as {
    id: string;
    storage_path: string;
    mime: string;
    name: string | null;
    doc_number: string | null;
  } | null;
  if (!doc) return { ok: false, requestId, status: "failed", error: "generated_document_missing" };

  const signers = ((req.signers ?? []) as unknown as Array<{
    id: string;
    order_index: number;
    user_id: string | null;
    position: string | null;
  }>).slice().sort((a, b) => a.order_index - b.order_index);
  if (signers.length === 0)
    return { ok: false, requestId, status: "failed", error: "no_signers" };

  try {
    // 2) Download PDF sumber
    const { data: srcBlob, error: dErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);
    if (dErr || !srcBlob) throw new Error(`unduh_gagal:${dErr?.message ?? "no_body"}`);
    let currentBytes = new Uint8Array(await srcBlob.arrayBuffer());

    // 3) Untuk tiap signer: load profil, load spesimen, stamp panel + QR
    const verifyUrl = buildVerificationUrl(baseUrl, requestId);
    const qrPng = await generateQrPng(verifyUrl);
    const userIds = signers.map((s) => s.user_id).filter((x): x is string => !!x);
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id,nama_lengkap,nip,jabatan").in("id", userIds)
      : { data: [] };
    const pmap = new Map(
      (profs ?? []).map((p) => [
        p.id as string,
        {
          name: (p.nama_lengkap as string | null) ?? "",
          nip: (p.nip as string | null) ?? null,
          jabatan: (p.jabatan as string | null) ?? null,
        },
      ]),
    );
    const nowIso = new Date().toISOString();

    for (const s of signers) {
      const prof = s.user_id ? pmap.get(s.user_id) : undefined;
      const specimen = await loadSpecimenPng(supabase, s.user_id);
      const stamped = await stampSignature(currentBytes, {
        qrPng,
        signaturePng: specimen,
        signerName: prof?.name ?? s.position ?? "Penandatangan",
        nip: prof?.nip ?? null,
        position: s.position ?? prof?.jabatan ?? null,
        documentNumber: doc.doc_number,
        signedAt: new Date(),
        verifyUrl,
        verificationToken: requestId,
      });
      currentBytes = new Uint8Array(stamped);
      await supabase
        .from("signature_request_signers")
        .update({ status: "signed", signed_at: nowIso })
        .eq("id", s.id);
      await writeSigEvent(supabase, {
        requestId,
        signerId: s.id,
        event: "signed",
        actor: s.user_id ?? null,
        payload: { by: prof?.name ?? s.position ?? null } as Record<string, unknown>,
      });
    }

    // 4) Hash + upload ke bucket signed-documents
    const hash = await sha256Hex(currentBytes);
    const signedPath = `signed/${requestId}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("signed-documents")
      .upload(signedPath, currentBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`upload_gagal:${upErr.message}`);

    // 5) Update request → signed
    await supabase
      .from("signature_requests")
      .update({
        status: "signed",
        completed_at: nowIso,
        file_hash: hash,
        error: null,
      })
      .eq("id", requestId);

    // 6) Update generated_documents status
    await supabase
      .from("generated_documents")
      .update({ status: "signed" })
      .eq("id", doc.id);

    await writeSigEvent(supabase, {
      requestId,
      event: "signed",
      payload: { signed_path: signedPath, hash, verify_url: verifyUrl } as Record<string, unknown>,
    });

    return { ok: true, requestId, status: "signed", signedPath, verifyUrl, hash };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("signature_requests")
      .update({ status: "failed", error: msg })
      .eq("id", requestId);
    await writeSigEvent(supabase, {
      requestId,
      event: "failed",
      payload: { error: msg } as Record<string, unknown>,
    });
    return { ok: false, requestId, status: "failed", error: msg };
  }
}

export async function processInternalQueue(
  supabase: SB,
  baseUrl: string,
  limit = 25,
): Promise<{ processed: number; signed: number; failed: number; ids: string[] }> {
  const { data } = await supabase
    .from("signature_requests")
    .select("id, provider:signature_providers(code)")
    .in("status", ["sent", "pending"])
    .order("created_at", { ascending: true })
    .limit(limit);
  const rows = ((data ?? []) as unknown as Array<{
    id: string;
    provider: { code: string } | null;
  }>).filter((r) => (r.provider?.code ?? "internal") === "internal");
  let signed = 0;
  let failed = 0;
  const ids: string[] = [];
  for (const r of rows) {
    const res = await signRequestInternally(supabase, r.id, baseUrl);
    if (res.status === "signed") signed += 1;
    else failed += 1;
    ids.push(r.id);
  }
  return { processed: rows.length, signed, failed, ids };
}
