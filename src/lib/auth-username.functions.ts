// Login/Daftar dengan USERNAME.
// Enterprise hardening (Phase 1,3,4,5):
//  - Password min 8 + kompleks (huruf besar/kecil/angka).
//  - Email wajib & WAJIB diverifikasi (email_confirm:false) — tidak ada shadow email lagi.
//  - Rollback otomatis auth user bila profile upsert gagal (no orphan auth users).
//  - Auto-login setelah signup DIHAPUS (lihat src/routes/auth.tsx). Server fn ini tidak membuat sesi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

async function getAdmin(): Promise<AnyClient> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin as AnyClient;
}

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9_.-]+$/, "Username hanya huruf kecil, angka, . _ -");

// Enterprise password policy: ≥8 char, mengandung huruf besar, huruf kecil, dan angka.
const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72)
  .regex(/[a-z]/, "Password harus memuat huruf kecil")
  .regex(/[A-Z]/, "Password harus memuat huruf besar")
  .regex(/\d/, "Password harus memuat angka");

export const resolveUsernameEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    // Phase 2 (user enumeration) — generic flow: tidak pernah membocorkan keberadaan akun.
    // Selalu kembalikan email yang dapat dipakai signInWithPassword. Bila tidak ditemukan,
    // kembalikan placeholder yang dijamin gagal login dengan pesan generic.
    const u = data.username.toLowerCase();
    if (u.includes("@")) return { email: u };
    const rl = await checkRateLimit(`uname:${u}`, "resolve_username", 30, 60);
    if (!rl.ok) throw new Error("Terlalu banyak percobaan, coba lagi nanti");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", u)
      .maybeSingle();
    if (!prof) {
      // Jangan ungkap "tidak ditemukan" — kembalikan placeholder yang akan gagal login.
      return { email: `${u}@invalid.local` };
    }
    const { data: au } = await supabaseAdmin.auth.admin.getUserById(prof.id);
    return { email: au.user?.email ?? `${u}@invalid.local` };
  });

const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  // Phase 3: email wajib agar verifikasi email bisa dilakukan.
  email: z.string().trim().email("Email wajib & harus valid").max(255),
  nama_lengkap: z.string().trim().min(2).max(120),
  no_hp: z
    .string()
    .trim()
    .regex(/^(\+62|62|0)8\d{7,12}$/)
    .optional()
    .nullable(),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/)
    .optional()
    .nullable(),
  desa: z.string().trim().min(2).max(120).optional().nullable(),
  alamat: z.string().trim().max(500).optional().nullable(),
  opd_id: z.string().uuid().optional().nullable(),
  nip: z
    .string()
    .trim()
    .regex(/^\d{8,20}$/)
    .optional()
    .nullable(),
  jabatan_id: z.string().uuid().optional().nullable(),
  asn_type: z.enum(["pns", "pppk_penuh_waktu", "pppk_paruh_waktu"]).optional().nullable(),
  requested_role: z.enum(["warga", "admin_desa", "admin_opd", "asn"]),
});

