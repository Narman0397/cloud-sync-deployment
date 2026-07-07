// Phase 1B — Server functions Form Builder (hub).
// Membungkus service layer dengan authorization (RBAC), input validation, &
// audit logging. Tidak menggantikan src/lib/forms.functions.ts (legacy); ini
// jalur baru untuk hub /admin/form-builder.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext, canManageFormCtx } from "@/features/rbac/guards";
import {
  listFormsAdvanced,
  cloneForm,
  createFormFromTemplate,
  type FormListFilter,
} from "@/features/forms/services/form-builder.service";
import {
  listTemplates,
  createTemplate,
  type TemplateListFilter,
} from "@/features/forms/services/form-template.service";
import { listFormVersions } from "@/features/forms/services/form-version.service";
import { writeFormAudit } from "@/features/forms/services/form-audit.service";

const EMPLOYMENT_TYPES = ["PNS", "PPPK", "PPPK_PW", "NON_ASN"] as const;

async function requireFormManageAccess(formId: string, userId: string) {
  const { data: form, error } = await supabaseAdmin
    .from("forms")
    .select("id,opd_pemilik_id,status,created_by,judul,category,version_number")
    .eq("id", formId)
    .maybeSingle();
  if (error || !form) throw new Error("Form tidak ditemukan");
  const ctx = await getUserContext(supabaseAdmin, userId);
  if (!canManageFormCtx(ctx, form.opd_pemilik_id ?? null)) {
    throw new Error("Akses ditolak");
  }
  return { form, ctx };
}

// ------------------------------------------------------------
// Forms
// ------------------------------------------------------------
export const fbListForms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tab: z.enum(["all", "my_opd", "draft", "published", "archived"]).default("all"),
        status: z.enum(["draft", "published", "archived"]).optional(),
        category: z.string().max(80).optional(),
        opdId: z.string().uuid().optional().nullable(),
        employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
        search: z.string().max(120).optional(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(50).default(20),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    const filter: FormListFilter = {
      tab: data.tab,
      status: data.status,
      category: data.category,
      opdId: ctx.isElevated ? (data.opdId ?? null) : (ctx.opdId ?? null),
      employmentType: data.employmentType,
      search: data.search,
      scopeOpdId: ctx.opdId ?? null,
      page: data.page,
      pageSize: data.pageSize,
    };
    return listFormsAdvanced(supabaseAdmin, filter);
  });

export const fbCreateForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(3).max(200),
        code: z.string().trim().max(60).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        category: z.string().max(80).optional().nullable(),
        sla_days: z.number().int().min(0).max(365).optional().nullable(),
        allowed_employee_types: z.array(z.enum(EMPLOYMENT_TYPES)).max(4).default([]),
        opd_pemilik_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd) throw new Error("Akses ditolak");
    const opdId = ctx.isElevated ? (data.opd_pemilik_id ?? null) : ctx.opdId;
    const { data: row, error } = await supabaseAdmin
      .from("forms")
      .insert({
        judul: data.name,
        code: data.code ?? null,
        deskripsi: data.description ?? null,
        category: data.category ?? null,
        sla_days: data.sla_days ?? null,
        allowed_employee_types: data.allowed_employee_types,
        opd_pemilik_id: opdId,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Gagal membuat form");
    await writeFormAudit(supabaseAdmin, {
      action: "form.create",
      resource_type: "form",
      resource_id: row.id as string,
      user_id: userId,
      metadata: { name: data.name, category: data.category ?? null },
    });
    return { id: row.id as string };
  });

export const fbCloneForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { form, ctx } = await requireFormManageAccess(data.id, userId);
    const ownerOpd = ctx.isElevated ? form.opd_pemilik_id : (ctx.opdId ?? null);
    const result = await cloneForm(supabaseAdmin, {
      sourceFormId: data.id,
      userId,
      ownerOpdId: ownerOpd,
    });
    await writeFormAudit(supabaseAdmin, {
      action: "form.clone",
      resource_type: "form",
      resource_id: result.id,
      user_id: userId,
      metadata: { source_id: data.id },
    });
    return result;
  });

