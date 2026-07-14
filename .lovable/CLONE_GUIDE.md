# Panduan Clone Project

Langkah reproducible untuk mendapatkan hasil **100% identik** di project Lovable baru.

## Prasyarat

- Akun Lovable dengan Lovable Cloud aktif.
- (Opsional) Akun GitHub untuk sync kode.

## Langkah

### 1. Buat project baru

Cara termudah: **Remix** dari project ini (jika public remixing di-enable). Alternatif: buat project Lovable kosong lalu import dari GitHub.

### 2. Enable Lovable Cloud

Buka tab **Cloud** → **Enable**. Otomatis membuat: database Postgres, auth, storage, edge runtime, dan meng-inject 5 secret Cloud (`LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`).

### 3. Sinkronkan kode

**Cara A — Remix:** kode otomatis tersalin.

**Cara B — Import dari GitHub:**
1. Buat project Lovable kosong.
2. Plus (+) → GitHub → Connect project → pilih repo `Narman0397/cloud-sync-deployment`.
3. Tarik/copy seluruh isi ke project baru.

### 4. Jalankan migrations

Semua file `supabase/migrations/*.sql` dijalankan otomatis oleh Lovable Cloud saat kode pertama kali di-push. Verifikasi via Cloud → Database bahwa 100+ tabel dan seluruh RPC (`has_permission`, `get_effective_permissions`, dll.) sudah ada.

### 5. Provisi storage buckets (WAJIB — tidak otomatis dari migration)

Buat 8 bucket berikut sebagai **private** (`public = false`):

1. `berkas-permohonan`
2. `form-submissions`
3. `aset-foto`
4. `share-files`
5. `signed-documents`
6. `signatures`
7. `branding`
8. `pejabat-foto`

Cara: minta agent Lovable menjalankan `supabase--storage_create_bucket` untuk masing-masing, atau buat manual via UI Cloud → Storage.

RLS policies untuk `storage.objects` sudah di-set oleh migrations, langsung berlaku setelah bucket dibuat.

### 6. Konfigurasi auth providers

- Email/password: aktif otomatis.
- Google OAuth: Cloud → Auth → Providers → aktifkan Google. Wajib bila fitur "Sign in with Google" digunakan.

### 7. Seed data referensi

Tabel berikut kosong pada project baru — isi via UI admin atau import CSV:

- `opd` — daftar Organisasi Perangkat Daerah.
- `desa` — daftar desa/kelurahan.
- `pejabat` — pejabat aktif.
- `layanan_publik`, `kategori_layanan` — katalog layanan publik.

Katalog RBAC (`permissions`, `role_permissions`, `jabatan_permissions`) & jabatan sistem sudah di-seed otomatis oleh migrations.

### 8. Konfigurasi cron (opsional)

Endpoint webhook publik ada di `src/routes/api/public/hooks/*`. Konfigurasi jadwal via `pg_cron` atau scheduler eksternal, memanggil:

```
https://project--<project-id>.lovable.app/api/public/hooks/<name>
```

Daftar endpoint & fungsinya: lihat `reproducibility-manifest.md` §4.

### 9. Post-setup verification

Checklist:

- [ ] Login email/password bekerja.
- [ ] Signup + verifikasi profile bekerja.
- [ ] Super admin punya akses penuh (Dashboard → Manajemen User → Permission tab menampilkan 39 permission dengan kategori Formulir/Verifikasi/Dokumen/Administrasi/Data/Pemda/Eksekutif).
- [ ] Master Jabatan menampilkan jabatan sistem + tombol RBAC (shield) berfungsi.
- [ ] Upload file di formulir sukses (validasi storage bucket).
- [ ] Workflow builder & form builder dapat menyimpan draft.
- [ ] Halaman publik `/`, `/layanan`, `/data-terbuka`, `/berita` ter-render tanpa error.
- [ ] Verifikasi dokumen `/verify/<token>` bekerja.

### 10. Publish

Klik **Publish** untuk deploy ke `<slug>.lovable.app`. Custom domain via Project Settings → Domains.

## Referensi

- `parity-report.md` — bukti bahwa dev & GitHub sudah paritas.
- `reproducibility-manifest.md` — inventaris state non-kode.
