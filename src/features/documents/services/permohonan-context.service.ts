// Build merge context untuk dokumen final berbasis PERMOHONAN.
// Sumber: profiles (akun pemohon), permohonan (input), layanan_publik, opd, sistem.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { MergeContext } from "@/features/documents/placeholder/engine";

type SB = SupabaseClient<Database>;

export interface PermohonanCtxExtras {
  verify_url?: string;
  hash?: string;
  tanggal_terbit?: string;
}

export async function buildPermohonanContext(
  supabase: SB,
  permohonan_id: string,
  extras: PermohonanCtxExtras = {},
): Promise<MergeContext> {
  const { data: p } = await supabase
    .from("permohonan")
    .select(
      "id,kode,judul,kategori,deskripsi,tanggal_masuk,nomor_surat,opd_id,pemohon_id,untuk_orang_lain,atas_nama_nama,atas_nama_nik,atas_nama_hp",
    )
    .eq("id", permohonan_id)
    .maybeSingle();
  if (!p) throw new Error("Permohonan tidak ditemukan");

  const { data: prof } = p.pemohon_id
    ? await supabase
        .from("profiles")
        .select("nama_lengkap,nik,no_hp,alamat,desa")
        .eq("id", p.pemohon_id)
        .maybeSingle()
    : { data: null };

  let email = "";
  if (p.pemohon_id) {
    const { data: au } = await supabase.auth.admin
      .getUserById(p.pemohon_id)
      .catch(() => ({ data: null }) as { data: null });
    const u = (au as { user?: { email?: string | null } } | null)?.user;
    email = u?.email ?? "";
  }

  const { data: opd } = p.opd_id
    ? await supabase
        .from("opd")
        .select("nama,singkatan,nomor_surat_kode")
        .eq("id", p.opd_id)
        .maybeSingle()
    : { data: null };

  const { data: lay } = await supabase
    .from("layanan_publik")
    .select("id,judul,slug,dasar_hukum,biaya,produk_layanan,document_template_id,tte_required,tte_signer_role,opd_id")
    .or(`judul.eq.${p.kategori},slug.eq.${p.kategori}`)
    .maybeSingle();

  const now = extras.tanggal_terbit
    ? new Date(extras.tanggal_terbit)
    : new Date();

  const ctx = {
    pemohon: {
      nama: prof?.nama_lengkap ?? "-",
      nik: prof?.nik ?? "-",
      no_hp: prof?.no_hp ?? "-",
      email,
      alamat: (prof as { alamat?: string | null } | null)?.alamat ?? "-",
      desa: prof?.desa ?? "-",
    },
    permohonan: {
      kode: p.kode,
      judul: p.judul,
      kategori: p.kategori,
      deskripsi: p.deskripsi ?? "-",
      tanggal_masuk: new Date(p.tanggal_masuk).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      nomor_surat: p.nomor_surat ?? "-",
    },
    atas_nama: {
      nama: p.untuk_orang_lain ? (p.atas_nama_nama ?? "-") : "-",
      nik: p.untuk_orang_lain ? (p.atas_nama_nik ?? "-") : "-",
      hp: p.untuk_orang_lain ? (p.atas_nama_hp ?? "-") : "-",
    },
    opd: {
      nama: opd?.nama ?? "-",
      singkatan: opd?.singkatan ?? "-",
      kode_surat:
        (opd as { nomor_surat_kode?: string | null } | null)?.nomor_surat_kode ?? "-",
    },
    layanan: {
      judul: lay?.judul ?? p.kategori,
      slug: lay?.slug ?? "",
      dasar_hukum: lay?.dasar_hukum ?? "-",
      biaya: lay?.biaya ?? "-",
      produk_layanan: (lay as { produk_layanan?: string | null } | null)?.produk_layanan ?? "-",
    },
    sistem: {
      tanggal_terbit: now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      tahun: now.getFullYear(),
      qr_verifikasi_url: extras.verify_url ?? "",
      hash: extras.hash ?? "",
    },
  };

  return ctx as unknown as MergeContext;
}

// Ambil template terpilih untuk sebuah permohonan (via layanan_publik).
export async function getLayananTemplateForPermohonan(
  supabase: SB,
  permohonan_id: string,
): Promise<{ template_html: string | null; template_id: string | null; layanan_id: string | null; tte_required: boolean; tte_signer_role: string | null }> {
  const { data: p } = await supabase
    .from("permohonan")
    .select("kategori")
    .eq("id", permohonan_id)
    .maybeSingle();
  if (!p) return { template_html: null, template_id: null, layanan_id: null, tte_required: false, tte_signer_role: null };
  const { data: lay } = await supabase
    .from("layanan_publik")
    .select("id,document_template_id,tte_required,tte_signer_role")
    .or(`judul.eq.${p.kategori},slug.eq.${p.kategori}`)
    .maybeSingle();
  if (!lay?.document_template_id) {
    return {
      template_html: null,
      template_id: null,
      layanan_id: lay?.id ?? null,
      tte_required: (lay as { tte_required?: boolean } | null)?.tte_required ?? false,
      tte_signer_role: (lay as { tte_signer_role?: string | null } | null)?.tte_signer_role ?? null,
    };
  }
  const { data: tpl } = await supabase
    .from("document_templates")
    .select("template_html")
    .eq("id", lay.document_template_id)
    .maybeSingle();
  return {
    template_html: (tpl as { template_html?: string | null } | null)?.template_html ?? null,
    template_id: lay.document_template_id,
    layanan_id: lay.id,
    tte_required: (lay as { tte_required?: boolean } | null)?.tte_required ?? false,
    tte_signer_role: (lay as { tte_signer_role?: string | null } | null)?.tte_signer_role ?? null,
  };
}
