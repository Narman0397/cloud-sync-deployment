// Public tracking permohonan tanpa login.
// Verifikasi ringan: kode + 4 digit terakhir NIK pemohon (atau atas_nama_nik).
// Rate-limit ketat untuk mencegah enumerasi.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforcePublicRateLimit } from "@/integrations/supabase/rate-limit.server";

export type PermohonanPublic = {
  id: string;
  kode: string;
  judul: string;
  kategori: string;
  status: string;
  tanggal_masuk: string;
  alasan_penolakan: string | null;
  opd_singkatan: string | null;
  opd_nama: string | null;
  riwayat: Array<{ aksi: string; catatan: string | null; created_at: string }>;
};

export const getPermohonanPublik = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kode: z.string().trim().min(4).max(64),
        nik4: z.string().trim().regex(/^\d{4}$/, "4 digit terakhir NIK"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PermohonanPublic | null> => {
    await enforcePublicRateLimit("permohonan_lookup", { limit: 20, windowSec: 60 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const kode = data.kode.toUpperCase();
    const { data: rowRaw, error } = await supabaseAdmin
      .from("permohonan")
      .select(
        "id,kode,judul,kategori,status,tanggal_masuk,atas_nama_nik,pemohon_id,opd:opd!opd_id(nama,singkatan)",
      )
      .eq("kode", kode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rowRaw) return null;
    const row = rowRaw as unknown as {
      id: string;
      kode: string;
      judul: string;
      kategori: string;
      status: string;
      tanggal_masuk: string;
      atas_nama_nik: string | null;
      pemohon_id: string | null;
      opd: { nama: string; singkatan: string } | null;
    };

    // Verifikasi NIK 4 digit terakhir — dari atas_nama_nik atau profil pemohon
    let nikRef: string | null = row.atas_nama_nik ?? null;
    if (!nikRef && row.pemohon_id) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("nik")
        .eq("id", row.pemohon_id)
        .maybeSingle();
      nikRef = ((p as { nik: string | null } | null)?.nik) ?? null;
    }
    if (!nikRef || nikRef.slice(-4) !== data.nik4) return null;

    const { data: riw } = await supabaseAdmin
      .from("permohonan_riwayat")
      .select("aksi,catatan,created_at")
      .eq("permohonan_id", row.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Ambil alasan penolakan dari riwayat catatan (kolom tidak ada di tabel)
    const alasan =
      row.status === "ditolak"
        ? ((riw ?? []) as Array<{ aksi: string; catatan: string | null }>).find(
            (r) => /ditolak/i.test(r.aksi) && r.catatan,
          )?.catatan ?? null
        : null;

    return {
      id: row.id,
      kode: row.kode,
      judul: row.judul,
      kategori: row.kategori,
      status: row.status,
      tanggal_masuk: row.tanggal_masuk,
      alasan_penolakan: alasan,
      opd_singkatan: row.opd?.singkatan ?? null,
      opd_nama: row.opd?.nama ?? null,
      riwayat: (riw ?? []) as Array<{ aksi: string; catatan: string | null; created_at: string }>,
    };
  });
