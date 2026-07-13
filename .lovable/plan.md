# Perbaikan RBAC — Permission tidak muncul di panel user

## Temuan (hasil audit DB + kode)

1. **Tabel `public.permissions` KOSONG (0 baris).**
   `rbacGetUser` mengembalikan `catalog: []` → panel tab "Permission" tidak
   menampilkan satu pun row. Ini yang terlihat pada screenshot (hanya header
   + kalimat hint, tanpa daftar permission).
2. **Tabel `role_permissions` TIDAK ADA.**
   Padahal UI berkata "hijau = aktif lewat role". Tidak ada mapping
   role → permission apa pun di database, jadi user manapun akan selalu
   menunjukkan "0 aktif" kecuali diberi override manual.
3. **`get_effective_permissions(_user_id)` hanya membaca `user_permissions`.**
   Fungsi ini mengabaikan role default → walau kita seed `role_permissions`,
   effective tetap 0 sampai fungsinya diperbaiki.
4. **Konsekuensi**: Semua hook `useCan` / `usePermissions` di aplikasi
   mengembalikan set kosong untuk non-super-admin (super admin di-bypass di
   `useCan`), sehingga gating fitur untuk admin_opd / admin_desa / asn tidak
   pernah aktif dan admin melihat panel permission kosong.

Kode server-function (`rbacGetUser`, override, audit) sudah benar; tidak ada
perubahan diperlukan di sisi TypeScript/UI.

## Perubahan

### 1 migration SQL

- **Seed `public.permissions`** dari daftar `PERMISSIONS` di
  `src/features/rbac/constants.ts` (label + kategori + deskripsi ringkas).
  Pakai `INSERT ... ON CONFLICT (code) DO UPDATE` supaya idempotent dan bisa
  dijalankan ulang saat ada permission baru.
  Kategori:
  - Formulir (`can_*_form`, `can_manage_forms`, `can_assign_form`)
  - Verifikasi (`can_verify_*`, `can_approve_*`, `can_reject_*`, `can_request_revision`)
  - Dokumen (`can_*_document`, `can_request_document`)
  - Administrasi (`can_manage_users/opd/roles`, `can_view_audit_logs`, `can_export_data`, `can_approve_registration`)
  - Data (`can_request_data`, `can_approve_data_request`)
  - Pemda (`pemda.*`, `view_all_*`, `view_kabupaten_dashboard`, `view_cross_opd_analytics`)
  - Eksekutif (`executive.*`, `view_executive_dashboard`)

- **Buat tabel `public.role_permissions`**:
  `(role app_role, permission_code text references permissions(code) on delete cascade, primary key (role, permission_code))`.
  GRANT SELECT ke `authenticated`, ALL ke `service_role`; RLS on; policy
  SELECT untuk authenticated, manage hanya super_admin (`has_role`).

- **Seed default `role_permissions`**:
  - `admin_pemda`: seluruh `pemda.*`, `view_all_*`, `view_kabupaten_dashboard`, `view_cross_opd_analytics`, `can_manage_users`, `can_manage_opd`, `can_manage_roles`, `can_view_audit_logs`, `can_export_data`, `can_approve_registration`.
  - `pimpinan`: `executive.view`, `view_executive_dashboard`, `view_kabupaten_dashboard`, seluruh `view_all_*`.
  - `admin_opd`: `can_create_form`, `can_edit_form`, `can_publish_form`, `can_assign_form`, `can_manage_forms`, `can_verify_submission`, `can_approve_submission`, `can_reject_submission`, `can_request_revision`, `can_view_sensitive_document`, `can_download_document`, `can_share_document`, `can_approve_data_request`, `can_export_data`.
  - `admin_desa`: `can_verify_submission`, `can_request_revision`, `can_download_document`, `can_request_document`.
  - `admin_bkpsdm`: `can_manage_users`, `can_approve_registration`, `can_view_audit_logs`, `can_export_data`.
  - `kepala_bkpsdm`: `view_all_performance`, `view_all_attendance`, `can_view_audit_logs`.
  - `asn`: `can_download_document`, `can_request_document`.
  - `warga`: (kosong — pemohon publik).
  Idempotent via `ON CONFLICT DO NOTHING`.

- **Rewrite `get_effective_permissions(_user_id uuid)`** menjadi:
  ```sql
  WITH role_perms AS (
    SELECT rp.permission_code
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
  ),
  overrides AS (
    SELECT permission_code, granted
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ),
  merged AS (
    SELECT permission_code FROM role_perms
    WHERE permission_code NOT IN (SELECT permission_code FROM overrides WHERE granted = false)
    UNION
    SELECT permission_code FROM overrides WHERE granted = true
  )
  SELECT COALESCE(array_agg(permission_code), ARRAY[]::text[]) FROM merged;
  ```
  Deny override menang atas role default; grant override menambah.

- Update `has_permission(_user_id, _permission_code)` supaya konsisten
  memakai logika yang sama (cek keanggotaan pada hasil `get_effective_permissions`).

### Tidak ada perubahan kode aplikasi

`UserRbacPanel.tsx`, `admin.functions.ts`, `hooks.ts` sudah benar; setelah
katalog terisi dan fungsi effective diperbaiki, panel akan otomatis
menampilkan daftar permission per kategori dengan indikator "hijau = aktif
lewat role" untuk semua user berdasarkan role mereka.

## Verifikasi setelah apply

1. Buka Admin → Manajemen User → expand user Admin Desa → tab Permission:
   harus muncul daftar permission per kategori dengan `can_verify_submission`,
   `can_request_revision`, `can_download_document`, `can_request_document`
   bertanda hijau (aktif lewat role).
2. Grant override sebuah permission → tampil badge GRANT + hijau; Deny →
   badge DENY + abu. Hapus override → kembali ke default role.
3. Untuk user Warga: daftar tampil, semua abu-abu (tidak ada default).
