
## Tujuan

Menambahkan alur "Bukti Permohonan" end-to-end:

1. Setiap permohonan punya **PDF bukti permohonan** dengan **QR code** yang bisa diunduh pemohon di halaman **Permohonan Saya**.
2. **Admin OPD** punya menu baru **Verifikasi Dokumen Permohonan** untuk scan QR (webcam) dan memvalidasi identitas + status permohonan sebelum menyerahkan dokumen fisik.
3. **Super Admin** (grup 1 Pelayanan Publik) punya menu baru **Template Bukti Permohonan** untuk mengelola template global (default) yang dipakai semua layanan bila layanan tersebut belum punya template khusus.

Bukti permohonan berbeda dari "Dokumen Final" yang sudah ada:
- Bukti permohonan: diterbitkan otomatis saat permohonan dibuat, berlaku sebagai tanda bukti pengambilan.
- Dokumen final: dokumen resmi setelah nomor surat terbit (sudah ada, tidak diubah).

---

## Perubahan Database (1 migrasi)

Menambah kolom & tabel pendukung tanpa mengubah tabel yang ada secara destruktif:

- `public.permohonan`:
  - `bukti_token text` (unik, di-generate saat insert/pertama kali diminta)
  - `bukti_path text` (path di bucket `berkas-permohonan`)
  - `bukti_generated_at timestamptz`
  - `bukti_verified_at timestamptz`, `bukti_verified_by uuid`, `bukti_verified_note text`
- `public.app_setting`: baris baru `key = 'bukti_permohonan_template_html'` untuk template global (dikelola super admin).
- Index unik pada `permohonan.bukti_token`.

Tidak ada perubahan pada RLS permohonan (masih via kebijakan lama). Tidak ada tabel baru.

## Server Functions

Baru di `src/lib/bukti-permohonan.functions.ts`:

- `generateBuktiPermohonan({ permohonan_id, site_origin })` — dipanggil pemohon; buat/regenerate PDF (template layanan → template global → fallback), simpan `bukti_path` + `bukti_token`, kembalikan signed URL.
- `getBuktiSignedUrl({ permohonan_id })` — kembalikan signed URL 10 menit (regenerate jika belum ada).
- `verifyBuktiByToken({ token })` — public (tanpa auth) untuk halaman `/v/{token}`; kembalikan status permohonan + identitas pemohon (nama, NIK termasked) + link download bagi admin OPD terkait.
- `adminScanVerifyBukti({ token, note })` — admin OPD/super admin; catat `bukti_verified_at/by/note` + insert baris di `permohonan_riwayat` ("Diverifikasi via QR").

Baru di `src/lib/bukti-template.functions.ts` (super admin):

- `getBuktiTemplate()` — baca `app_setting`.
- `saveBuktiTemplate({ html })` — tulis `app_setting` (RBAC super_admin/admin_pemda).

Template menggunakan engine `mergeTemplate` yang sudah ada (`{{pemohon.nama}}`, `{{permohonan.kode}}`, `{{verify_url}}`, dll).

## UI

**Pemohon — `src/routes/permohonan.index.tsx` & `permohonan.$id.tsx`:**
- Tambah tombol **"Unduh Bukti Permohonan"** di setiap kartu permohonan di daftar dan di halaman detail. Klik → panggil `generateBuktiPermohonan` → buka PDF di tab baru.

**Admin OPD — route baru `src/routes/_authenticated/admin.verifikasi-bukti.tsx`:**
- Halaman scanner QR (pakai komponen `QrScanner` yang sudah ada di `src/components/asn/QrScanner.tsx`).
- Setelah scan: tampilkan detail permohonan (kode, judul, pemohon, status, tanggal), tombol **"Tandai Diverifikasi"** dengan input catatan opsional.
- Manual input token sebagai fallback.
- Tambahkan link menu di `AdminShell` grup Pelayanan Publik.

**Super Admin — route baru `src/routes/_authenticated/admin.bukti-template.tsx`:**
- Editor HTML (textarea + preview) untuk template global.
- Daftar placeholder yang tersedia (dari `permohonan-catalog`).
- Tambahkan link menu di `AdminShell` grup 1 Pelayanan Publik.

**Verifikasi publik — perluas `src/routes/verify.$token.tsx` (atau tambah cabang di `verifyByToken`)** agar juga mengenali bukti permohonan (bukan hanya dokumen final).

## Storage

Menggunakan bucket **`berkas-permohonan`** yang sudah ada. Path: `bukti/{permohonan_id}/{token}.pdf`. Kebijakan RLS existing sudah mengizinkan pemohon & admin OPD terkait.

## Alur

```text
Pemohon buat permohonan
  → klik "Unduh Bukti Permohonan"
  → PDF berisi QR (URL /v/{token}) diunduh
Pemohon datang ke OPD dengan cetakan
  → Admin OPD buka "Verifikasi Bukti" → scan QR
  → Sistem cek token → tampil detail
  → Admin klik "Tandai Diverifikasi" (+ catatan)
  → permohonan.bukti_verified_at terisi + riwayat tercatat
```

## Detail Teknis

- PDF dibuat dengan `pdf-lib` + `qrcode` (sudah dipakai `dokumen-final.functions.ts`); refactor helper `htmlToPlainBlocks` & pembangunan QR ke util bersama `src/features/documents/services/pdf-render.service.ts` agar dipakai kedua fungsi.
- Prioritas template: `layanan_publik.document_template_id` (existing) → `app_setting.bukti_permohonan_template_html` (baru) → fallback layout default.
- `verifyByToken` di `dsig.functions.ts` diperluas: setelah cek `signed_documents` dan `dokumen_verifikasi`, cek juga `permohonan.bukti_token`.
- Route menu super admin ditempatkan di grup Pelayanan Publik pada `AdminShell` (bersama Layanan, Permohonan, Kategori).

## Verifikasi

- Buat permohonan dummy → unduh bukti → cek PDF valid & QR bisa dipindai.
- Buka `/v/{token}` sebagai anonim → detail permohonan tampil.
- Login sebagai admin OPD → scan QR → tandai diverifikasi → cek kolom `bukti_verified_at` terisi & riwayat muncul.
- Super admin edit template global → generate ulang bukti untuk layanan tanpa template → isi PDF mengikuti template global.
