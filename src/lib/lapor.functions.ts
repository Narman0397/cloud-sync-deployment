// Server functions untuk fitur LAPOR! (pengaduan masyarakat).
// - getLaporanByTicket: publik + rate-limit (untuk halaman cek status)
// - getMyLaporan: autentikasi, daftar laporan milik user
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforcePublicRateLimit } from "@/integrations/supabase/rate-limit.server";

export type LaporanPublic = {
  ticket_code: string;
  nama: string;
  kategori: string;
  lokasi: string | null;
  uraian: string;
  status: string;
  tindak_lanjut: string | null;
  created_at: string;
  updated_at: string;
};

export const getLaporanByTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ ticket: z.string().trim().min(6).max(64) }).parse(input),
  )
  .handler(async ({ data }): Promise<LaporanPublic | null> => {
    await enforcePublicRateLimit("lapor_lookup", { limit: 30, windowSec: 60 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("laporan_masyarakat")
      .select(
        "ticket_code,nama,kategori,lokasi,uraian,status,tindak_lanjut,created_at,updated_at",
      )
      .eq("ticket_code", data.ticket.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as LaporanPublic | null) ?? null;
  });

export const getMyLaporan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("laporan_masyarakat")
      .select("id,ticket_code,kategori,uraian,status,created_at,updated_at,tindak_lanjut")
      .eq("pelapor_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
