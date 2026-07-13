// CRUD master jabatan untuk super_admin / admin_pemda.
// Jabatan sistem (is_system=true) tidak bisa dihapus dan kode/klasifikasinya
// tidak bisa diubah — dilindungi oleh trigger DB (protect_system_jabatan).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserContext } from "@/features/rbac/guards";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function getAdmin(): Promise<AnyClient> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as AnyClient;
}

const systemPositionSchema = z
  .enum([
    "kepala_opd",
    "sekretaris",
    "kepala_bidang",
    "kepala_sekolah",
    "operator",
    "verifikator",
    "staff",
    "guru",
    "tenaga_teknis",
    "lainnya",
  ])
  .nullable()
  .optional();

async function assertAdmin(userId: string) {
  const supabaseAdmin = await getAdmin();
  const ctx = await getUserContext(supabaseAdmin, userId);
  if (!ctx.isSuper && !ctx.roleSet.has("admin_pemda")) throw new Error("Forbidden");
}

export const listMasterJabatan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const supabaseAdmin = await getAdmin();
    const { data, error } = await supabaseAdmin
      .from("master_jabatan")
      .select("id,kode,nama,kategori,system_position,urutan,aktif,is_system,created_at,updated_at")
      .order("urutan");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

/** Daftar jabatan sistem (default bawaan aplikasi) — tidak boleh dihapus. */
export const listSystemJabatan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const supabaseAdmin = await getAdmin();
    const { data, error } = await supabaseAdmin
      .from("master_jabatan")
      .select("id,kode,nama,kategori,system_position,urutan,aktif,is_system")
      .eq("is_system", true)
      .order("urutan");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  kode: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/, "Huruf besar / angka / _ saja"),
  nama: z.string().trim().min(2).max(120),
  kategori: z.string().trim().max(60).nullable().optional(),
  system_position: systemPositionSchema,
  urutan: z.number().int().min(0).max(9999).default(0),
  aktif: z.boolean().default(true),
});

export const upsertMasterJabatan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    if (data.id) {
      // Untuk jabatan sistem, hanya izinkan ubah nama, kategori, urutan, aktif.
      const { data: existing } = await supabaseAdmin
        .from("master_jabatan")
        .select("is_system,kode,system_position")
        .eq("id", data.id)
        .maybeSingle();
      const isSystem = Boolean(existing?.is_system);
      const patch: Record<string, unknown> = isSystem
        ? {
            nama: data.nama,
            kategori: data.kategori ?? null,
            urutan: data.urutan,
            aktif: data.aktif,
          }
        : {
            kode: data.kode,
            nama: data.nama,
            kategori: data.kategori ?? null,
            system_position: data.system_position ?? null,
            urutan: data.urutan,
            aktif: data.aktif,
          };
      const { error } = await supabaseAdmin.from("master_jabatan").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const payload = {
      kode: data.kode,
      nama: data.nama,
      kategori: data.kategori ?? null,
      system_position: data.system_position ?? null,
      urutan: data.urutan,
      aktif: data.aktif,
      is_system: false,
    };
    const { data: row, error } = await supabaseAdmin
      .from("master_jabatan")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const deleteMasterJabatan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    const { data: existing } = await supabaseAdmin
      .from("master_jabatan")
      .select("is_system")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.is_system) throw new Error("Jabatan sistem tidak dapat dihapus");
    const { error } = await supabaseAdmin.from("master_jabatan").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Daftar seluruh permission (katalog) untuk dialog RBAC. */
export const listPermissionsCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const supabaseAdmin = await getAdmin();
    const { data, error } = await supabaseAdmin
      .from("permissions")
      .select("code,label,kategori,description")
      .order("kategori")
      .order("code");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

/** Ambil daftar permission untuk satu jabatan. */
export const listJabatanPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ jabatan_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("jabatan_permissions")
      .select("permission_code")
      .eq("jabatan_id", data.jabatan_id);
    if (error) throw new Error(error.message);
    return {
      codes: ((rows ?? []) as Array<{ permission_code: string }>).map((r) => r.permission_code),
    };
  });

/** Set ulang daftar permission untuk satu jabatan (replace all). */
export const setJabatanPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        jabatan_id: z.string().uuid(),
        codes: z.array(z.string().min(1).max(80)).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const supabaseAdmin = await getAdmin();
    // Delete all existing, then insert new set (idempotent replace).
    const { error: delErr } = await supabaseAdmin
      .from("jabatan_permissions")
      .delete()
      .eq("jabatan_id", data.jabatan_id);
    if (delErr) throw new Error(delErr.message);
    if (data.codes.length > 0) {
      const unique = Array.from(new Set(data.codes));
      const payload = unique.map((code) => ({
        jabatan_id: data.jabatan_id,
        permission_code: code,
        created_by: context.userId,
      }));
      const { error: insErr } = await supabaseAdmin.from("jabatan_permissions").insert(payload);
      if (insErr) throw new Error(insErr.message);
    }
    await supabaseAdmin.from("audit_log").insert({
      user_id: context.userId,
      aksi: "jabatan.permissions_updated",
      entitas: "master_jabatan",
      entitas_id: data.jabatan_id,
      data_sesudah: { codes: data.codes } as never,
    });
    return { ok: true, count: data.codes.length };
  });
