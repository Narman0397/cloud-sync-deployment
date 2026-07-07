// Document Center — server functions terpusat.
// Menyediakan inbox tugas, list dokumen ter-filter, timeline aktivitas gabungan,
// global search, detail dokumen, dan quick action.
// Semua RLS-aware via requireSupabaseAuth.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- INBOX ----------
export interface InboxCounts {
  pendingReview: number;
  pendingSignature: number;
  needsRevision: number;
  failed: number;
  overdueSla: number;
  expiringCerts: number;
}

export const dcInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxCounts> => {
    const s = context.supabase;
    const uid = context.userId;
    const nowIso = new Date().toISOString();
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const [pReview, pSign, revisi, gagal, overdue, expCert] = await Promise.all([
      s.from("submission_tasks").select("id", { count: "exact", head: true }).eq("status", "pending").eq("node_type", "review"),
      s.from("signature_request_signers").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "pending"),
      s.from("generated_documents").select("id", { count: "exact", head: true }).eq("status", "revision_required"),
      s.from("generated_documents").select("id", { count: "exact", head: true }).eq("status", "failed"),
      s.from("submission_tasks").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_at", nowIso),
      s.from("signing_certificates").select("id", { count: "exact", head: true }).eq("is_active", true).lt("expired_at", in30).gte("expired_at", nowIso),
    ]);

    return {
      pendingReview: pReview.count ?? 0,
      pendingSignature: pSign.count ?? 0,
      needsRevision: revisi.count ?? 0,
      failed: gagal.count ?? 0,
      overdueSla: overdue.count ?? 0,
      expiringCerts: expCert.count ?? 0,
    };
  });

// ---------- RECENT ACTIVITY ----------
export interface ActivityItem {
  id: string;
  when: string;
  action: string;
  documentId: string | null;
  actor: string | null;
  kind: "doc" | "signature";
}

export const dcRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivityItem[]> => {
    const s = context.supabase;
    const [aud, evt] = await Promise.all([
      s.from("document_audit").select("id,document_id,action,actor,created_at").order("created_at", { ascending: false }).limit(10),
      s.from("signature_events").select("id,request_id,event,actor,created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    const items: ActivityItem[] = [];
    for (const r of aud.data ?? []) {
      items.push({
        id: `d-${r.id}`,
        when: r.created_at as string,
        action: r.action as string,
        documentId: (r.document_id as string) ?? null,
        actor: (r.actor as string) ?? null,
        kind: "doc",
      });
    }
    for (const r of evt.data ?? []) {
      items.push({
        id: `s-${r.id}`,
        when: r.created_at as string,
        action: r.event as string,
        documentId: (r.request_id as string) ?? null,
        actor: (r.actor as string) ?? null,
        kind: "signature",
      });
    }
    items.sort((a, b) => (a.when < b.when ? 1 : -1));
    return items.slice(0, 15);
  });

// ---------- DOCUMENTS LIST ----------
export interface DocRow {
  id: string;
  doc_number: string | null;
  name: string | null;
  status: string;
  generated_at: string;
  archived_at: string | null;
  submission_id: string | null;
  storage_path: string | null;
}

const listSchema = z.object({
  q: z.string().optional(),
  statuses: z.array(z.string()).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const dcListDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listSchema.parse(raw))
  .handler(async ({ data, context }): Promise<{ rows: DocRow[]; total: number }> => {
    const s = context.supabase;
    let q = s
      .from("generated_documents")
      .select("id,doc_number,name,status,generated_at,archived_at,submission_id,storage_path", {
        count: "exact",
      })
      .order("generated_at", { ascending: false })
      .limit(data.limit ?? 50);

    if (data.q) {
      const term = `%${data.q}%`;
      q = q.or(`doc_number.ilike.${term},name.ilike.${term}`);
    }
    if (data.statuses && data.statuses.length > 0) q = q.in("status", data.statuses);
    if (data.from) q = q.gte("generated_at", data.from);
    if (data.to) q = q.lte("generated_at", data.to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as DocRow[], total: count ?? 0 };
  });

// ---------- TIMELINE ----------
export interface TimelineEvent {
  id: string;
  when: string;
  actor: string | null;
  kind: "audit" | "history" | "signature";
  action: string;
  detail?: string;
}

const timelineSchema = z.object({ documentId: z.string().uuid() });

export const dcTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => timelineSchema.parse(raw))
  .handler(async ({ data, context }): Promise<TimelineEvent[]> => {
    const s = context.supabase;
    const [aud, hist, sig] = await Promise.all([
      s.from("document_audit").select("id,action,actor,created_at,metadata").eq("document_id", data.documentId).order("created_at", { ascending: false }).limit(50),
      s.from("document_history").select("id,action,actor_id,created_at,metadata").eq("document_id", data.documentId).order("created_at", { ascending: false }).limit(50),
      s.from("signature_events").select("id,event,actor,created_at,payload,request_id").eq("request_id", data.documentId).order("created_at", { ascending: false }).limit(50),
    ]);
    const events: TimelineEvent[] = [];
    for (const r of aud.data ?? []) events.push({ id: `a-${r.id}`, when: r.created_at as string, actor: (r.actor as string) ?? null, kind: "audit", action: r.action as string });
    for (const r of hist.data ?? []) events.push({ id: `h-${r.id}`, when: r.created_at as string, actor: (r.actor_id as string) ?? null, kind: "history", action: r.action as string });
    for (const r of sig.data ?? []) events.push({ id: `s-${r.id}`, when: r.created_at as string, actor: (r.actor as string) ?? null, kind: "signature", action: r.event as string });
    events.sort((a, b) => (a.when < b.when ? 1 : -1));
    return events;
  });

// ---------- GLOBAL SEARCH (Cmd+K) ----------
export interface SearchHit {
  id: string;
  label: string;
  hint: string | null;
  kind: "doc" | "signature";
  ref: string;
}

const searchSchema = z.object({ q: z.string().min(1).max(120) });

export const dcSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => searchSchema.parse(raw))
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const s = context.supabase;
    const term = `%${data.q}%`;
    const [docs, reqs] = await Promise.all([
      s.from("generated_documents").select("id,doc_number,name,status").or(`doc_number.ilike.${term},name.ilike.${term}`).limit(8),
      s.from("signature_requests").select("id,status,external_request_id").or(`external_request_id.ilike.${term}`).limit(5),
    ]);
    const hits: SearchHit[] = [];
    for (const r of docs.data ?? []) {
      hits.push({
        id: `d-${r.id}`,
        label: (r.name as string) ?? (r.doc_number as string) ?? "Dokumen",
        hint: (r.doc_number as string) ?? null,
        kind: "doc",
        ref: r.id as string,
      });
    }
    for (const r of reqs.data ?? []) {
      hits.push({
        id: `s-${r.id}`,
        label: (r.external_request_id as string) ?? `Signature ${(r.id as string).slice(0, 8)}`,
        hint: r.status as string,
        kind: "signature",
        ref: r.id as string,
      });
    }
    return hits;
  });

