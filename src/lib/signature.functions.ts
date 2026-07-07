// Phase 3B — Signature server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createSignatureRequest,
  type CreateSignatureRequestArgs,
} from "@/features/signature/services/signature-runtime.service";
import { listQueue, type QueueFilters } from "@/features/signature/services/signature-queue.service";
import { getMonitoring } from "@/features/signature/services/signature-monitoring.service";
import { retrySignatureRequest } from "@/features/signature/services/retry.service";
import { writeSigEvent } from "@/features/signature/services/audit.service";
import { sha256Hex, buildVerificationUrl, qrDataUrl } from "@/features/signature/services/qr-verification.service";
import { getProvider } from "@/features/signature/providers/registry";
import type { SignerInput } from "@/features/signature/services/signer-resolver.service";

function publicBaseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ??
    process.env.VITE_PUBLIC_BASE_URL ??
    process.env.SUPABASE_URL ??
    "http://localhost:8080"
  );
}

export const sigSendDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      generatedDocumentId: string;
      providerCode: string;
      mode: "sequential" | "parallel";
      signers: SignerInput[];
      submissionId?: string | null;
      opdId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const args: CreateSignatureRequestArgs = {
      generatedDocumentId: data.generatedDocumentId,
      providerCode: data.providerCode,
      mode: data.mode,
      signers: data.signers,
      createdBy: context.userId,
      callbackBaseUrl: publicBaseUrl(),
      submissionId: data.submissionId ?? null,
      opdId: data.opdId ?? null,
    };
    return await createSignatureRequest(context.supabase, args);
  });

export const sigGetStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: req, error } = await context.supabase
      .from("signature_requests")
      .select(
        "id,status,mode,external_request_id,file_hash,sent_at,completed_at,error,created_at,provider:signature_providers(code,name),document:generated_documents(id,doc_number,name,status),signers:signature_request_signers(id,order_index,signer_type,user_id,role,position,status,signed_at,rejected_at,reject_reason)",
      )
      .eq("id", data.requestId)
      .maybeSingle();
    if (error || !req) throw new Error("Request tidak ditemukan");
    const { data: events } = await context.supabase
      .from("signature_events")
      .select("id,event,payload,actor,created_at")
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: false })
      .limit(200);
    return { request: req, events: events ?? [] };
  });

export const sigRetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const { data: isPemda } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin_pemda",
    });
    if (!isAdmin && !isPemda) throw new Error("Forbidden");
    return await retrySignatureRequest(context.supabase, data.requestId, context.userId, publicBaseUrl());
  });

export const sigCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase
      .from("signature_requests")
      .select("id,external_request_id,provider:signature_providers(code,config)")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) throw new Error("Request tidak ditemukan");
    const prov = (req as unknown as { provider: { code: string; config: Record<string, unknown> } }).provider;
    if (prov && req.external_request_id) {
      try {
        await getProvider(prov.code).cancelRequest(
          req.external_request_id as string,
          data.reason,
          prov.config ?? {},
        );
      } catch {
        /* best-effort */
      }
    }
    await context.supabase
      .from("signature_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.requestId);
    await writeSigEvent(context.supabase, {
      requestId: data.requestId,
      event: "cancelled",
      actor: context.userId,
      payload: { reason: data.reason },
    });
    return { ok: true };
  });

export const sigListQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filters?: QueueFilters }) => data)
  .handler(async ({ data, context }) => ({
    rows: await listQueue(context.supabase, data.filters ?? {}),
  }));

export const sigProcessInternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data, context }) => {
    const { signRequestInternally } = await import(
      "@/features/signature/services/internal-signer.service"
    );
    return await signRequestInternally(context.supabase, data.requestId, publicBaseUrl());
  });

export const sigRunQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const { data: okOpd } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin_opd",
    });
    if (!ok && !okOpd) throw new Error("Forbidden");
    const { processInternalQueue } = await import(
      "@/features/signature/services/internal-signer.service"
    );
    return await processInternalQueue(context.supabase, publicBaseUrl(), 25);
  });


export const sigListMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ snapshot: await getMonitoring(context.supabase) }));

export const sigListProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("signature_providers")
      .select("id,code,name,kind,status,config")
      .order("name");
    if (error) throw new Error(error.message);
    return { providers: data ?? [] };
  });

