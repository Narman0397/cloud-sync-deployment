// Katalog placeholder untuk template dokumen layanan publik (sumber: permohonan).
// Semua token dipakai dalam template HTML dengan sintaks {{group.field}}.
export interface PermohonanPlaceholderItem {
  token: string;
  label: string;
  example?: string;
}
export interface PermohonanPlaceholderGroup {
  category: "pemohon" | "permohonan" | "atas_nama" | "opd" | "layanan" | "sistem";
  label: string;
  items: PermohonanPlaceholderItem[];
}

export const PERMOHONAN_PLACEHOLDERS: PermohonanPlaceholderGroup[] = [
  {
    category: "pemohon",
    label: "Data Pemohon (akun)",
    items: [
      { token: "pemohon.nama", label: "Nama Lengkap" },
      { token: "pemohon.nik", label: "NIK" },
      { token: "pemohon.no_hp", label: "No. HP" },
      { token: "pemohon.email", label: "Email" },
      { token: "pemohon.alamat", label: "Alamat" },
      { token: "pemohon.desa", label: "Desa/Kelurahan" },
    ],
  },
  {
    category: "permohonan",
    label: "Data Permohonan",
    items: [
      { token: "permohonan.kode", label: "Kode Permohonan" },
      { token: "permohonan.judul", label: "Judul" },
      { token: "permohonan.kategori", label: "Kategori/Layanan" },
      { token: "permohonan.deskripsi", label: "Deskripsi/Uraian" },
      { token: "permohonan.tanggal_masuk", label: "Tanggal Masuk" },
      { token: "permohonan.nomor_surat", label: "Nomor Surat" },
    ],
  },
  {
    category: "atas_nama",
    label: "Atas Nama (jika untuk orang lain)",
    items: [
      { token: "atas_nama.nama", label: "Nama" },
      { token: "atas_nama.nik", label: "NIK" },
      { token: "atas_nama.hp", label: "No. HP" },
    ],
  },
  {
    category: "opd",
    label: "OPD Pemilik Layanan",
    items: [
      { token: "opd.nama", label: "Nama OPD" },
      { token: "opd.singkatan", label: "Singkatan" },
      { token: "opd.kode_surat", label: "Kode Surat" },
    ],
  },
  {
    category: "layanan",
    label: "Layanan Publik",
    items: [
      { token: "layanan.judul", label: "Judul Layanan" },
      { token: "layanan.slug", label: "Slug" },
      { token: "layanan.dasar_hukum", label: "Dasar Hukum" },
      { token: "layanan.biaya", label: "Biaya" },
      { token: "layanan.produk_layanan", label: "Produk Layanan" },
    ],
  },
  {
    category: "sistem",
    label: "Sistem",
    items: [
      { token: "sistem.tanggal_terbit", label: "Tanggal Terbit" },
      { token: "sistem.tahun", label: "Tahun" },
      { token: "sistem.qr_verifikasi_url", label: "URL Verifikasi (QR)" },
      { token: "sistem.hash", label: "SHA-256 Dokumen" },
    ],
  },
];

// Boilerplate awal untuk template baru dari halaman Layanan.
export function defaultLayananTemplateHtml(judulLayanan: string): string {
  return `
<div style="font-family: Helvetica, Arial, sans-serif; font-size:12px;">
  <div style="text-align:center; font-weight:bold; font-size:14px; text-transform:uppercase;">
    PEMERINTAH DAERAH
  </div>
  <div style="text-align:center; font-weight:bold; font-size:16px;">{{opd.nama}}</div>
  <div style="text-align:center; font-size:11px;">({{opd.singkatan}})</div>
  <hr/>
  <p style="text-align:right;">{{sistem.tanggal_terbit}}</p>
  <p>Nomor : {{permohonan.nomor_surat}}<br/>
     Perihal : ${judulLayanan}</p>
  <p>Dengan hormat,</p>
  <p>Berdasarkan permohonan yang diajukan dengan data sebagai berikut:</p>
  <table style="border-collapse:collapse;">
    <tr><td>Nama Pemohon</td><td>: {{pemohon.nama}}</td></tr>
    <tr><td>NIK</td><td>: {{pemohon.nik}}</td></tr>
    <tr><td>Alamat</td><td>: {{pemohon.alamat}}, {{pemohon.desa}}</td></tr>
    <tr><td>No. HP</td><td>: {{pemohon.no_hp}}</td></tr>
    <tr><td>Kode Permohonan</td><td>: {{permohonan.kode}}</td></tr>
    <tr><td>Judul</td><td>: {{permohonan.judul}}</td></tr>
    <tr><td>Tanggal Masuk</td><td>: {{permohonan.tanggal_masuk}}</td></tr>
  </table>
  <p>Uraian: {{permohonan.deskripsi}}</p>
  <p>Dengan ini dinyatakan bahwa permohonan tersebut telah selesai diproses dan
  dokumen ini diterbitkan sebagai output resmi atas layanan ${judulLayanan}.</p>
  <br/><br/>
  <p>Verifikasi keaslian dokumen dapat dilakukan melalui:<br/>
  {{sistem.qr_verifikasi_url}}</p>
</div>
`.trim();
}
