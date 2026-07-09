
# Dokumen PDF: Peta Integrasi Template Document Center

Membuat satu file PDF (`/mnt/documents/Peta-Integrasi-Template-DocumentCenter.pdf`) yang menjelaskan tiga hal yang Anda tanyakan. Output bersifat dokumentasi (bukan perubahan kode aplikasi).

## Isi PDF (± 6–8 halaman)

### Bagian 1 — Hubungan Template Publish dengan Modul Lain
Untuk setiap modul, dijelaskan: *siapa yang memicu (role)* → *template apa yang dipakai* → *dokumen keluaran* → *alur TTE*.

- **Pelayanan Publik** (Warga, Petugas Loket, Verifikator OPD, Kepala OPD)
  - Permohonan layanan → template Surat Keterangan / SK / Rekomendasi → antrian TTD → dokumen final + QR verifikasi publik (`/verify/:token`).
- **Kinerja OPD** (Admin OPD, Kepala OPD, Eksekutif)
  - Template Laporan Kinerja / Rekap Bulanan yang menarik data dari dashboard-overview & indikator.
- **Berbagi Data / Data Terbuka** (Admin Data, Wali Data OPD)
  - Template Berita Acara Serah Terima Data, MoU Pertukaran Data.
- **Manajemen ASN** (Admin Kepegawaian, ASN/PNS, Kepala OPD)
  - Template SK Kenaikan Pangkat, Cuti, Tugas Belajar, Mutasi — placeholder `submission.nama`, `submission.nip`, `submission.jabatan` otomatis dari profil ASN.
- **Manajemen Aset** (Admin Aset, Bendahara Barang, Kepala OPD)
  - Template Berita Acara Serah Terima Aset, Penghapusan Aset, Peminjaman.

Disertai **matriks role × modul × jenis template** dalam bentuk tabel, dan **diagram alur** template → submission → generator → TTD → arsip.

### Bagian 2 — Perbedaan Template (Document Center) vs Form Builder
Tabel perbandingan singkat:

| Aspek | Template Document Center | Form Builder |
|---|---|---|
| Tujuan | Menghasilkan **dokumen resmi** (surat/SK/berita acara) | Mengumpulkan **data/input** dari pemohon |
| Output | File PDF/DOCX ber-TTE + QR | Baris data submission untuk diproses workflow |
| Isi | HTML/Word + placeholder `{{...}}` | Field (text, select, upload, dsb.) + validasi |
| Pemakai akhir | Pejabat penandatangan & penerima dokumen | Warga / ASN yang mengajukan |
| Alur setelahnya | Antrian TTD → arsip → verifikasi publik | Review → approval → (opsional) generate dokumen dari template |
| Relasi | **Menerima data** dari submission Form Builder | **Menyediakan data** untuk template |

Ditutup dengan diagram: *Form Builder (input) → Submission → Template Document Center (output)*.

### Bagian 3 — Identifikasi Keunikan Berkas yang Diunggah
Audit fitur yang sudah ada di sistem, dengan status jelas:

- **Sudah ada**:
  - Hash SHA-256 pada dokumen final (di `hash.service.ts`).
  - QR verifikasi publik pada dokumen bertanda tangan (`qr.service.ts`, route `/verify/:token`, `/v/:token`).
  - Audit trail per dokumen (`document-audit.service.ts`).
- **Belum ada / rekomendasi**:
  - Hash + QR untuk **berkas lampiran unggahan** (misal scan ijazah yang diupload PNS di Form Builder) — saat ini file upload belum diberi identitas unik yang dapat diverifikasi publik.
  - Rekomendasi implementasi: hash SHA-256 saat upload → simpan di kolom `file_hash` → generate QR watermark opsional untuk berkas yang di-*preview* / diunduh ulang, plus halaman verifikasi `/verify-upload/:hash`.

## Cara Pembuatan
- Script Python (`reportlab`) untuk generate PDF dengan tabel & diagram sederhana (kotak + panah ASCII/shape).
- Palet warna mengikuti kesan Document Center (biru gelap + aksen).
- QA: render ke JPG per halaman, cek overlap/overflow, perbaiki, baru serahkan.

## Deliverable
- `/mnt/documents/Peta-Integrasi-Template-DocumentCenter.pdf` (final)
- Ditampilkan lewat `<presentation-artifact>` agar bisa langsung diunduh.

Tidak ada perubahan kode aplikasi pada langkah ini.