// ---------- INBOX LIST (items per bucket) ----------
export type InboxBucket =
  | "pending_review"
  | "pending_signature"
  | "needs_revision"
  | "failed"
  | "overdue_sla"
  | "expiring_certs";

export interface InboxItem {
  id: string;
  bucket: InboxBucket;
  title: string;
  subtitle: string | null;
  when: string;
  ref: string; // route target
}

const inboxListSchema = z.object({
  bucket: z.enum([
    "pending_review",
    "pending_signature",
    "needs_revision",
    "failed",
    "overdue_sla",
    "expiring_certs",
  ]),
  limit: z.number().int().min(1).max(200).optional(),
});

export const dcInboxList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inboxListSchema.parse(raw))
  .handler(async ({ data, context }): Promise<InboxItem[]> => {
    const s = context.supabase;
    const uid = context.userId;
    const limit = data.limit ?? 50;
    const nowIso = new Date().toISOString();
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    if (data.bucket === "pending_signature") {
      const { data: rows } = await s
        .from("signature_request_signers")
        .select("id,request_id,status,created_at")
        .eq("user_id", uid)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (rows ?? []).map((r) => ({
        id: `sig-${r.id}`,
        bucket: data.bucket,
        title: `Permintaan tanda tangan`,
        subtitle: (r.request_id as string) ?? null,
        when: r.created_at as string,
        ref: `/admin/signature/requests/${r.request_id as string}`,
      }));
    }

    if (data.bucket === "expiring_certs") {
      const { data: rows } = await s
        .from("signing_certificates")
        .select("id,full_name,expired_at")
        .eq("is_active", true)
        .lt("expired_at", in30)
        .gte("expired_at", nowIso)
        .order("expired_at", { ascending: true })
        .limit(limit);
      return (rows ?? []).map((r) => ({
        id: `cert-${r.id}`,
        bucket: data.bucket,
        title: `Sertifikat: ${(r.full_name as string) ?? "—"}`,
        subtitle: `Kedaluwarsa ${new Date(r.expired_at as string).toLocaleDateString("id-ID")}`,
        when: r.expired_at as string,
        ref: `/admin/document-center/signature/specimens`,
      }));
    }

    if (data.bucket === "pending_review" || data.bucket === "overdue_sla") {
      let q = s
        .from("submission_tasks")
        .select("id,submission_id,due_at,created_at,node_type,status")
        .eq("status", "pending");
      if (data.bucket === "pending_review") q = q.eq("node_type", "review");
      if (data.bucket === "overdue_sla") q = q.lt("due_at", nowIso);
      const { data: rows } = await q.order("created_at", { ascending: false }).limit(limit);
      return (rows ?? []).map((r) => ({
        id: `task-${r.id}`,
        bucket: data.bucket,
        title:
          data.bucket === "pending_review" ? "Perlu review" : "Melewati batas waktu",
        subtitle: (r.submission_id as string) ?? null,
        when: (r.due_at as string) ?? (r.created_at as string),
        ref: `/admin/workflow-instances`,
      }));
    }

    // needs_revision, failed → generated_documents
    const dbStatus = data.bucket === "needs_revision" ? "revision_required" : "failed";
    const { data: rows } = await s
      .from("generated_documents")
      .select("id,doc_number,name,status,generated_at")
      .eq("status", dbStatus)
      .order("generated_at", { ascending: false })
      .limit(limit);
    return (rows ?? []).map((r) => ({
      id: `doc-${r.id}`,
      bucket: data.bucket,
      title: (r.name as string) ?? (r.doc_number as string) ?? "Dokumen",
      subtitle: (r.doc_number as string) ?? null,
      when: r.generated_at as string,
      ref: `/admin/document-center/documents/${r.id as string}`,
    }));
  });

