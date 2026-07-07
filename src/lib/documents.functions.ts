// Phase 3A — Document Runtime server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMergeContext } from "@/features/documents/services/document-context.service";
import { generateDocument, type DocKind } from "@/features/documents/services/document-generator.service";
import { mergeTemplate } from "@/features/documents/placeholder/engine";
import { assignDocumentNumber, previewFormat } from "@/features/documents/services/document-numbering.service";
import { writeDocAudit, writeDocHistory } from "@/features/documents/services/document-audit.service";
import { PLACEHOLDER_CATALOG } from "@/features/documents/placeholder/catalog";

const KIND = z.enum(["html", "pdf", "docx"]);

// ============ TEMPLATES ============
export const docListTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.enum(["draft", "active", "archived"]).optional(),
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("document_templates")
      .select("id,name,description,kind,category,status,current_version,owner_opd_id,updated_at,numbering_rule_id")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const docGetTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("document_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Template tidak ditemukan");
    const { data: versions } = await context.supabase
      .from("document_template_versions")
      .select("id,version_number,kind,created_at,created_by")
      .eq("template_id", data.id)
      .order("version_number", { ascending: false });
    return { template: t, versions: versions ?? [] };
  });

export const docCreateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        name: z.string().min(3).max(160),
        description: z.string().max(500).optional(),
        kind: KIND.default("html"),
        category: z.string().max(80).optional(),
        template_html: z.string().default(""),
        owner_opd_id: z.string().uuid().optional(),
        numbering_rule_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("document_templates")
      .insert({
        name: data.name,
        description: data.description ?? null,
        kind: data.kind,
        category: data.category ?? null,
        template_html: data.template_html,
        variables: {},
        status: "draft",
        owner_opd_id: data.owner_opd_id ?? null,
        numbering_rule_id: data.numbering_rule_id ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Gagal membuat template");
    await context.supabase.from("document_template_versions").insert({
      template_id: row.id,
      version_number: 1,
      kind: data.kind,
      template_html: data.template_html,
      variables: {},
      created_by: context.userId,
    });
    await writeDocAudit(context.supabase, {
      action: "document.template.created",
      user_id: context.userId,
      entity: "document_template",
      entity_id: row.id,
      metadata: { name: data.name },
    });
    return { id: row.id };
  });

export const docUpdateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(3).max(160).optional(),
        description: z.string().max(500).nullable().optional(),
        kind: KIND.optional(),
        category: z.string().max(80).nullable().optional(),
        template_html: z.string().optional(),
        numbering_rule_id: z.string().uuid().nullable().optional(),
        bumpVersion: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: cur } = await context.supabase
      .from("document_templates")
      .select("current_version,template_html,kind")
      .eq("id", data.id)
      .maybeSingle();
    if (!cur) throw new Error("Template tidak ditemukan");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.kind !== undefined) patch.kind = data.kind;
    if (data.category !== undefined) patch.category = data.category;
    if (data.template_html !== undefined) patch.template_html = data.template_html;
    if (data.numbering_rule_id !== undefined) patch.numbering_rule_id = data.numbering_rule_id;
    if (data.bumpVersion) {
      const next = (cur.current_version ?? 1) + 1;
      patch.current_version = next;
      await context.supabase.from("document_template_versions").insert({
        template_id: data.id,
        version_number: next,
        kind: (data.kind as DocKind) ?? cur.kind,
        template_html: data.template_html ?? cur.template_html ?? "",
        variables: {},
        created_by: context.userId,
      });
    }
    const { error } = await context.supabase
      .from("document_templates")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeDocAudit(context.supabase, {
      action: "document.template.updated",
      user_id: context.userId,
      entity: "document_template",
      entity_id: data.id,
      metadata: { bumped: data.bumpVersion },
    });
    return { ok: true };
  });