export const fbCreateFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        name: z.string().trim().min(3).max(200).optional(),
        opd_pemilik_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd) throw new Error("Akses ditolak");
    const ownerOpd = ctx.isElevated ? (data.opd_pemilik_id ?? null) : ctx.opdId;
    const result = await createFormFromTemplate(supabaseAdmin, {
      templateId: data.templateId,
      userId,
      ownerOpdId: ownerOpd,
      overrideName: data.name,
    });
    await writeFormAudit(supabaseAdmin, {
      action: "form.create_from_template",
      resource_type: "form",
      resource_id: result.id,
      user_id: userId,
      metadata: { template_id: data.templateId },
    });
    return result;
  });

export const fbArchiveForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireFormManageAccess(data.id, userId);
    const { error } = await supabaseAdmin
      .from("forms")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeFormAudit(supabaseAdmin, {
      action: "form.archive",
      resource_type: "form",
      resource_id: data.id,
      user_id: userId,
    });
    return { ok: true };
  });

export const fbListVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ formId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireFormManageAccess(data.formId, userId);
    return listFormVersions(supabaseAdmin, data.formId);
  });

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------
export const fbListTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scope: z.enum(["global", "opd"]).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        category: z.string().max(80).optional(),
        search: z.string().max(120).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    const filter: TemplateListFilter = {
      scope: data.scope,
      status: data.status,
      category: data.category,
      search: data.search,
      opdId: ctx.isElevated ? null : (ctx.opdId ?? null),
    };
    return listTemplates(supabaseAdmin, filter);
  });

export const fbCreateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(3).max(200),
        code: z.string().max(60).optional().nullable(),
        description: z.string().max(2000).optional().nullable(),
        category: z.string().max(80).optional().nullable(),
        scope: z.enum(["global", "opd"]).default("opd"),
        allowed_employee_types: z.array(z.enum(EMPLOYMENT_TYPES)).max(4).default([]),
        opd_pemilik_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd) throw new Error("Akses ditolak");
    // Hanya super admin / admin pemda yang boleh membuat template global.
    if (data.scope === "global" && !ctx.isElevated) {
      throw new Error("Template global hanya dapat dibuat oleh Super Admin / Admin Pemda");
    }
    const ownerOpd =
      data.scope === "global" ? null : ctx.isElevated ? (data.opd_pemilik_id ?? null) : ctx.opdId;
    const result = await createTemplate(supabaseAdmin, {
      name: data.name,
      code: data.code,
      description: data.description,
      category: data.category,
      scope: data.scope,
      owner_opd_id: ownerOpd,
      allowed_employee_types: data.allowed_employee_types,
      userId,
    });
    await writeFormAudit(supabaseAdmin, {
      action: "template.create",
      resource_type: "form_template",
      resource_id: result.id,
      user_id: userId,
      metadata: { scope: data.scope, name: data.name },
    });
    return result;
  });

// ------------------------------------------------------------
// Template lifecycle (publish / archive)
// ------------------------------------------------------------
async function requireTemplateManage(templateId: string, userId: string) {
  const { data: tpl, error } = await supabaseAdmin
    .from("form_templates")
    .select("id,scope,owner_opd_id,status")
    .eq("id", templateId)
    .maybeSingle();
  if (error || !tpl) throw new Error("Template tidak ditemukan");
  const ctx = await getUserContext(supabaseAdmin, userId);
  const isOwner = !!tpl.owner_opd_id && ctx.opdId === tpl.owner_opd_id;
  if (!ctx.isElevated && !(ctx.isAdminOpd && isOwner)) throw new Error("Akses ditolak");
  return { tpl, ctx };
}

export const fbPublishTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireTemplateManage(data.id, userId);
    const { error } = await supabaseAdmin
      .from("form_templates")
      .update({ status: "published" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeFormAudit(supabaseAdmin, {
      action: "template.publish",
      resource_type: "form_template",
      resource_id: data.id,
      user_id: userId,
    });
    return { ok: true };
  });

export const fbArchiveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireTemplateManage(data.id, userId);
    const { error } = await supabaseAdmin
      .from("form_templates")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeFormAudit(supabaseAdmin, {
      action: "template.archive",
      resource_type: "form_template",
      resource_id: data.id,
      user_id: userId,
    });
    return { ok: true };
  });
