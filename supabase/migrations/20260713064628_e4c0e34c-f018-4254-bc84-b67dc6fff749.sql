
INSERT INTO public.permissions (code, label, kategori, description) VALUES
  ('can_create_form','Buat Formulir','Formulir','Membuat form baru'),
  ('can_edit_form','Ubah Formulir','Formulir','Mengubah form yang ada'),
  ('can_publish_form','Publikasikan Formulir','Formulir','Menerbitkan form ke publik / target'),
  ('can_assign_form','Assign Formulir','Formulir','Menetapkan form ke user/OPD/desa'),
  ('can_manage_forms','Kelola Formulir','Formulir','Kelola penuh siklus form'),
  ('can_verify_submission','Verifikasi Submission','Verifikasi','Melakukan verifikasi pengajuan'),
  ('can_approve_submission','Setujui Submission','Verifikasi','Menyetujui pengajuan'),
  ('can_reject_submission','Tolak Submission','Verifikasi','Menolak pengajuan'),
  ('can_request_revision','Minta Revisi','Verifikasi','Meminta revisi pengajuan'),
  ('can_view_sensitive_document','Lihat Dokumen Sensitif','Dokumen','Membuka dokumen berklasifikasi'),
  ('can_download_document','Unduh Dokumen','Dokumen','Mengunduh dokumen'),
  ('can_share_document','Bagikan Dokumen','Dokumen','Membagikan dokumen ke pihak lain'),
  ('can_request_document','Ajukan Dokumen','Dokumen','Mengajukan permintaan dokumen'),
  ('can_manage_users','Kelola User','Administrasi','Kelola akun pengguna'),
  ('can_manage_opd','Kelola OPD','Administrasi','Kelola master OPD'),
  ('can_manage_roles','Kelola Role','Administrasi','Kelola pemberian role'),
  ('can_view_audit_logs','Lihat Audit Log','Administrasi','Melihat log audit sistem'),
  ('can_export_data','Ekspor Data','Administrasi','Mengekspor data ke file'),
  ('can_approve_registration','Setujui Registrasi','Administrasi','Menyetujui pendaftaran akun baru'),
  ('can_request_data','Ajukan Permintaan Data','Data','Mengajukan permintaan dataset'),
  ('can_approve_data_request','Setujui Permintaan Data','Data','Menyetujui permintaan dataset'),
  ('view_all_opd','Lihat Semua OPD','Pemda','Melihat data lintas OPD'),
  ('view_all_submissions','Lihat Semua Submission','Pemda','Melihat submission lintas OPD'),
  ('view_all_attendance','Lihat Semua Absensi','Pemda','Melihat absensi lintas OPD'),
  ('view_all_assets','Lihat Semua Aset','Pemda','Melihat aset lintas OPD'),
  ('view_all_datasets','Lihat Semua Dataset','Pemda','Melihat dataset lintas OPD'),
  ('view_all_reports','Lihat Semua Laporan','Pemda','Melihat laporan lintas OPD'),
  ('view_all_performance','Lihat Semua Kinerja','Pemda','Melihat kinerja lintas OPD'),
  ('view_all_surveys','Lihat Semua Survei','Pemda','Melihat survei lintas OPD'),
  ('view_kabupaten_dashboard','Dashboard Kabupaten','Pemda','Akses dashboard kabupaten'),
  ('view_cross_opd_analytics','Analitik Lintas OPD','Pemda','Akses analitik lintas OPD'),
  ('pemda.view','Pemda: Lihat','Pemda','Akses lihat modul Pemda'),
  ('pemda.manage','Pemda: Kelola','Pemda','Kelola konfigurasi Pemda'),
  ('pemda.monitor','Pemda: Monitor','Pemda','Monitor operasional Pemda'),
  ('executive.view','Eksekutif: Lihat','Eksekutif','Akses dashboard eksekutif'),
  ('executive.approve','Eksekutif: Setujui','Eksekutif','Persetujuan level eksekutif'),
  ('executive.sign','Eksekutif: Tandatangani','Eksekutif','Tanda tangan level eksekutif'),
  ('executive.disposition','Eksekutif: Disposisi','Eksekutif','Membuat disposisi eksekutif'),
  ('view_executive_dashboard','Dashboard Eksekutif','Eksekutif','Akses dashboard eksekutif')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    kategori = EXCLUDED.kategori,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_code)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_read_all" ON public.role_permissions;
CREATE POLICY "role_permissions_read_all"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "role_permissions_manage_super" ON public.role_permissions;
CREATE POLICY "role_permissions_manage_super"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

INSERT INTO public.role_permissions (role, permission_code) VALUES
  ('admin_pemda','pemda.view'),
  ('admin_pemda','pemda.manage'),
  ('admin_pemda','pemda.monitor'),
  ('admin_pemda','view_all_opd'),
  ('admin_pemda','view_all_submissions'),
  ('admin_pemda','view_all_attendance'),
  ('admin_pemda','view_all_assets'),
  ('admin_pemda','view_all_datasets'),
  ('admin_pemda','view_all_reports'),
  ('admin_pemda','view_all_performance'),
  ('admin_pemda','view_all_surveys'),
  ('admin_pemda','view_kabupaten_dashboard'),
  ('admin_pemda','view_cross_opd_analytics'),
  ('admin_pemda','can_manage_users'),
  ('admin_pemda','can_manage_opd'),
  ('admin_pemda','can_manage_roles'),
  ('admin_pemda','can_view_audit_logs'),
  ('admin_pemda','can_export_data'),
  ('admin_pemda','can_approve_registration'),
  ('admin_pemda','executive.view'),
  ('pimpinan','executive.view'),
  ('pimpinan','view_executive_dashboard'),
  ('pimpinan','view_kabupaten_dashboard'),
  ('pimpinan','view_all_opd'),
  ('pimpinan','view_all_submissions'),
  ('pimpinan','view_all_attendance'),
  ('pimpinan','view_all_assets'),
  ('pimpinan','view_all_datasets'),
  ('pimpinan','view_all_reports'),
  ('pimpinan','view_all_performance'),
  ('pimpinan','view_all_surveys'),
  ('admin_opd','can_create_form'),
  ('admin_opd','can_edit_form'),
  ('admin_opd','can_publish_form'),
  ('admin_opd','can_assign_form'),
  ('admin_opd','can_manage_forms'),
  ('admin_opd','can_verify_submission'),
  ('admin_opd','can_approve_submission'),
  ('admin_opd','can_reject_submission'),
  ('admin_opd','can_request_revision'),
  ('admin_opd','can_view_sensitive_document'),
  ('admin_opd','can_download_document'),
  ('admin_opd','can_share_document'),
  ('admin_opd','can_approve_data_request'),
  ('admin_opd','can_export_data'),
  ('admin_desa','can_verify_submission'),
  ('admin_desa','can_request_revision'),
  ('admin_desa','can_download_document'),
  ('admin_desa','can_request_document'),
  ('asn','can_download_document'),
  ('asn','can_request_document')
ON CONFLICT (role, permission_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  denies AS (
    SELECT permission_code FROM overrides WHERE granted = false
  ),
  merged AS (
    SELECT permission_code FROM role_perms
    WHERE permission_code NOT IN (SELECT permission_code FROM denies)
    UNION
    SELECT permission_code FROM overrides WHERE granted = true
  )
  SELECT COALESCE(array_agg(DISTINCT permission_code), ARRAY[]::text[]) FROM merged;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'super_admin'::public.app_role)
      OR _permission_code = ANY (public.get_effective_permissions(_user_id));
$function$;
