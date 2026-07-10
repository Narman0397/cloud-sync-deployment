// Assignment engine: resolusi target → form_assignments + notifikasi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext, canAccessAssignment } from "@/features/rbac/guards";
import { enqueueMany } from "./notifications.functions";
import { log, newCorrelationId } from "./logger";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";
import { casUpdate, CasConflictError } from "./db/cas";
import { withIdempotency, idemKey } from "./http/idempotency";
import {
  ensureAssignmentsForUser,
  resolveTargetUserIds,
} from "@/features/forms/services/assignment-resolution.service";

/** Dipanggil dari publishForm. */
export async function generateAssignmentsForForm(formId: string): Promise<number> {
  const { data: form } = await supabaseAdmin
    .from("forms")
    .select("id,opd_pemilik_id,deadline,judul")
    .eq("id", formId)
    .single();
  if (!form) return 0;
  const users = await resolveTargetUserIds(supabaseAdmin, formId, form.opd_pemilik_id);
  if (users.length === 0) return 0;
  // Upsert assignment (skip yang sudah ada).
  const { data: existing } = await supabaseAdmin
    .from("form_assignments")
    .select("user_id")
    .eq("form_id", formId);
  const have = new Set((existing ?? []).map((e) => e.user_id));
  const toInsert = users.filter((u) => !have.has(u.user_id));
  if (toInsert.length === 0) return 0;
  const rows = toInsert.map((u) => ({
    form_id: formId,
    user_id: u.user_id,
    opd_id: u.opd_id,
    status: "assigned" as const,
    due_at: form.deadline ?? null,
  }));
  const { error } = await supabaseAdmin.from("form_assignments").insert(rows);
  if (error) throw new Error(error.message);
  await enqueueMany(
    toInsert.map((u) => ({
      userId: u.user_id,
      tipe: "form.assigned",
      judul: `Tugas baru: ${form.judul}`,
      body: form.deadline
        ? `Tenggat: ${new Date(form.deadline).toLocaleDateString("id-ID")}`
        : null,
      link: `/asn/tugas`,
      meta: { form_id: formId },
    })),
  );
  return toInsert.length;
}

/**
 * Sinkronkan assignment setelah perubahan target pada form yang sudah
 * dipublish. Tambah assignment untuk user baru yang masuk target; tidak
 * menghapus assignment lama agar histori submission tetap utuh.
 */
export const syncAssignmentsForForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ form_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { data: form } = await supabaseAdmin
      .from("forms")
      .select("id,opd_pemilik_id,status,created_by")
      .eq("id", data.form_id)
      .maybeSingle();
    if (!form) throw new Error("Form tidak ditemukan");
    const ctx = await getUserContext(supabaseAdmin, userId);
    if (
      !ctx.isElevated &&
      !(ctx.isAdminOpd && ctx.opdId === form.opd_pemilik_id) &&
      form.created_by !== userId
    ) {
      throw new Error("Akses ditolak");
    }
    if (form.status !== "published") throw new Error("Form harus berstatus published");
    const added = await generateAssignmentsForForm(data.form_id);
    log.info("assignment.sync.ok", { userId, formId: data.form_id, added });
    return { added };
  });

export const listMyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["assigned", "in_progress", "submitted", "overdue"]).optional(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(50).default(20),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await ensureAssignmentsForUser(supabaseAdmin, userId);
    let q = supabaseAdmin
      .from("form_assignments")
      .select("id,form_id,status,due_at,assigned_at,opd_id", { count: "exact" })
      .eq("user_id", userId)
      .order("assigned_at", { ascending: false })
      .range(data.page * data.pageSize, data.page * data.pageSize + data.pageSize - 1);
    if (data.status) q = q.eq("status", data.status);
    const { data: assignmentRows, count, error } = await q;
    if (error) throw new Error(error.message);

    const rows = assignmentRows ?? [];
    const formIds = [...new Set(rows.map((row) => row.form_id).filter(Boolean))];
    const formsById = new Map<
      string,
      { id: string; judul: string; deskripsi: string | null; status: string; deadline: string | null }
    >();

    if (formIds.length > 0) {
      const { data: forms, error: formsError } = await supabaseAdmin
        .from("forms")
        .select("id,judul,deskripsi,status,deadline")
        .in("id", formIds);
      if (formsError) throw new Error(formsError.message);
      for (const form of forms ?? []) {
        formsById.set(form.id, form);
      }
    }

    return {
      rows: rows.map((row) => ({
        ...row,
        forms: formsById.get(row.form_id) ?? null,
      })),
      total: count ?? 0,
    };
  });

export const getAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const ctx = await getUserContext(supabaseAdmin, userId);
    const { data: a } = await supabaseAdmin
      .from("form_assignments")
      .select("*, forms(id,judul,deskripsi,schema_snapshot,deadline,status,opd_pemilik_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!a) throw new Error("Assignment tidak ditemukan");
    if (!canAccessAssignment(ctx, { user_id: a.user_id, opd_id: a.opd_id })) {
      throw new Error("Akses ditolak");
    }
    // Ambil submission terkait user (terbaru)
    const { data: sub } = await supabaseAdmin
      .from("form_submissions")
      .select("*")
      .eq("assignment_id", a.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { assignment: a, submission: sub ?? null };
  });

/**
 * User menandai assignment-nya `in_progress` (saat mulai mengerjakan).
 * Transisi lain (`submitted`, `overdue`) dikelola server: `submitted` di-set
 * oleh submitSubmission; `overdue` di-set oleh cron reminder.
 */
export const updateAssignmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["in_progress"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const correlationId = newCorrelationId();
    const rl = await checkRateLimit(userId, "assignment.update", 20, 60);
    if (!rl.ok) {
      log.warn("assignment.update.rate_limited", { userId, correlationId, id: data.id });
      throw new Error("Terlalu banyak permintaan, coba lagi sebentar");
    }
    const key = idemKey("assignment:update", userId, { id: data.id, status: data.status });
    return withIdempotency(key, 10_000, async () => {
      const { data: a } = await supabaseAdmin
        .from("form_assignments")
        .select("id,user_id,status,version_number")
        .eq("id", data.id)
        .maybeSingle();
      if (!a) throw new Error("Assignment tidak ditemukan");
      if (a.user_id !== userId) throw new Error("Akses ditolak");
      if (a.status !== "assigned") {
        log.info("assignment.update.noop", {
          userId,
          correlationId,
          id: data.id,
          status: a.status,
        });
        return { ok: true, status: a.status };
      }
      try {
        await casUpdate<{ status: string }, { id: string }>({
          client: supabaseAdmin,
          table: "form_assignments",
          id: data.id,
          expectedVersion: (a as { version_number: number }).version_number,
          next: { status: "in_progress" },
        });
        log.info("assignment.update.ok", { userId, correlationId, id: data.id });
        return { ok: true, status: "in_progress" as const };
      } catch (e) {
        if (e instanceof CasConflictError) {
          log.warn("assignment.update.cas_conflict", { userId, correlationId, id: data.id });
          return { ok: false, code: "CAS_CONFLICT" as const, status: a.status };
        }
        throw e;
      }
    });
  });
