# Reproducibility Manifest

State yang **tidak** disimpan di git (jadi tidak ikut GitHub sync). Wajib direplikasi manual saat men-deploy ke project Lovable baru.

## 1. Secrets (nama saja — nilai jangan pernah di-commit)

| Nama                          | Sumber / cara isi                                          |
| ----------------------------- | ---------------------------------------------------------- |
| `LOVABLE_API_KEY`             | Otomatis dibuat oleh Lovable Cloud saat project baru.      |
| `SUPABASE_URL`                | Otomatis di-inject Lovable Cloud.                          |
| `SUPABASE_PUBLISHABLE_KEY`    | Otomatis di-inject Lovable Cloud.                          |
| `SUPABASE_SERVICE_ROLE_KEY`   | Otomatis di-inject Lovable Cloud (tidak dapat diakses user pada Cloud). |
| `SUPABASE_DB_URL`             | Otomatis di-inject Lovable Cloud.                          |

Tidak ada secret custom / third-party pada project ini. Semua secret di atas dikelola Lovable Cloud.

## 2. Storage buckets (private, semua non-public)

Bucket **tidak bisa dibuat via SQL migration** di Lovable Cloud (SQL diblokir). Harus dibuat via tool `supabase--storage_create_bucket` atau UI Cloud. RLS policies-nya sudah ada di migrations (`20260611021318…`, `20260612002943…`, dst.), jadi setelah bucket dibuat langsung siap dipakai.

Daftar bucket:

1. `berkas-permohonan`
2. `form-submissions`
3. `aset-foto`
4. `share-files`
5. `signed-documents`
6. `signatures`
7. `branding`
8. `pejabat-foto`

Semua `public=false`.

## 3. Database migrations

Semua schema, RPC, RLS, GRANT terdefinisi di `supabase/migrations/*.sql` — akan dijalankan otomatis oleh Lovable Cloud pada project baru.

Total migration file: dapat dilihat di `supabase/migrations/`. Terakhir per audit: `20260713085006_d58f297c-…_jabatan_rbac.sql`.

Objek yang perlu ada setelah migration selesai (spot-check):
- **Tabel utama:** `profiles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`, `jabatan_permissions`, `master_jabatan`, `permohonan`, `layanan_publik`, `forms`, `form_fields`, `form_submissions`, `workflows`, `workflow_versions`, `documents`, `document_templates`, `digital_signatures`, `signature_requests`, `aset`, dst. (lihat `supabase-tables` di context untuk daftar lengkap 100+ tabel).
- **Fungsi kunci:** `has_role`, `has_permission`, `get_effective_permissions`, `get_user_opd`, `fn_generate_nomor_surat`, `fn_doc_next_number`, `executive_summary`, `governance_summary`, `production_health_score`.
- **Trigger:** `protect_system_jabatan` pada `master_jabatan`.

## 4. Cron / public webhook endpoints

Endpoint publik ada di `src/routes/api/public/hooks/*` — otomatis ter-deploy bersama kode:

- `aset-susut-bulanan` — penyusutan aset bulanan.
- `aset-warranty-reminder` — reminder garansi/kalibrasi aset.
- `assignment-reminder` — reminder assignment form.
- `backup-snapshot` — snapshot backup DB.
- `cleanup-uploads` — bersihkan upload orphan.
- `cron-watchdog` — monitor cron sehat.
- `form-deadline-reminder` — reminder deadline formulir.
- `retention-cleanup` — cleanup retention policy.
- `retry-queue` — proses queue retry.
- `signature-webhook.$provider` — webhook signature provider.
- `sla-escalation`, `sla-reminder` — SLA management.
- `storage-cleanup` — bersihkan storage tak terpakai.
- `stuck-jobs` — recover job macet.
- `upload-integrity` — validasi integritas upload.
- `workflow-sla-scan` — scan SLA workflow.

**Semua endpoint memakai prefix `/api/public/`** → bypass auth di published site. Verifikasi keamanan sudah ada di handler masing-masing.

**Schedule cron:** harus dikonfigurasi di project tujuan (via `pg_cron` atau external scheduler). URL stabil untuk cron:

```
https://project--<project-id>.lovable.app/api/public/hooks/<name>
```

Tidak ada file konfigurasi cron di repo — jadwal disimpan di sisi Cloud / pg_cron scheduler.

## 5. Auth providers

- **Email/password** — aktif (default Supabase).
- **Google OAuth** — perlu dikonfigurasi manual di Lovable Cloud → Auth untuk project baru.

## 6. Feature flags & seed data

- Tabel `feature_flags`, `permissions`, `role_permissions`, `jabatan_permissions` sudah di-seed oleh migrations.
- Tabel referensi lain (mis. `opd`, `desa`, `pejabat`, `layanan_publik`, `kategori_layanan`) **kosong** di project baru — perlu diisi oleh admin sesuai wilayah.

## 7. Connectors

Tidak ada connector Lovable pihak ketiga yang di-link ke project ini.