// ---------- DOCUMENT DETAIL ----------
export interface DocDetail {
  id: string;
  doc_number: string | null;
  name: string | null;
  status: string;
  generated_at: string;
  archived_at: string | null;
  storage_path: string | null;
  submission_id: string | null;
  template_id: string | null;
  signers: {
    id: string;
    user_id: string | null;
    email: string | null;
    full_name: string | null;
    status: string;
    signed_at: string | null;
  }[];
  latest_signature_request: {
    id: string;
    status: string;
    external_request_id: string | null;
    sent_at: string | null;
    completed_at: string | null;
  } | null;
}

const detailSchema = z.object({ id: z.string().uuid() });

export const dcDocumentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => detailSchema.parse(raw))
  .handler(async ({ data, context }): Promise<DocDetail | null> => {
    const s = context.supabase;
    const { data: doc, error } = await s
      .from("generated_documents")
      .select(
        "id,doc_number,name,status,generated_at,archived_at,storage_path,submission_id,template_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) return null;

    const { data: sigReq } = await s
      .from("signature_requests")
      .select("id,status,external_request_id,sent_at,completed_at,created_at")
      .eq("generated_document_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let signers: DocDetail["signers"] = [];
    if (sigReq) {
      const { data: sr } = await s
        .from("signature_request_signers")
        .select("id,user_id,position,status,signed_at")
        .eq("request_id", sigReq.id as string);
      signers = (sr ?? []).map((r) => ({
        id: r.id as string,
        user_id: (r.user_id as string) ?? null,
        email: null,
        full_name: (r.position as string) ?? null,
        status: r.status as string,
        signed_at: (r.signed_at as string) ?? null,
      }));
    }


    return {
      id: doc.id as string,
      doc_number: (doc.doc_number as string) ?? null,
      name: (doc.name as string) ?? null,
      status: doc.status as string,
      generated_at: doc.generated_at as string,
      archived_at: (doc.archived_at as string) ?? null,
      storage_path: (doc.storage_path as string) ?? null,
      submission_id: (doc.submission_id as string) ?? null,
      template_id: (doc.template_id as string) ?? null,
      signers,
      latest_signature_request: sigReq
        ? {
            id: sigReq.id as string,
            status: sigReq.status as string,
            external_request_id: (sigReq.external_request_id as string) ?? null,
            sent_at: (sigReq.sent_at as string) ?? null,
            completed_at: (sigReq.completed_at as string) ?? null,
          }
        : null,
    };
  });

// ---------- QUICK ACTION (delegating) ----------
const quickActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["archive", "unarchive"]),
});

export const dcQuickAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => quickActionSchema.parse(raw))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const s = context.supabase;
    const patch =
      data.action === "archive"
        ? { archived_at: new Date().toISOString(), status: "archived" as string }
        : { archived_at: null, status: "generated" as string };
    const { error } = await s
      .from("generated_documents")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // best-effort audit
    await s.from("document_audit").insert({
      document_id: data.id,
      action: data.action === "archive" ? "archived" : "unarchived",
      actor: context.userId,
      metadata: {},
    });
    return { ok: true };
  });
