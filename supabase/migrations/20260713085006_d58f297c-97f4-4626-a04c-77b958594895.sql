
-- Jabatan-based RBAC: setiap master_jabatan dapat memiliki daftar permission sendiri.
CREATE TABLE IF NOT EXISTS public.jabatan_permissions (
  jabatan_id uuid NOT NULL REFERENCES public.master_jabatan(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (jabatan_id, permission_code)
);

GRANT SELECT ON public.jabatan_permissions TO authenticated;
GRANT ALL ON public.jabatan_permissions TO service_role;

ALTER TABLE public.jabatan_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jabatan_permissions_select_auth"
  ON public.jabatan_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "jabatan_permissions_manage_admin"
  ON public.jabatan_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role)
           OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_jabatan_permissions_jabatan ON public.jabatan_permissions(jabatan_id);

-- Seed default permission per klasifikasi jabatan sistem (system_position).
-- Idempotent: ON CONFLICT DO NOTHING.
WITH mapping(sp, code) AS (VALUES
  -- Kepala OPD: kontrol penuh operasi OPD
  ('kepala_opd','can_manage_forms'),
  ('kepala_opd','can_create_form'),
  ('kepala_opd','can_edit_form'),
  ('kepala_opd','can_publish_form'),
  ('kepala_opd','can_assign_form'),
  ('kepala_opd','can_verify_submission'),
  ('kepala_opd','can_approve_submission'),
  ('kepala_opd','can_reject_submission'),
  ('kepala_opd','can_request_revision'),
  ('kepala_opd','can_view_sensitive_document'),
  ('kepala_opd','can_download_document'),
  ('kepala_opd','can_share_document'),
  ('kepala_opd','can_approve_data_request'),
  ('kepala_opd','can_export_data'),
  ('kepala_opd','view_all_performance'),
  -- Sekretaris: administrasi surat/form
  ('sekretaris','can_manage_forms'),
  ('sekretaris','can_create_form'),
  ('sekretaris','can_edit_form'),
  ('sekretaris','can_verify_submission'),
  ('sekretaris','can_request_revision'),
  ('sekretaris','can_download_document'),
  ('sekretaris','can_share_document'),
  ('sekretaris','can_export_data'),
  -- Kepala Bidang: verifikasi & persetujuan bidang
  ('kepala_bidang','can_verify_submission'),
  ('kepala_bidang','can_approve_submission'),
  ('kepala_bidang','can_reject_submission'),
  ('kepala_bidang','can_request_revision'),
  ('kepala_bidang','can_view_sensitive_document'),
  ('kepala_bidang','can_download_document'),
  -- Kepala Sekolah
  ('kepala_sekolah','can_verify_submission'),
  ('kepala_sekolah','can_approve_submission'),
  ('kepala_sekolah','can_download_document'),
  ('kepala_sekolah','can_request_document'),
  -- Operator
  ('operator','can_create_form'),
  ('operator','can_edit_form'),
  ('operator','can_download_document'),
  ('operator','can_request_document'),
  -- Verifikator
  ('verifikator','can_verify_submission'),
  ('verifikator','can_request_revision'),
  ('verifikator','can_reject_submission'),
  ('verifikator','can_view_sensitive_document'),
  ('verifikator','can_download_document'),
  -- Staff
  ('staff','can_download_document'),
  ('staff','can_request_document'),
  -- Guru
  ('guru','can_download_document'),
  ('guru','can_request_document'),
  -- Tenaga Teknis
  ('tenaga_teknis','can_download_document'),
  ('tenaga_teknis','can_request_document')
)
INSERT INTO public.jabatan_permissions (jabatan_id, permission_code)
SELECT mj.id, m.code
FROM mapping m
JOIN public.master_jabatan mj ON mj.system_position::text = m.sp
WHERE EXISTS (SELECT 1 FROM public.permissions p WHERE p.code = m.code)
ON CONFLICT DO NOTHING;

-- Rewrite get_effective_permissions: gabungkan role_permissions + jabatan_permissions + user_permissions overrides.
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
  jabatan_perms AS (
    SELECT jp.permission_code
    FROM public.profiles pr
    JOIN public.jabatan_permissions jp ON jp.jabatan_id = pr.jabatan_id
    WHERE pr.id = _user_id AND pr.jabatan_id IS NOT NULL
  ),
  default_perms AS (
    SELECT permission_code FROM role_perms
    UNION
    SELECT permission_code FROM jabatan_perms
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
    SELECT permission_code FROM default_perms
    WHERE permission_code NOT IN (SELECT permission_code FROM denies)
    UNION
    SELECT permission_code FROM overrides WHERE granted = true
  )
  SELECT COALESCE(array_agg(DISTINCT permission_code), ARRAY[]::text[]) FROM merged;
$function$;
