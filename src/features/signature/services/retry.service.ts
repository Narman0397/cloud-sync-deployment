// Phase 3B — Retry engine: re-send same request to provider without creating a new one.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getProvider } from "../providers/registry";
import { writeSigEvent } from "./audit.service";

type SB = SupabaseClient<Database>;

export async function retrySignatureRequest(
  supabase: SB,
  requestId: string,
  actorId: string,
  callbackBaseUrl: string,
): Promise<{ ok: boolean; status: string; externalRequestId: string | null }> {
  const { data: req, error } = await supabase
    .from("signature_requests")
    .select(
      "id,status,mode,generated_document_id,provider:signature_providers(code,config)",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error || !req) throw new Error("Request tidak ditemukan");
  const prov = (req as unknown as { provider: { code: string; config: Record<string, unknown> } }).provider;
  if (!prov) throw new Error("Provider tidak terhubung");

  await writeSigEvent(supabase, { requestId, event: "retry", actor: actorId });

  const { data: gd } = await supabase
    .from("generated_documents")
    .select("storage_path,mime,name,doc_number")
    .eq("id", req.generated_document_id as string)
    .maybeSingle();
  if (!gd) throw new Error("Generated document tidak ditemukan");
  const { data: blob, error: dErr } = await supabase.storage
    .from("documents")
    .download(gd.storage_path as string);
  if (dErr || !blob) throw new Error("Unduh dokumen gagal");

  const { data: signers } = await supabase
    .from("signature_request_signers")
    .select("id,order_index,user_id,position")
    .eq("request_id", requestId)
    .order("order_index", { ascending: true });
  const userIds = (signers ?? []).map((s) => s.user_id as string).filter(Boolean);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id,nama_lengkap,nip")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const pmap = new Map((profs ?? []).map((p) => [p.id as string, p]));

  const provider = getProvider(prov.code);
  try {
    const sent = await provider.sendDocument({
      requestId,
      documentName: (gd.name as string) ?? (gd.doc_number as string) ?? "document",
      documentBytes: new Uint8Array(await blob.arrayBuffer()),
      mime: (gd.mime as string) ?? "application/pdf",
      mode: (req.mode as "sequential" | "parallel") ?? "sequential",
      signers: (signers ?? []).map((s) => {
        const p = s.user_id ? pmap.get(s.user_id as string) : undefined;
        return {
          id: s.id as string,
          full_name: (p?.nama_lengkap as string | undefined) ?? "",
          nip: (p?.nip as string | null | undefined) ?? null,
          position: (s.position as string | null) ?? null,
          order_index: (s.order_index as number) ?? 0,
        };
      }),
      callbackUrl: `${callbackBaseUrl.replace(/\/$/, "")}/api/public/hooks/signature-webhook/${prov.code}`,
      config: prov.config ?? {},
    });
    await supabase
      .from("signature_requests")
      .update({
        external_request_id: sent.externalRequestId,
        status: "sent",
        error: null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    await writeSigEvent(supabase, {
      requestId,
      event: "sent",
      actor: actorId,
      payload: { external_request_id: sent.externalRequestId } as unknown as Record<string, unknown>,
    });
    if (prov.code === "internal") {
      const { signRequestInternally } = await import("./internal-signer.service");
      const res = await signRequestInternally(supabase, requestId, callbackBaseUrl);
      return { ok: res.status === "signed", status: res.status, externalRequestId: sent.externalRequestId };
    }
    return { ok: true, status: "sent", externalRequestId: sent.externalRequestId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("signature_requests")
      .update({ status: "failed", error: msg })
      .eq("id", requestId);
    await writeSigEvent(supabase, {
      requestId,
      event: "failed",
      actor: actorId,
      payload: { error: msg } as unknown as Record<string, unknown>,
    });
    return { ok: false, status: "failed", externalRequestId: null };
  }
}
