// CRUD master jabatan untuk super_admin / admin_pemda.
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
      .select("id,kode,nama,kategori,system_position,urutan,aktif,created_at,updated_at")
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
    const payload = {
      kode: data.kode,
      nama: data.nama,
      kategori: data.kategori ?? null,
      system_position: data.system_position ?? null,
      urutan: data.urutan,
      aktif: data.aktif,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("master_jabatan").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
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
    const { error } = await supabaseAdmin.from("master_jabatan").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
