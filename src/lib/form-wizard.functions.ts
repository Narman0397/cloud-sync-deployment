// Phase 1B.2 — Server functions Form Wizard.
// RBAC-gated. Drafts user-scoped via RLS, dilengkapi pengecekan eksplisit.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext, canManageFormCtx } from "@/features/rbac/guards";
import {
  listWizardDrafts,
  getWizardDraft,
  upsertWizardDraft,
  deleteWizardDraft,
  getFormEditSafety,
  persistFormFields,
} from "@/features/forms/services/form-wizard.service";
import { writeFormAudit, type FormAuditAction } from "@/features/forms/services/form-audit.service";
import { formFieldSchema } from "@/features/forms/schema/types";

const EMPLOYMENT_TYPES = ["PNS", "PPPK", "PPPK_PW", "NON_ASN", "THL"] as const;

// ---------- Drafts ----------
export const fwListDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    return listWizardDrafts(supabaseAdmin, userId);
  });

export const fwGetDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    return getWizardDraft(supabaseAdmin, data.id, userId);
  });

export const fwSaveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        formId: z.string().uuid().optional().nullable(),
        step: z.string().max(40).default("general"),
        title: z.string().max(200).nullable().default(null),
        // Payload bisa apa saja yang JSON-serializable — disimpan apa adanya.
        payload: z.unknown().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    return upsertWizardDraft(supabaseAdmin, {
      id: data.id,
      userId,
      formId: data.formId ?? null,
      step: data.step,
      title: data.title,
      payload: (data.payload ?? {}) as unknown as import("@/integrations/supabase/types").Json,
    });
  });

export const fwDeleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await deleteWizardDraft(supabaseAdmin, data.id, userId);
    return { ok: true };
  });

// ---------- Version safety ----------
export const fwEditSafety = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ formId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { data: form } = await supabaseAdmin
      .from("forms")
      .select("opd_pemilik_id")
      .eq("id", data.formId)
      .maybeSingle();
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!canManageFormCtx(ctx, form?.opd_pemilik_id ?? null)) throw new Error("Akses ditolak");
    return getFormEditSafety(supabaseAdmin, data.formId);
  });

// ---------- Commit wizard → form ----------
const fieldsArrayInput = z.array(formFieldSchema).max(200);

export const fwCommitNewForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        draftId: z.string().uuid().optional(),
        general: z.object({
          name: z.string().trim().min(3).max(200),
          code: z.string().trim().max(60).optional().nullable(),
          description: z.string().max(2000).optional().nullable(),
          category: z.string().max(80).optional().nullable(),
          sla_days: z.number().int().min(0).max(365).optional().nullable(),
        }),
        employment: z.object({
          types: z.array(z.enum(EMPLOYMENT_TYPES)).max(5).default([]),
        }),
        permissions: z.object({
          opd_pemilik_id: z.string().uuid().optional().nullable(),
          allow_multiple_submit: z.boolean().default(false),
          is_public: z.boolean().default(false),
          show_in_open_data: z.boolean().default(false),
          public_slug: z
            .string()
            .regex(/^[a-z0-9-]{3,80}$/)
            .optional()
            .nullable(),
        }),
        fields: fieldsArrayInput,
        publish: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!ctx.isElevated && !ctx.isAdminOpd) throw new Error("Akses ditolak");
    const opdId = ctx.isElevated ? (data.permissions.opd_pemilik_id ?? null) : ctx.opdId;
    const { data: row, error } = await supabaseAdmin
      .from("forms")
      .insert({
        judul: data.general.name,
        code: data.general.code?.trim() || null,
        deskripsi: data.general.description ?? null,
        category: data.general.category ?? null,
        sla_days: data.general.sla_days ?? null,
        allow_multiple_submit: data.permissions.allow_multiple_submit,
        allowed_employee_types: data.employment.types,
        opd_pemilik_id: opdId,
        is_public: data.permissions.is_public,
        show_in_open_data: data.permissions.show_in_open_data,
        slug: data.permissions.public_slug ?? null,
        status: data.publish ? "published" : "draft",
        created_by: userId,
        published_at: data.publish ? new Date().toISOString() : null,
        published_by: data.publish ? userId : null,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Gagal membuat form");
    const formId = row.id as string;

    const persisted = await persistFormFields(supabaseAdmin, {
      formId,
      fields: data.fields,
      userId,
      createVersion: data.publish,
    });

    if (data.draftId) {
      await deleteWizardDraft(supabaseAdmin, data.draftId, userId).catch(() => {});
    }

    await writeFormAudit(supabaseAdmin, {
      action: data.publish ? "form.publish" : "form.create",
      resource_type: "form",
      resource_id: formId,
      user_id: userId,
      metadata: {
        via: "wizard",
        field_count: persisted.field_count,
        version: persisted.version?.number ?? null,
      },
    });
    return { id: formId, version: persisted.version ?? null };
  });

// ---------- Save fields (edit existing) ----------
export const fwSaveFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        formId: z.string().uuid(),
        fields: fieldsArrayInput,
        createVersion: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { data: form } = await supabaseAdmin
      .from("forms")
      .select("opd_pemilik_id")
      .eq("id", data.formId)
      .maybeSingle();
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (!canManageFormCtx(ctx, form?.opd_pemilik_id ?? null)) throw new Error("Akses ditolak");

    const safety = await getFormEditSafety(supabaseAdmin, data.formId);
    if (!safety.can_edit_directly && !data.createVersion) {
      throw new Error(
        `Form sudah punya ${safety.submission_count} submission. Gunakan "Create New Version" untuk perubahan skema.`,
      );
    }

    const persisted = await persistFormFields(supabaseAdmin, {
      formId: data.formId,
      fields: data.fields,
      userId,
      createVersion: data.createVersion,
    });

    const action: FormAuditAction = data.createVersion ? "form.create_version" : "form.update";
    await writeFormAudit(supabaseAdmin, {
      action,
      resource_type: "form",
      resource_id: data.formId,
      user_id: userId,
      metadata: { field_count: persisted.field_count, version: persisted.version?.number ?? null },
    });
    return { ok: true, version: persisted.version ?? null };
  });

// ---------- Granular field events (audit only — disimpan minimal) ----------
export const fwLogFieldEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        formId: z.string().uuid().optional().nullable(),
        event: z.enum([
          "field.add",
          "field.remove",
          "field.reorder",
          "field.update",
          "field.update_validation",
          "field.update_conditional",
        ]),
        metadata: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await writeFormAudit(supabaseAdmin, {
      // pakai action.update sebagai umbrella; detail di metadata.event
      action: "form.update",
      resource_type: "form",
      resource_id: data.formId ?? null,
      user_id: userId,
      metadata: { ...data.metadata, event: data.event },
    });
    return { ok: true };
  });