export const docCloneTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase
      .from("document_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!t) throw new Error("Template tidak ditemukan");
    const { data: row, error } = await context.supabase
      .from("document_templates")
      .insert({
        name: `${t.name} (Copy)`,
        description: t.description,
        kind: t.kind,
        category: t.category,
        template_html: t.template_html,
        variables: t.variables,
        owner_opd_id: t.owner_opd_id,
        numbering_rule_id: t.numbering_rule_id,
        status: "draft",
        current_version: 1,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Gagal clone");
    await context.supabase.from("document_template_versions").insert({
      template_id: row.id,
      version_number: 1,
      kind: t.kind,
      template_html: t.template_html,
      variables: t.variables,
      created_by: context.userId,
    });
    await writeDocAudit(context.supabase, {
      action: "document.template.cloned",
      user_id: context.userId,
      entity: "document_template",
      entity_id: row.id,
      metadata: { source: data.id },
    });
    return { id: row.id };
  });

export const docPublishTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("document_templates")
      .update({ status: "active" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeDocAudit(context.supabase, {
      action: "document.template.published",
      user_id: context.userId,
      entity: "document_template",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const docArchiveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("document_templates")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeDocAudit(context.supabase, {
      action: "document.template.archived",
      user_id: context.userId,
      entity: "document_template",
      entity_id: data.id,
    });
    return { ok: true };
  });

// ============ PREVIEW & GENERATE ============
export const docPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        template_id: z.string().uuid().optional(),
        template_html: z.string().optional(),
        submission_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let html = data.template_html ?? "";
    if (data.template_id) {
      const { data: t } = await context.supabase
        .from("document_templates")
        .select("template_html")
        .eq("id", data.template_id)
        .maybeSingle();
      html = t?.template_html ?? html;
    }
    if (!html) return { merged: "" };
    if (data.submission_id) {
      const ctx = await buildMergeContext(context.supabase, { submission_id: data.submission_id });
      return { merged: mergeTemplate(html, ctx) };
    }
    // Dummy preview
    const ctx = {
      submission: { nama: "Budi Santoso", nip: "1980xxxx", opd: "BKPSDM", jabatan: "Staff" },
      profile: { full_name: "Budi Santoso", nip: "1980xxxx" },
      workflow: { current_step: "Selesai", approved_by: "Kepala OPD", completed_at: new Date().toISOString() },
      system: { tanggal: new Date().toLocaleDateString("id-ID"), tahun: new Date().getFullYear(), app_name: "SIPemda" },
      document: { nomor_surat: "PB-2026-000001", template_version: 1, generated_at: new Date().toISOString() },
    };
    return { merged: mergeTemplate(html, ctx) };
  });

export const docGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        template_id: z.string().uuid(),
        submission_id: z.string().uuid(),
        name: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await context.supabase
      .from("document_templates")
      .select("id,name,kind,template_html,current_version,numbering_rule_id,category,owner_opd_id")
      .eq("id", data.template_id)
      .maybeSingle();
    if (!t) throw new Error("Template tidak ditemukan");
    if (!t.template_html) throw new Error("Template kosong");

    // Numbering
    let docNumber: string | null = null;
    if (t.numbering_rule_id) {
      const { data: sub } = await context.supabase
        .from("form_submissions")
        .select("opd_id")
        .eq("id", data.submission_id)
        .maybeSingle();
      docNumber = await assignDocumentNumber(supabaseAdmin, {
        rule_id: t.numbering_rule_id,
        opd_id: sub?.opd_id ?? t.owner_opd_id ?? null,
        category: t.category ?? null,
      });
      await writeDocAudit(context.supabase, {
        action: "document.number.assigned",
        user_id: context.userId,
        entity: "generated_document",
        entity_id: data.submission_id,
        metadata: { nomor: docNumber, rule_id: t.numbering_rule_id },
      });
    }

    const ctx = await buildMergeContext(context.supabase, {
      submission_id: data.submission_id,
      doc_number: docNumber,
      template_version: t.current_version ?? 1,
    });
    const out = await generateDocument({
      kind: (t.kind as DocKind) ?? "html",
      templateHtml: t.template_html,
      context: ctx,
    });

    const docId = crypto.randomUUID();
    const storagePath = `${data.submission_id}/${docId}.${out.extension}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("documents")
      .upload(storagePath, out.bytes, { contentType: out.mime, upsert: false });
    if (upErr) throw new Error(`Upload gagal: ${upErr.message}`);

    const { error: insErr } = await supabaseAdmin.from("generated_documents").insert({
      id: docId,
      submission_id: data.submission_id,
      template_id: t.id,
      template_version: t.current_version ?? 1,
      storage_path: storagePath,
      mime: out.mime,
      size_bytes: out.bytes.byteLength,
      doc_number: docNumber,
      name: data.name ?? `${t.name} — ${docNumber ?? data.submission_id.slice(0, 8)}`,
      status: "generated",
      numbering_rule_id: t.numbering_rule_id ?? null,
      generated_by: context.userId,
      snapshot: {
        template_version: t.current_version ?? 1,
        context: ctx,
      } as never,
    });
    if (insErr) throw new Error(insErr.message);

    await writeDocHistory(context.supabase, {
      document_id: docId,
      action: "generated",
      actor_id: context.userId,
      metadata: { template_id: t.id, nomor: docNumber },
    });
    await writeDocAudit(context.supabase, {
      action: "document.generated",
      user_id: context.userId,
      entity: "generated_document",
      entity_id: docId,
      metadata: { template_id: t.id, nomor: docNumber, kind: t.kind },
    });
    return { id: docId, doc_number: docNumber, storage_path: storagePath, mime: out.mime };
  });

// ============ GENERATED DOCUMENTS ============
export const docListDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.string().optional(),
        opd_id: z.string().uuid().optional(),
        template_id: z.string().uuid().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        archived: z.boolean().optional(),
        q: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("generated_documents")
      .select(
        "id,doc_number,name,status,template_id,submission_id,mime,size_bytes,generated_at,archived_at",
      )
      .order("generated_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.template_id) q = q.eq("template_id", data.template_id);
    if (data.from) q = q.gte("generated_at", data.from);
    if (data.to) q = q.lte("generated_at", data.to);
    if (data.q) q = q.or(`doc_number.ilike.%${data.q}%,name.ilike.%${data.q}%`);
    if (data.archived === true) q = q.eq("status", "archived");
    else if (data.archived === false) q = q.neq("status", "archived");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const docGetDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("generated_documents")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Dokumen tidak ditemukan");
    const { data: history } = await context.supabase
      .from("document_history")
      .select("id,action,actor_id,metadata,created_at")
      .eq("document_id", data.id)
      .order("created_at", { ascending: false });
    return { document: doc, history: history ?? [] };
  });

export const docDownloadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("generated_documents")
      .select("storage_path,name")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Dokumen tidak ditemukan");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(doc.storage_path ?? "", 60 * 10);
    if (error || !signed) throw new Error(error?.message ?? "Gagal membuat URL");
    await writeDocHistory(context.supabase, {
      document_id: data.id,
      action: "downloaded",
      actor_id: context.userId,
    });
    await writeDocAudit(context.supabase, {
      action: "document.downloaded",
      user_id: context.userId,
      entity: "generated_document",
      entity_id: data.id,
    });
    return { url: signed.signedUrl, name: doc.name };
  });

export const docArchiveDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("generated_documents")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeDocHistory(context.supabase, {
      document_id: data.id,
      action: "archived",
      actor_id: context.userId,
    });
    await writeDocAudit(context.supabase, {
      action: "document.archived",
      user_id: context.userId,
      entity: "generated_document",
      entity_id: data.id,
    });
    return { ok: true };
  });

// ============ NUMBERING RULES ============
export const docListNumberingRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("document_numbering_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const docCreateNumberingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        code: z.string().min(2).max(40),
        name: z.string().min(3).max(160),
        format: z.string().min(3).max(200),
        scope: z.enum(["global", "per_opd", "per_category", "per_opd_category"]).default("global"),
        category: z.string().max(80).optional(),
        opd_id: z.string().uuid().optional(),
        reset_period: z.enum(["yearly", "never"]).default("yearly"),
        padding: z.number().int().min(1).max(12).default(6),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("document_numbering_rules")
      .insert({
        code: data.code,
        name: data.name,
        format: data.format,
        scope: data.scope,
        category: data.category ?? null,
        opd_id: data.opd_id ?? null,
        reset_period: data.reset_period,
        padding: data.padding,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Gagal membuat rule");
    await writeDocAudit(context.supabase, {
      action: "document.numbering.rule.created",
      user_id: context.userId,
      entity: "document_numbering_rule",
      entity_id: row.id,
      metadata: { code: data.code, format: data.format },
    });
    return { id: row.id };
  });

export const docUpdateNumberingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(3).max(160).optional(),
        format: z.string().min(3).max(200).optional(),
        scope: z.enum(["global", "per_opd", "per_category", "per_opd_category"]).optional(),
        category: z.string().max(80).nullable().optional(),
        opd_id: z.string().uuid().nullable().optional(),
        reset_period: z.enum(["yearly", "never"]).optional(),
        padding: z.number().int().min(1).max(12).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("document_numbering_rules").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    await writeDocAudit(context.supabase, {
      action: "document.numbering.rule.updated",
      user_id: context.userId,
      entity: "document_numbering_rule",
      entity_id: id,
    });
    return { ok: true };
  });

export const docPreviewNumbering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        format: z.string(),
        padding: z.number().int().min(1).max(12).default(6),
        opd: z.string().optional(),
        opd_code: z.string().optional(),
        category: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => ({
    preview: previewFormat(data.format, {
      opd: data.opd,
      opd_code: data.opd_code,
      category: data.category,
      padding: data.padding,
    }),
  }));

export const docPlaceholderCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ groups: PLACEHOLDER_CATALOG }));

// Phase 1C — Daftar form yang published untuk picker auto-mapping placeholder.
export const docListPublishedForms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ q: z.string().max(120).optional(), limit: z.number().int().min(1).max(100).default(50) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("forms")
      .select("id,judul,opd_pemilik_id,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(data.limit);
    if (data.q) q = q.ilike("judul", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// Phase 1C — Ambil field snapshot form sebagai grup placeholder
// ({{submission.<kode>}}) untuk picker di template editor dokumen.
export const docFormFieldsCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ formId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: form, error } = await context.supabase
      .from("forms")
      .select("id,judul,schema_snapshot,status")
      .eq("id", data.formId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!form) throw new Error("Form tidak ditemukan");
    const snap = form.schema_snapshot as
      | { fields?: Array<{ kode: string; label: string; tipe: string }> }
      | null;
    const items = (snap?.fields ?? [])
      .filter((f) => !["heading", "section", "divider"].includes(f.tipe))
      .map((f) => ({
        token: `submission.${f.kode}`,
        label: `${f.label} (${f.tipe})`,
      }));
    return {
      group: {
        category: "submission" as const,
        label: `Field: ${form.judul}`,
        items,
      },
    };
  });

