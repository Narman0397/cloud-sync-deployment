
# Impor Template dari File Word (.docx)

Fitur baru di Document Center: admin upload file `.docx` yang sudah ada, sistem otomatis mendeteksi baris seperti `Nama : ___` dan menggantinya jadi placeholder `{{submission.nama}}`. Layout Word asli dipertahankan.

## Alur Pengguna

1. Halaman **Template** → tombol baru **"Impor dari Word"** (di samping "Template Baru").
2. Upload `.docx` (maks 10 MB) → sistem simpan file asli ke storage.
3. Sistem parsing dokumen dan menampilkan **daftar saran pemetaan otomatis**:
   ```
   Baris ditemukan               Placeholder yang disarankan
   ─────────────────────────    ──────────────────────────────
   Nama       : Budi Santoso  →  {{submission.nama}}      [✓]
   NIP        : 19800101...   →  {{submission.nip}}       [✓]
   Jabatan    : Kepala Seksi  →  {{submission.jabatan}}   [✓]
   OPD        : Dinas Kominfo →  {{submission.opd}}       [✓]
   Tanggal    : 08/07/2026    →  {{system.tanggal}}       [✓]
   ```
4. Admin bisa uncheck saran yang tidak diinginkan, lalu **"Simpan sebagai Template"**.
5. Template tersimpan dengan status `draft`, siap dipakai untuk generate dokumen.
6. Saat generate: engine mengganti token `{{...}}` di dalam `.docx` dengan data submission — hasilnya file Word dengan format/tabel/header sama persis dengan aslinya.

## Detail Teknis

### Library
- **`docxtemplater`** + **`pizzip`** — mengganti token di dalam file `.docx` tanpa merusak layout. Pure JS, Worker-safe, standar industri untuk template Word.
- **`mammoth`** — hanya dipakai server-side untuk mengekstrak teks polos guna deteksi pola label (bukan untuk render).

### File Baru
- `src/features/documents/import/word-parse.functions.ts` — server fn: terima `.docx` (base64), ekstrak teks via `mammoth`, jalankan regex `/^\s*(nama|nip|jabatan|opd|instansi|tanggal|nomor\s*surat)\s*[:\-]\s*(.+)$/gim`, kembalikan array saran `{ label, matchedText, suggestedToken }`.
- `src/features/documents/import/word-apply.functions.ts` — server fn: terima file + mapping yang dikonfirmasi, replace teks nilai dengan token `{{...}}` di dalam `.docx` (via docxtemplater raw XML replace), simpan file baru ke bucket `document-templates`, insert row ke `document_templates` (kolom baru `source_file_path` menunjuk file `.docx` bertoken).
- `src/features/documents/import/WordImportDialog.tsx` — UI upload + tabel konfirmasi saran.
- `src/features/documents/import/label-catalog.ts` — kamus label→placeholder (bisa diperluas nanti).

### Perubahan
- `src/routes/_authenticated/admin.document-center.templates.tsx` — tambah tombol "Impor dari Word", buka dialog.
- `src/features/documents/services/document-generator.service.ts` — bila template punya `source_file_path` (`.docx`), gunakan docxtemplater untuk render; jika tidak, tetap pakai jalur HTML lama.
- Migrasi: tambah kolom `source_file_path text` dan `source_type text default 'html'` di `document_templates`.
- Bucket storage baru `document-templates` (private) untuk menyimpan file `.docx` sumber.

### Kamus Label Awal
```
nama, nama lengkap, nama pemohon  → submission.nama
nip                                → submission.nip
jabatan                            → submission.jabatan
opd, instansi, unit kerja          → submission.opd
tanggal, tgl, tanggal pengajuan    → system.tanggal
nomor surat, no. surat             → document.nomor_surat
```

## Batasan
- Hanya `.docx` (bukan `.doc` lama). Untuk `.doc`, user save-as `.docx` dulu.
- Deteksi otomatis bekerja untuk pola `Label : Value` di paragraf/tabel. Format lebih rumit bisa ditambahkan mapping manual di iterasi berikutnya.

## Tidak Berubah
- Katalog placeholder (`PLACEHOLDER_CATALOG`) dan engine (`mergeTemplate`) tetap dipakai untuk template berbasis HTML lama.
- RBAC & auth (`requireSupabaseAuth`) — server fn baru pakai middleware yang sudah ada.

Setelah plan disetujui, saya lanjut implementasi mulai dari migrasi + bucket, lalu server fn, terakhir UI.