export const signupWithUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const u = data.username.toLowerCase();
    const rl = await checkRateLimit(`signup:${u}`, "signup", 5, 300);
    if (!rl.ok) throw new Error("Terlalu banyak pendaftaran, coba lagi nanti");

    // Cek konflik username (case-insensitive; constraint unique di DB juga menjamin).
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", u)
      .maybeSingle();
    if (existing) throw new Error("Username sudah dipakai, silakan pilih yang lain");

    if (data.requested_role === "asn") {
      if (!data.opd_id) throw new Error("OPD/Instansi wajib dipilih untuk ASN");
      if (!data.nip) throw new Error("NIP wajib diisi untuk ASN");
      if (!data.jabatan_id) throw new Error("Jabatan wajib dipilih untuk ASN");
      if (!data.asn_type) throw new Error("Jenis ASN wajib dipilih");
    }

    // Anti-duplicate NIP untuk ASN.
    if (data.requested_role === "asn" && data.nip) {
      const { data: dupNip } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("nip", data.nip)
        .maybeSingle();
      if (dupNip) throw new Error("NIP sudah terdaftar pada akun lain");
    }

    const email = data.email.trim().toLowerCase();

    // Tentukan status awal verifikasi sesuai role yang diminta.
    const initialStatus =
      data.requested_role === "admin_opd" || data.requested_role === "admin_desa"
        ? "pending_superadmin_approval"
        : "pending_verification";

    // Phase 3: email_confirm=false → user WAJIB klik link verifikasi sebelum bisa login.
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: false,
      user_metadata: {
        username: u,
        nama_lengkap: data.nama_lengkap,
        no_hp: data.no_hp ?? null,
        nik: data.requested_role === "warga" ? (data.nik ?? null) : null,
        desa:
          data.requested_role === "warga" || data.requested_role === "admin_desa"
            ? (data.desa ?? null)
            : null,
        alamat: data.alamat ?? null,
        requested_role: data.requested_role,
      },
    });
    if (error) throw new Error(error.message);
    const userId = created.user!.id;

    // Phase 1: dari titik ini ke bawah, segala kegagalan WAJIB rollback auth user
    // agar tidak ada orphan di auth.users.
    try {
      const profileUpdate: Record<string, unknown> = {
        id: userId,
        username: u,
        nama_lengkap: data.nama_lengkap,
        no_hp: data.no_hp ?? null,
        alamat: data.alamat ?? null,
        requested_role: data.requested_role,
        verification_status: initialStatus,
        verified_at: null,
        verified_by: null,
        verification_method: null,
      };
      if (data.requested_role === "warga") {
        profileUpdate.nik = data.nik ?? null;
        profileUpdate.desa = data.desa ?? null;
      }
      if (data.requested_role === "admin_desa") profileUpdate.desa = data.desa ?? null;
      if (data.requested_role === "admin_opd") profileUpdate.opd_id = data.opd_id ?? null;
      if (data.requested_role === "asn") {
        const { data: jabatan } = await supabaseAdmin
          .from("master_jabatan")
          .select("nama,system_position")
          .eq("id", data.jabatan_id)
          .maybeSingle();
        profileUpdate.opd_id = data.opd_id ?? null;
        profileUpdate.nip = data.nip ?? null;
        profileUpdate.jabatan_id = data.jabatan_id ?? null;
        profileUpdate.jabatan = jabatan?.nama ?? null;
        profileUpdate.system_position = jabatan?.system_position ?? null;
        profileUpdate.asn_type = data.asn_type ?? null;
      }
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(profileUpdate as any, { onConflict: "id" });
      if (profileErr) throw new Error(profileErr.message);

      // Pastikan tidak ada sisa role dari trigger lama / data migrasi.
      // Role hanya diberikan SETELAH approval/verifikasi selesai (lihat fn_approve_user di DB).
      const { error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (rolesErr) throw new Error(rolesErr.message);
    } catch (e) {
      // Rollback: hapus user auth yang baru dibuat agar tidak orphan.
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (rollbackErr) {
        // Catat kegagalan rollback ke audit_log; jangan menelan error utama.
        await supabaseAdmin
          .from("audit_log")
          .insert({
            user_id: null,
            aksi: "user.signup_rollback_failed",
            entitas: "auth.user",
            entitas_id: userId,
            data_sesudah: {
              reason: (e as Error).message,
              rollback_error: (rollbackErr as Error).message,
            } as never,
          })
          .then(() => {});
      }
      throw e;
    }

    // Audit log signup (best-effort).
    await supabaseAdmin
      .from("audit_log")
      .insert({
        user_id: userId,
        aksi: "user.registered",
        entitas: "user",
        entitas_id: userId,
        data_sesudah: {
          username: u,
          requested_role: data.requested_role,
          verification_status: initialStatus,
          email_verification_required: true,
        } as never,
      })
      .then(() => {});

    // Phase 5: TIDAK mengembalikan sinyal auto-login. Frontend WAJIB menampilkan
    // halaman "cek email" + arahkan ke /pending-verification setelah verifikasi.
    return {
      ok: true,
      email,
      username: u,
      verification_status: initialStatus,
      email_verification_required: true,
    };
  });

// Phase 3: resend email verifikasi. Generic response — tidak membocorkan keberadaan akun.
export const resendVerificationEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const email = data.email.toLowerCase();
    const rl = await checkRateLimit(`resend:${email}`, "resend_verification", 3, 300);
    if (!rl.ok) {
      // Tetap generic — jangan beda dengan sukses.
      return { ok: true };
    }
    // Best-effort; abaikan error spesifik agar tidak ungkap status akun.
    await supabaseAdmin.auth.resend({ type: "signup", email }).catch(() => {});
    await supabaseAdmin
      .from("audit_log")
      .insert({
        user_id: null,
        aksi: "user.verification_resend_requested",
        entitas: "auth.user",
        entitas_id: null,
        data_sesudah: { email } as never,
      })
      .then(() => {});
    return { ok: true };
  });
