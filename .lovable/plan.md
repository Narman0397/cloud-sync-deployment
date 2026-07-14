## Tujuan

Memastikan project Lovable (dev) dan repo GitHub `Narman0397/cloud-sync-deployment` identik 100%, dengan Lovable sebagai **single source of truth**. Bila ditemukan divergensi, GitHub akan diselaraskan ke dev. Selain itu menghasilkan panduan reproducible clone-to-new-project.

## Konteks penting

- Lovable memiliki two-way sync otomatis ke GitHub — perubahan di Lovable auto-push. Divergensi umumnya muncul dari: (a) commit langsung di GitHub yang di-merge balik, (b) file yang tidak masuk sync (mis. `.env` lokal), (c) state di luar git (DB schema, storage buckets, secrets, cron, RLS).
- GitHub push dilakukan sistem sync Lovable; agent tidak menjalankan `git push` manual. Setelah edit dev di-approve, sync engine yang menyinkronkan.

## Ruang lingkup

### 1. Audit parity source code (Lovable vs GitHub)
- Fetch tree GitHub via API (`git/trees?recursive=1`) untuk repo `Narman0397/cloud-sync-deployment` (branch default).
- Bandingkan daftar file + SHA (blob hash) terhadap file dev via `git hash-object`.
- Kategorikan divergensi:
  - **A. File ada di dev, tidak ada di GitHub** → harus di-push.
  - **B. File ada di GitHub, tidak ada di dev** → harus dihapus dari GitHub (dev = SoT).
  - **C. File berbeda isi** → overwrite GitHub dengan versi dev.
  - **D. Identik** → skip.
- Hasilkan laporan `.lovable/parity-report.md` (tabel per kategori, ringkas).

### 2. Selaraskan GitHub ke dev
Untuk kategori A/B/C, lakukan "no-op touch" pada file di dev (rewrite identik) untuk memicu sync push, atau — bila ada file khusus (B) — hapus dari dev bila memang seharusnya tidak ada. Bila divergensi menandakan **file GitHub yang bukan hasil Lovable** (drift), instruksikan user untuk mengonfirmasi apakah drift itu disengaja sebelum overwrite.

Catatan: bila repo GitHub jauh tertinggal (banyak commit missing), rekomendasikan user melakukan reconnect GitHub dari Plus (+) → GitHub agar sync engine melakukan full push ulang; ini jauh lebih andal daripada memaksa perubahan file-per-file.

### 3. Verifikasi konfigurasi non-kode
Inventarisasi state yang **tidak** disimpan di git (jadi tidak akan ikut GitHub sync) dan dokumentasikan di `.lovable/reproducibility-manifest.md`:

- **Environment / secrets**: `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` — tercatat sebagai nama saja (nilai tidak diekspos).
- **Migrasi DB**: verifikasi semua file di `supabase/migrations/` berjalan urut & idempoten; cek adakah objek DB (tabel/RPC/fn) yang eksis di database tetapi tidak punya migration di git (schema drift). Bila ada, buat migration `pull-forward` yang meng-recreate objek tersebut (CREATE IF NOT EXISTS / CREATE OR REPLACE).
- **RLS & GRANT**: audit tabel `public.*` — pastikan setiap tabel punya policy & GRANT sesuai standar (authenticated/service_role, anon hanya bila memang publik).
- **Storage buckets**: 8 bucket teridentifikasi (`berkas-permohonan`, `form-submissions`, `aset-foto`, `share-files`, `signed-documents`, `signatures`, `branding`, `pejabat-foto`). Buat migration deklaratif `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING` beserta storage RLS policies-nya agar bucket ter-provision otomatis di project tujuan.
- **Cron / edge functions**: verifikasi semua endpoint `src/routes/api/public/hooks/*` terdokumentasi (URL, schedule, secret yang dibutuhkan) di manifest.
- **DB functions & triggers**: semua fn yang ada di database (mis. `get_effective_permissions`, `has_permission`, `fn_generate_nomor_surat`, dll.) harus ada di migrations. Buat migration konsolidasi bila ada yang hilang.
- **Auth providers**: catat provider yang aktif (Google, dsb.) sebagai bagian dari checklist setup.

### 4. Panduan clone-to-new-project
Tulis `.lovable/CLONE_GUIDE.md` berisi urutan langkah reproducible:

1. Buat project Lovable baru + enable Cloud.
2. Hubungkan GitHub baru & import kode dari `Narman0397/cloud-sync-deployment` (atau remix dari project ini).
3. Jalankan migrations (otomatis oleh Lovable Cloud saat pertama kali).
4. Provisi storage buckets (otomatis dari migration di langkah 3 bila konsolidasi selesai).
5. Konfigurasi secrets (daftar nama + sumber nilai).
6. Aktifkan connectors bila digunakan.
7. Konfigurasi auth providers (Google OAuth, dll).
8. Verifikasi post-setup checklist (login, permission tab, workflow, dsb.).

## Deliverables

```text
.lovable/
  parity-report.md              # hasil diff dev ↔ GitHub
  reproducibility-manifest.md   # inventaris non-kode
  CLONE_GUIDE.md                # panduan langkah demi langkah
supabase/migrations/
  <timestamp>_storage_buckets_bootstrap.sql   # bila belum ada
  <timestamp>_schema_drift_pullforward.sql    # bila terdeteksi drift
```

## Yang TIDAK termasuk

- Tidak mengubah logika aplikasi / fitur.
- Tidak menyentuh nilai secrets (hanya nama).
- Tidak menjalankan `git push` manual — mengandalkan sync engine Lovable.
- Tidak menyalin data (rows) production; hanya schema + config.

## Risiko & catatan

- Bila terdapat commit di GitHub yang **belum** kembali ke dev (mis. edit lokal developer), memaksa dev sebagai SoT akan **menghapus** commit tersebut. Akan dikonfirmasi ulang sebelum overwrite bila terdeteksi.
- Repo GitHub adalah repo publik/eksternal (bukan Lovable project lain), jadi diff dilakukan via GitHub REST API, bukan `cross_project` tools.

## Teknis singkat

- Fetch: `GET https://api.github.com/repos/Narman0397/cloud-sync-deployment/git/trees/<default-branch>?recursive=1` (public, no auth needed untuk repo publik; jika private, minta PAT via `add_secret`).
- SHA compare: GitHub `blob.sha` = `git hash-object` dari file — bisa dihitung lokal dengan `git hash-object <file>` untuk tiap file dev, lalu bandingkan set.
- Schema drift: `SELECT ... FROM pg_proc / pg_class WHERE ...` vs parsing file di `supabase/migrations/`.
