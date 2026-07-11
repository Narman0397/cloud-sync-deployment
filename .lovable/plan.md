
# Sambungkan Document + TTE ke Pelayanan Publik

Tujuan: setiap layanan publik punya satu template dokumen khusus. Ketika admin OPD menerbitkan dokumen final untuk sebuah permohonan, isi dokumen otomatis diambil dari data akun pemohon + input permohonan, dilengkapi QR verifikasi keaslian, dan (opsional) dapat langsung dikirim ke antrean TTE.

## Yang akan dibangun

### 1. Skema — hubungkan template ke layanan
- Tambah kolom `layanan_publik.document_template_id uuid references document_templates(id)`.
- Tambah kolom opsional `layanan_publik.tte_required boolean default false` dan `tte_signer_role text` (kepala_opd / kabid / staf) untuk auto-request TTE.
- Tidak mengubah struktur `document_templates` — cukup dipakai apa adanya (sudah menyimpan `template_html`, `variables`, dsb).

### 2. Katalog placeholder khusus permohonan
Buat file `src/features/documents/placeholder/permohonan-catalog.ts` berisi variabel siap pakai untuk editor template layanan:
- `{{pemohon.nama}}`, `{{pemohon.nik}}`, `{{pemohon.no_hp}}`, `{{pemohon.email}}`, `{{pemohon.alamat}}`, `{{pemohon.desa}}`
- `{{permohonan.kode}}`, `{{permohonan.judul}}`, `{{permohonan.kategori}}`, `{{permohonan.deskripsi}}`, `{{permohonan.tanggal_masuk}}`, `{{permohonan.nomor_surat}}`
- `{{atas_nama.nama}}`, `{{atas_nama.nik}}`, `{{atas_nama.hp}}` (jika untuk orang lain)
- `{{opd.nama}}`, `{{opd.singkatan}}`, `{{opd.kode_surat}}`
- `{{layanan.judul}}`, `{{layanan.slug}}`, `{{layanan.dasar_hukum}}`, `{{layanan.biaya}}`
- `{{sistem.tanggal_terbit}}`, `{{sistem.qr_verifikasi_url}}`, `{{sistem.hash}}`

### 3. Merge context untuk permohonan
Buat `src/features/documents/services/permohonan-context.service.ts` — fungsi `buildPermohonanContext(supabase, permohonan_id, extra)` yang mengembalikan objek dengan kelompok `pemohon / permohonan / atas_nama / opd / layanan / sistem` (dipakai engine `mergeTemplate` yang sudah ada).

### 4. Generator dokumen final berbasis template
Rombak `src/lib/dokumen-final.functions.ts` → `generateDokumenFinal`:
- Muat `layanan_publik` berdasarkan `permohonan.kategori`/`slug` dan ambil `document_template_id`.
- Jika ada template: `mergeTemplate(template_html, ctx)` lalu render PDF via `generateDocument({ kind: 'pdf', ... })` yang sudah ada di `document-generator.service.ts`.
- Jika tidak ada template: pakai layout default saat ini (fallback, tidak breaking).
- Setelah PDF utama tergenerate, **stempel QR + nomor + hash** di halaman terakhir (menggunakan pdf-lib) — QR = `verify_url` yang sudah dibuat, hash = sha256 dokumen sebelum stempel. Tetap simpan token verifikasi ke `dokumen_verifikasi` (sudah ada).

### 5. Editor template di halaman Layanan admin
Di `src/routes/_authenticated/admin.layanan.tsx` (form edit layanan):
- Tambah section "Template Dokumen Final":
  - Dropdown pilih template dari `document_templates` (filter opd_id user atau shared) — link "Kelola template" ke `/admin/document-center/templates`.
  - Tombol "Buat template dari layanan ini" → membuat template baru berjudul "Surat — {judul layanan}" dengan boilerplate HTML kop OPD + tabel data pemohon + `{{sistem.qr_verifikasi_url}}` placeholder, lalu buka editor.
  - Toggle "Wajib TTE" + pilih peran penandatangan.
- Panel katalog placeholder permohonan (read-only chips, klik untuk copy) — mirip `WordImportDialog`.

### 6. TTE otomatis (opsional per-layanan)
Setelah generator selesai, jika `layanan.tte_required = true`:
- Buat `signature_requests` + `signature_request_signers` (menggunakan modul `src/features/signature/` yang sudah ada) dengan dokumen sumber = path PDF final, penandatangan = user dengan role sesuai `tte_signer_role` pada OPD pemilik.
- Update `PermohonanGovernancePanel` untuk menampilkan status TTE (menunggu / ditandatangani / selesai) + tombol "Kirim ke TTE" manual bila toggle mati.

### 7. UX di halaman warga
`src/routes/permohonan.$id.tsx` (view pemohon): jika `dokumen_final_path` ada + tanda tangan selesai → tombol "Unduh Dokumen Bertanda Tangan" (signed URL, sudah ada endpoint). Bila TTE masih proses, tampilkan badge "Sedang ditandatangani".

## Detail teknis

- Semua akses ditulis via `createServerFn` + `requireSupabaseAuth` mengikuti pola file yang sudah ada; RBAC: super_admin atau admin_opd dari OPD pemilik.
- Migration akan menyertakan `GRANT` biasa (kolom baru, bukan tabel baru — tidak perlu grant tambahan).
- Fallback aman: layanan tanpa template tetap bisa terbitkan dokumen final seperti sebelumnya.
- QR & hash tetap disimpan di tabel `dokumen_verifikasi` dan diverifikasi via route `/v/$token` yang sudah ada.

## File yang akan disentuh

Baru:
- `supabase/migrations/xxxx_layanan_template_tte.sql`
- `src/features/documents/placeholder/permohonan-catalog.ts`
- `src/features/documents/services/permohonan-context.service.ts`

Diubah:
- `src/lib/dokumen-final.functions.ts` (pakai template + stempel QR)
- `src/routes/_authenticated/admin.layanan.tsx` (picker template + toggle TTE)
- `src/components/admin/PermohonanGovernancePanel.tsx` (status TTE + kirim TTE)
- `src/routes/permohonan.$id.tsx` (badge / tombol unduh bertanda tangan)

## Konfirmasi singkat sebelum implementasi

1. Buat template default otomatis untuk semua layanan yang belum punya (boilerplate standar OPD) — ya/tidak?
2. Peran default penandatangan TTE = **Kepala OPD**, oke?
