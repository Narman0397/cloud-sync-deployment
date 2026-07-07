// Bulk-signing & multi-signer paralel.
// - `enqueueBulkSign`: tandai banyak dokumen untuk ditandatangani satu kali OTP.
// - `listMyPendingSigners`: ambil daftar slot tanda tangan milik user (urut / paralel).
// - `setSignersParallelMode`: ubah mode urutan/paralel + deadline per signer.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/integrations/supabase/rate-limit.server";

export const listMyPendingSigners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("signature_request_signers")
      .select(
        "id,request_id,order_index,parallel,deadline_at,status, request:signature_requests!request_id(id,current_step,status)",
      )
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Filter signer non-paralel yang belum gilirannya
    const rows = (data ?? []).filter((r) => {
      const req = r.request as { current_step?: number } | null;
      return r.parallel ? true : (req?.current_step ?? r.order_index) >= r.order_index;
    });
    return { rows };
  });

export const setSignersParallelMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        parallel: z.boolean(),
        deadline_at: z.string().datetime().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const upd: { parallel: boolean; deadline_at?: string | null } = { parallel: data.parallel };
    if (data.deadline_at !== undefined) upd.deadline_at = data.deadline_at;
    const { error } = await supabaseAdmin
      .from("signature_request_signers")
      .update(upd)
      .eq("request_id", data.request_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enqueueBulkSign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        signer_ids: z.array(z.string().uuid()).min(1).max(50),
        otp: z.string().regex(/^\d{4,8}$/),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const rl = await checkRateLimit(context.userId, "bulk_sign", 5, 60);
    if (!rl.ok) throw new Error("Terlalu banyak permintaan bulk sign");
    // Validasi: pastikan semua slot benar milik user, masih pending, & sudah gilirannya.
    const { data: rows } = await supabaseAdmin
      .from("signature_request_signers")
      .select(
        "id,user_id,status,request_id,order_index,parallel, request:signature_requests!request_id(current_step)",
      )
      .in("id", data.signer_ids);
    const valid = (rows ?? []).filter((r) => {
      if (r.user_id !== context.userId || r.status !== "pending") return false;
      if (r.parallel) return true;
      const req = r.request as { current_step?: number } | null;
      const step = req?.current_step ?? r.order_index;
      return step >= r.order_index; // enforcement: belum giliran → tolak
    });
    if (valid.length === 0)
      throw new Error("Tidak ada slot valid: belum giliran, sudah selesai, atau bukan milik Anda");
    // Catatan: signing kriptografik aktual dilakukan oleh `signDocument` per dokumen.
    // Fungsi ini hanya menandai antrean bulk + audit; UI akan loop memanggil signDocument.
    const jobId = crypto.randomUUID();
    await supabaseAdmin.from("signature_events").insert(
      valid.map((v) => ({
        request_id: v.request_id,
        signer_id: v.id,
        event: "bulk_enqueued",
        actor: context.userId,
        payload: { job_id: jobId },
      })),
    );
    return { ok: true, job_id: jobId, queued: valid.map((v) => v.id) };
  });

// ---------- DELEGATION ----------
// Mendelegasikan slot tanda tangan pending kepada user lain.
// Pemilik slot (user_id di signature_request_signers) memindah tugas ke to_user_id;
// slot signer di-update user_id-nya, dan riwayat delegasi disimpan.
export const dcDelegateSigner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        signer_id: z.string().uuid(),
        to_user_id: z.string().uuid(),
        reason: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const rl = await checkRateLimit(context.userId, "sig_delegate", 20, 60);
    if (!rl.ok) throw new Error("Terlalu banyak delegasi");
    if (data.to_user_id === context.userId) throw new Error("Tidak dapat mendelegasikan ke diri sendiri");
    const { data: slot, error: sErr } = await supabaseAdmin
      .from("signature_request_signers")
      .select("id,user_id,status,request_id")
      .eq("id", data.signer_id)
      .maybeSingle();
    if (sErr || !slot) throw new Error("Slot tidak ditemukan");
    if (slot.user_id !== context.userId) throw new Error("Hanya pemilik slot yang bisa mendelegasikan");
    if (slot.status !== "pending") throw new Error("Slot sudah tidak pending");

    const { error: insErr } = await supabaseAdmin.from("signature_delegations").insert({
      signer_id: slot.id,
      from_user_id: context.userId,
      to_user_id: data.to_user_id,
      reason: data.reason ?? null,
      status: "active",
    });
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("signature_request_signers")
      .update({ user_id: data.to_user_id })
      .eq("id", slot.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("signature_events").insert({
      request_id: slot.request_id,
      signer_id: slot.id,
      event: "delegated",
      actor: context.userId,
      payload: { to_user_id: data.to_user_id, reason: data.reason ?? null },
    });
    return { ok: true };
  });

// Daftar delegasi terkait user (dibuat oleh saya atau ditujukan ke saya).
export const dcListMyDelegations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("signature_delegations")
      .select("id,signer_id,from_user_id,to_user_id,reason,status,delegated_at,revoked_at")
      .or(`from_user_id.eq.${context.userId},to_user_id.eq.${context.userId}`)
      .order("delegated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// Pencarian sederhana user tujuan delegasi (nama/NIP/jabatan).
export const dcSearchDelegates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ q: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    const term = `%${data.q}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id,nama_lengkap,nip,jabatan")
      .or(`nama_lengkap.ilike.${term},nip.ilike.${term},jabatan.ilike.${term}`)
      .neq("id", context.userId)
      .limit(20);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
