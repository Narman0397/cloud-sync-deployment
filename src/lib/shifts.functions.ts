// Sprint B — Attendance Shifts master + assignment
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserContext } from "@/features/rbac/guards";

const timeStr = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format jam HH:MM");

async function assertShiftAdmin(userId: string, targetOpdId?: string | null) {
  const ctx = await getUserContext(supabaseAdmin, userId);
  if (ctx.isSuper || ctx.isElevated) return ctx;
  if (
    ctx.isAdminOpd &&
    (targetOpdId === undefined || targetOpdId === null || targetOpdId === ctx.opdId)
  )
    return ctx;
  throw new Error("Forbidden");
}

export const listShifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ opd_id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await getUserContext(supabaseAdmin, context.userId);
    let q = supabaseAdmin
      .from("attendance_shifts")
      .select("id,opd_id,nama,jam_masuk,jam_pulang,toleransi_menit,jenis,aktif,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.opd_id) q = q.eq("opd_id", data.opd_id);
    else if (!(ctx.isSuper || ctx.isElevated) && ctx.opdId) q = q.eq("opd_id", ctx.opdId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        opd_id: z.string().uuid().nullable().optional(),
        nama: z.string().min(2).max(120),
        jam_masuk: timeStr,
        jam_pulang: timeStr,
        toleransi_menit: z.number().int().min(0).max(120).default(15),
        jenis: z.enum(["pagi", "malam", "khusus"]).default("pagi"),
        aktif: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertShiftAdmin(context.userId, data.opd_id ?? null);
    const payload = { ...data, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await supabaseAdmin.from("attendance_shifts").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("attendance_shifts").insert(payload);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      aksi: data.id ? "shift.update" : "shift.create",
      entitas: "attendance_shifts",
      entitas_id: data.id ?? null,
      data_sesudah: payload,
    });
    return { ok: true };
  });

export const assignShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        shift_id: z.string().uuid(),
        dari: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sampai: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Ambil OPD target dari profile user penerima shift + shift itu sendiri
    const [{ data: tgtProfile }, { data: shiftRow }] = await Promise.all([
      supabaseAdmin.from("profiles").select("opd_id").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin.from("attendance_shifts").select("opd_id").eq("id", data.shift_id).maybeSingle(),
    ]);
    const ctx = await getUserContext(supabaseAdmin, context.userId);
    const targetOpd = (tgtProfile?.opd_id as string | null) ?? null;
    const shiftOpd = (shiftRow?.opd_id as string | null) ?? null;
    if (!(ctx.isSuper || ctx.isElevated)) {
      if (!ctx.isAdminOpd) throw new Error("Forbidden");
      if (targetOpd && ctx.opdId && targetOpd !== ctx.opdId) throw new Error("Forbidden");
      if (shiftOpd && ctx.opdId && shiftOpd !== ctx.opdId) throw new Error("Forbidden");
    }
    const { error } = await supabaseAdmin.from("attendance_shift_assignment").insert({
      user_id: data.user_id,
      shift_id: data.shift_id,
      dari: data.dari,
      sampai: data.sampai ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      aksi: "shift.assign",
      entitas: "attendance_shift_assignment",
      data_sesudah: {
        user_id: data.user_id,
        shift_id: data.shift_id,
        dari: data.dari,
        sampai: data.sampai,
      },
    });
    return { ok: true };
  });

export const deleteShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("attendance_shifts")
      .select("opd_id")
      .eq("id", data.id)
      .maybeSingle();
    await assertShiftAdmin(context.userId, (row?.opd_id as string | null) ?? null);
    const { error } = await supabaseAdmin.from("attendance_shifts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      aksi: "shift.delete",
      entitas: "attendance_shifts",
      entitas_id: data.id,
    });
    return { ok: true };
  });

export const listAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = await getUserContext(supabaseAdmin, context.userId);
    // Pegawai biasa hanya melihat assignment miliknya
    const targetUser = data.user_id ?? context.userId;
    if (!(ctx.isSuper || ctx.isElevated || ctx.isAdminOpd) && targetUser !== context.userId) {
      throw new Error("Forbidden");
    }
    let q = supabaseAdmin
      .from("attendance_shift_assignment")
      .select(
        "id,user_id,shift_id,dari,sampai,aktif,created_at, shift:attendance_shifts!shift_id(nama,jam_masuk,jam_pulang)",
      )
      .order("dari", { ascending: false })
      .limit(300);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    else if (!(ctx.isSuper || ctx.isElevated || ctx.isAdminOpd)) q = q.eq("user_id", context.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
