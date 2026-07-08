Saya akan lakukan verifikasi E2E dan perbaikan fokus pada tombol **Buka** di daftar Template Document Center.

## Rencana

1. **Reproduksi dari awal**
   - Login memakai sesi superadmin yang tersedia di preview development.
   - Buka `/admin/document-center/templates`.
   - Pastikan daftar template termuat.
   - Klik tombol **Buka** pada salah satu row.
   - Catat hasil: URL berubah/tidak, halaman detail tampil/tidak, error console/network/server function ada/tidak.

2. **Lacak titik gagal**
   - Periksa apakah `<Link>` tombol **Buka** menghasilkan path detail yang benar: `/admin/document-center/templates/:id`.
   - Periksa apakah route detail `admin.document-center.templates.$id` terdaftar dan dirender di dalam layout Document Center.
   - Periksa server function `docGetTemplate`, `docListNumberingRules`, `docListPublishedForms`, dan `docFormFieldsCatalog` yang dipanggil saat halaman detail dibuka.
   - Cocokkan query server function dengan schema database: `document_templates`, `document_template_versions`, `document_numbering_rules`, dan tabel form terkait.

3. **Perbaikan otomatis sesuai akar masalah**
   - Jika klik tidak memicu navigasi: ganti tombol menjadi navigasi imperatif atau perbaiki konfigurasi `Link`/route path.
   - Jika navigasi berhasil tapi halaman detail gagal load: tambahkan penanganan error di halaman detail dan perbaiki query/server function yang gagal.
   - Jika schema tidak cocok: sesuaikan kode dengan schema yang ada atau tambahkan migrasi kecil yang aman bila kolom/tabel memang hilang.
   - Jika masalah hanya muncul di mobile/overflow table: pastikan tombol tetap clickable dan tidak tertutup overlay/elemen lain.

4. **Verifikasi akhir E2E**
   - Ulangi alur dari awal sampai akhir: daftar template → klik **Buka** → editor template tampil → ubah nama/deskripsi → Simpan → Preview → kembali ke daftar.
   - Validasi tidak ada error console/network/server function pada alur tersebut.
   - Ambil bukti visual halaman detail berhasil terbuka dan aksi dasar editor bekerja.