
## Masalah

Aplikasi memanggil beberapa Cloud Storage bucket, tapi tidak ada satu pun bucket yang dibuat di backend. Semua fitur upload/download otomatis melempar "Bucket not found":

- Upload berkas permohonan warga (`berkas-permohonan`)
- Upload berkas form dinamis (`form-submissions`)
- Terbitkan dokumen final PDF (`berkas-permohonan`)
- Upload foto aset (`aset-foto`)
- Ekspor share files dataset/form/kinerja (`share-files`)
- Dokumen hasil tanda tangan digital (`signed-documents`)
- Simpan specimen tanda tangan (`signatures`)
- Upload logo/branding situs (`branding`)
- Upload foto pejabat (`pejabat-foto`)

## Perbaikan

Buat semua bucket sekaligus lewat satu migration, dengan pemisahan yang tepat antara bucket publik dan privat, plus policy akses yang aman:

| Bucket | Publik? | Siapa boleh baca | Siapa boleh tulis |
|---|---|---|---|
| `branding` | Ya | Semua (situs publik butuh logo) | Super admin & admin pemda |
| `pejabat-foto` | Ya | Semua (ditampilkan publik) | Super admin & admin pemda/OPD |
| `berkas-permohonan` | Tidak | Pemohon terkait + admin OPD tujuan + super admin | Pemohon terkait + admin OPD tujuan |
| `form-submissions` | Tidak | Pemilik submission + admin OPD pemilik form + super admin | Pemilik submission + admin OPD pemilik form |
| `aset-foto` | Tidak | Admin OPD pemilik aset + super admin | Admin OPD pemilik aset + super admin |
| `share-files` | Tidak | Admin OPD terkait + super admin (diakses via signed URL) | Sistem (service role) via server function |
| `signed-documents` | Tidak | Pemohon terkait + admin OPD + super admin (via signed URL) | Sistem tanda tangan (service role) |
| `signatures` | Tidak | Pemilik specimen + super admin | Pemilik specimen |

Batas ukuran file default 25 MB/berkas untuk bucket upload user, 50 MB untuk `signed-documents` dan `share-files`. MIME diizinkan sesuai kebutuhan tiap bucket (gambar untuk foto, PDF/Office untuk berkas, dsb.).

## Detail teknis

1. Satu file migration baru berisi:
   - `INSERT INTO storage.buckets (...) ON CONFLICT DO NOTHING` untuk 9 bucket di atas (set `public`, `file_size_limit`, `allowed_mime_types`).
   - `CREATE POLICY` per bucket di `storage.objects` untuk SELECT/INSERT/UPDATE/DELETE. Policy memakai konvensi path yang sudah dipakai kode:
     - `berkas-permohonan/{permohonan_id}/…` → cek kepemilikan lewat `public.permohonan` (pemohon_id / opd_id + `has_role`).
     - `form-submissions/{form_id}/{user_id}/…` → cek `auth.uid()` sama dengan segmen kedua atau admin OPD pemilik form.
     - `aset-foto/{opd_id}/…` → cek `get_user_opd(auth.uid())` atau `super_admin`.
     - `signatures/{user_id}/…` → cek `auth.uid()` sama dengan segmen pertama.
     - `pejabat-foto`, `branding` → SELECT publik, tulis untuk role admin.
     - `share-files`, `signed-documents` → hanya service role yang menulis; baca lewat signed URL (tak butuh policy SELECT untuk anon karena signed URL bypass RLS).
2. Tidak menyentuh file client — semua panggilan `supabase.storage.from(...)` sudah menargetkan nama bucket yang benar; hanya bucket-nya yang belum ada.
3. Setelah migration disetujui, uji cepat:
   - Buka Admin → Branding: unggah logo (bucket `branding`).
   - Buka Admin → Pejabat: unggah foto (bucket `pejabat-foto`).
   - Ajukan permohonan baru dengan lampiran (bucket `berkas-permohonan`).
   - Terbitkan dokumen final (bucket `berkas-permohonan` via server fn).

## Yang TIDAK diubah

- Skema tabel aplikasi, RLS tabel non-storage, fungsi RPC, dan kode UI tetap seperti sekarang.
- Tidak menambah bucket baru di luar yang sudah dipakai kode.
