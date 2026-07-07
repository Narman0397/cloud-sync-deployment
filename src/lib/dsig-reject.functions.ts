// Tolak slot tanda tangan dengan alasan terstruktur (kode + teks bebas).
// Digunakan oleh halaman My Sign Inbox dan halaman detail permintaan TTE.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const REJECT_REASON_CODES = [
  "data_tidak_lengkap",
  "wewenang_tidak_tepat",
  "informasi_tidak_akurat",
  "sudah_didelegasikan",
  "dokumen_perlu_revisi",
  "lainnya",
] as const;
export type RejectReasonCode = (typeof REJECT_REASON_CODES)[number];

export const REJECT_REASON_LABEL: Record<RejectReasonCode, string> = {
  data_tidak_lengkap: "Data / berkas tidak lengkap",
  wewenang_tidak_tepat: "Bukan wewenang saya",
  informasi_tidak_akurat: "Informasi tidak akurat / salah",
  sudah_didelegasikan: "Sudah didelegasikan ke pihak lain",
  dokumen_perlu_revisi: "Dokumen perlu direvisi terlebih dulu",
  lainnya: "Lainnya",
};

const schema = z.object({
  signer_id: z.string().uuid(),
  reason_code: z.enum(REJECT_REASON_CODES),
  reason_text: z.string().trim().max(500).optional().nullable(),
});

export const rejectSigner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    // Validasi: slot harus pending dan milik pengguna aktif.
    const { data: slot, error: qErr } = await supabaseAdmin
      .from("signature_request_signers")
      .select("id,request_id,user_id,status")
      .eq("id", data.signer_id)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!slot) throw new Error("Slot tidak ditemukan");
    if (slot.user_id !== context.userId) throw new Error("Bukan slot milik Anda");
    if (slot.status !== "pending") throw new Error("Slot sudah bukan pending");
    if (data.reason_code === "lainnya" && !data.reason_text?.trim()) {
      throw new Error("Keterangan wajib untuk alasan 'Lainnya'");
    }

    const label = REJECT_REASON_LABEL[data.reason_code];
    const composed = data.reason_text?.trim()
      ? `${label} — ${data.reason_text.trim()}`
      : label;

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "rejected",
      rejected_at: nowIso,
      reject_reason: composed,
      reject_reason_code: data.reason_code,
      updated_at: nowIso,
    };
    const { error: uErr } = await supabaseAdmin
      .from("signature_request_signers")
      .update(updatePayload as never)
      .eq("id", data.signer_id);
    if (uErr) throw new Error(uErr.message);

    // Set request menjadi rejected & catat event audit.
    await supabaseAdmin
      .from("signature_requests")
      .update({ status: "rejected", completed_at: nowIso, updated_at: nowIso })
      .eq("id", slot.request_id);

    await supabaseAdmin.from("signature_events").insert({
      request_id: slot.request_id,
      event: "rejected",
      payload: {
        signer_id: slot.id,
        by_user_id: context.userId,
        reason_code: data.reason_code,
        reason_text: data.reason_text ?? null,
      },
    });

    return { ok: true };
  });