export const sigToggleProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: "active" | "disabled" }) => data)
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!ok) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("signature_providers")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sigGetVerification = createServerFn({ method: "GET" })
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin
      .from("signature_requests")
      .select(
        "id,status,file_hash,completed_at,document:generated_documents(doc_number,name,generated_at,storage_path),signers:signature_request_signers(order_index,position,status,signed_at,user_id)",
      )
      .eq("id", data.requestId)
      .maybeSingle();
    if (!req) {
      return { valid: false, reason: "not_found" as const };
    }
    // Fetch signer names without exposing IDs
    const ids = (req.signers ?? [])
      .map((s) => (s as { user_id: string | null }).user_id)
      .filter((x): x is string => !!x);
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,nama_lengkap,nip,jabatan").in("id", ids)
      : { data: [] };
    const pmap = new Map(
      (profs ?? []).map((p) => [
        p.id as string,
        {
          name: (p.nama_lengkap as string) ?? "",
          nip: (p.nip as string | null) ?? null,
          jabatan: (p.jabatan as string | null) ?? null,
        },
      ]),
    );
    // Hash check vs signed file (if archived)
    let hashMatch: boolean | null = null;
    let storedHash: string | null = (req.file_hash as string | null) ?? null;
    try {
      const signedPath = `signed/${req.id}.pdf`;
      const { data: blob } = await supabaseAdmin.storage.from("signed-documents").download(signedPath);
      if (blob) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        const h = await sha256Hex(buf);
        hashMatch = h === storedHash || storedHash === null;
        storedHash = h;
      }
    } catch {
      /* signed file not yet archived */
    }
    const verifyUrl = buildVerificationUrl(publicBaseUrl(), req.id as string);
    const qr = await qrDataUrl(verifyUrl);
    return {
      valid: true as const,
      request: {
        id: req.id as string,
        status: req.status as string,
        completed_at: req.completed_at as string | null,
        doc_number: (req.document as { doc_number: string | null } | null)?.doc_number ?? null,
        doc_name: (req.document as { name: string | null } | null)?.name ?? null,
        doc_date: (req.document as { generated_at: string | null } | null)?.generated_at ?? null,
        hash: storedHash,
        hash_match: hashMatch,
        verify_url: verifyUrl,
        qr_data_url: qr,
        signers: (req.signers ?? [])
          .map((s) => {
            const sr = s as {
              order_index: number;
              position: string | null;
              status: string;
              signed_at: string | null;
              user_id: string | null;
            };
            const p = sr.user_id ? pmap.get(sr.user_id) : undefined;
            return {
              order_index: sr.order_index,
              name: p?.name ?? "—",
              nip: p?.nip ?? null,
              position: p?.jabatan ?? sr.position,
              status: sr.status,
              signed_at: sr.signed_at,
            };
          })
          .sort((a, b) => a.order_index - b.order_index),
      },
    };
  });

// ============ PROVIDER MANAGEMENT (Super Admin) ============
export const sigUpsertProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      code: string;
      name: string;
      kind: "internal";
      status?: "active" | "disabled";
      config?: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!ok) throw new Error("Forbidden");
    const payload = {
      code: data.code.trim().toLowerCase(),
      name: data.name.trim(),
      kind: data.kind,
      status: data.status ?? "disabled",
      config: (data.config ?? {}) as never,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("signature_providers")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("signature_providers")
      .insert(payload as never)
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Gagal menyimpan provider");
    return { id: (row as { id: string }).id };
  });

export const sigDeleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!ok) throw new Error("Forbidden");
    // Block delete if any signature_requests reference this provider
    const { count } = await context.supabase
      .from("signature_requests")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`Tidak bisa menghapus: ${count} permintaan TTE terhubung.`);
    }
    const { error } = await context.supabase
      .from("signature_providers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sigGetProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("signature_providers")
      .select("id,code,name,kind,status,config")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Provider tidak ditemukan");
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const masked: Record<string, string> = {};
    const secretKeys = ["password", "secret", "client_secret", "api_key", "token"];
    for (const [k, v] of Object.entries(cfg)) {
      masked[k] =
        secretKeys.includes(k.toLowerCase()) && v
          ? "••••••••"
          : typeof v === "string"
            ? v
            : JSON.stringify(v);
    }
    return {
      provider: {
        id: row.id as string,
        code: row.code as string,
        name: row.name as string,
        kind: (row.kind as string | null) ?? "",
        status: row.status as string,
        config: masked,
        config_keys: Object.keys(cfg),
      },
    };
  });

// ============ UNIFIED DOCUMENT DETAIL ============
export const docGetUnified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("generated_documents")
      .select(
        "id,doc_number,name,status,mime,size_bytes,generated_at,archived_at,template_id,submission_id,storage_path",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Dokumen tidak ditemukan");
    const { data: rawReqs } = await context.supabase
      .from("signature_requests")
      .select("id,status,mode,sent_at,completed_at,error,provider_id")
      .eq("generated_document_id", data.id)
      .order("created_at", { ascending: false });
    const reqs = rawReqs ?? [];
    const providerIds = Array.from(
      new Set(reqs.map((r) => r.provider_id).filter((x): x is string => !!x)),
    );
    const { data: provs } = providerIds.length
      ? await context.supabase
          .from("signature_providers")
          .select("id,code,name")
          .in("id", providerIds)
      : { data: [] };
    const pmap = new Map(
      (provs ?? []).map((p) => [
        p.id as string,
        { code: p.code as string, name: p.name as string },
      ]),
    );
    const requests = reqs.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      mode: (r.mode as string | null) ?? "",
      sent_at: r.sent_at as string | null,
      completed_at: r.completed_at as string | null,
      error: r.error as string | null,
      provider: r.provider_id ? pmap.get(r.provider_id as string) ?? null : null,
    }));
    const { data: history } = await context.supabase
      .from("document_history")
      .select("id,action,actor_id,metadata,created_at")
      .eq("document_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);
    return { document: doc, requests, history: history ?? [] };
  });

// ============ WIZARD HELPERS ============
export const docListSubmissionsForTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { templateId?: string; q?: string }) => data)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("form_submissions")
      .select("id,form_id,status,submitted_at,opd_id")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (data.q) q = q.ilike("id", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
