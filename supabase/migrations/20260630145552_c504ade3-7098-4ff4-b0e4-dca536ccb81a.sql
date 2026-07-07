ALTER TABLE public.master_jabatan
  ADD COLUMN IF NOT EXISTS system_position text;

ALTER TABLE public.master_jabatan
  DROP CONSTRAINT IF EXISTS master_jabatan_system_position_chk;
ALTER TABLE public.master_jabatan
  ADD CONSTRAINT master_jabatan_system_position_chk
  CHECK (
    system_position IS NULL OR system_position IN (
      'kepala_opd','sekretaris','kepala_bidang','kepala_sekolah',
      'operator','verifikator','staff','guru','tenaga_teknis','lainnya'
    )
  );

CREATE OR REPLACE FUNCTION public.derive_system_position_from_jabatan(
  _kode text,
  _nama text,
  _kategori text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(COALESCE(_kode,'')) ~ '(kepala_dinas|kepala_badan|kaban|kadis|kepala_opd)'
      OR lower(COALESCE(_nama,'')) LIKE 'kepala dinas%'
      OR lower(COALESCE(_nama,'')) LIKE 'kepala badan%'
      THEN 'kepala_opd'
    WHEN lower(COALESCE(_kode,'')) ~ '(sekretaris|sekdis|sekban)'
      OR lower(COALESCE(_nama,'')) LIKE 'sekretaris%'
      THEN 'sekretaris'
    WHEN lower(COALESCE(_kode,'')) ~ '(kabid|kepala_bidang|kepala_sub_bidang|kasubbid)'
      OR lower(COALESCE(_nama,'')) LIKE 'kepala bidang%'
      OR lower(COALESCE(_nama,'')) LIKE 'kepala sub bidang%'
      THEN 'kepala_bidang'
    WHEN lower(COALESCE(_kode,'')) ~ '(kepala_sekolah|kasek)'
      OR lower(COALESCE(_nama,'')) LIKE 'kepala sekolah%'
      THEN 'kepala_sekolah'
    WHEN lower(COALESCE(_kode,'')) ~ '(operator|admin_layanan|admin_data)'
      OR lower(COALESCE(_nama,'')) LIKE '%operator%'
      THEN 'operator'
    WHEN lower(COALESCE(_kode,'')) ~ '(verifikator|validator|pemeriksa)'
      OR lower(COALESCE(_nama,'')) LIKE '%verifikator%'
      OR lower(COALESCE(_nama,'')) LIKE '%validator%'
      THEN 'verifikator'
    WHEN lower(COALESCE(_kode,'')) ~ '(guru|pengawas_sekolah)'
      OR lower(COALESCE(_nama,'')) LIKE '%guru%'
      OR lower(COALESCE(_nama,'')) LIKE '%pengawas sekolah%'
      THEN 'guru'
    WHEN lower(COALESCE(_kode,'')) ~ '(dokter|perawat|bidan|penyuluh|analis|pranata|arsiparis|bendahara|teknis|fungsional)'
      OR lower(COALESCE(_kategori,'')) LIKE '%fungsional%'
      THEN 'tenaga_teknis'
    WHEN lower(COALESCE(_kode,'')) ~ '(staf|staff|pelaksana|pengadministrasi|pengelola)'
      OR lower(COALESCE(_nama,'')) LIKE '%staf%'
      OR lower(COALESCE(_nama,'')) LIKE '%staff%'
      OR lower(COALESCE(_nama,'')) LIKE '%pelaksana%'
      THEN 'staff'
    ELSE 'lainnya'
  END
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_profile_asn_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _jabatan record;
BEGIN
  IF NEW.asn_type = 'honorer' THEN
    NEW.asn_type := 'pppk_paruh_waktu';
  END IF;

  IF NEW.jabatan_id IS NOT NULL THEN
    SELECT id, kode, nama, kategori, system_position
      INTO _jabatan
    FROM public.master_jabatan
    WHERE id = NEW.jabatan_id
    LIMIT 1;

    IF _jabatan.id IS NOT NULL THEN
      NEW.jabatan := _jabatan.nama;
      NEW.system_position := COALESCE(
        _jabatan.system_position,
        public.derive_system_position_from_jabatan(_jabatan.kode, _jabatan.nama, _jabatan.kategori),
        NEW.system_position
      );
    END IF;
  ELSIF NEW.jabatan IS NOT NULL AND (NEW.system_position IS NULL OR NEW.system_position = 'lainnya') THEN
    NEW.system_position := public.derive_system_position_from_jabatan(NULL, NEW.jabatan, NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_asn_classification ON public.profiles;
CREATE TRIGGER trg_sync_profile_asn_classification
  BEFORE INSERT OR UPDATE OF jabatan_id, jabatan, asn_type, requested_role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sync_profile_asn_classification();

CREATE OR REPLACE FUNCTION public.get_default_permissions(_user_id uuid)
RETURNS TABLE(permission_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _roles text[] := ARRAY[]::text[];
  _asn_type text;
  _system_position text;
  _jabatan_kode text;
BEGIN
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[])
    INTO _roles
  FROM public.user_roles
  WHERE user_id = _user_id;

  SELECT p.asn_type,
         COALESCE(p.system_position, mj.system_position, public.derive_system_position_from_jabatan(mj.kode, COALESCE(mj.nama, p.jabatan), mj.kategori)),
         mj.kode
    INTO _asn_type, _system_position, _jabatan_kode
  FROM public.profiles p
  LEFT JOIN public.master_jabatan mj ON mj.id = p.jabatan_id
  WHERE p.id = _user_id
  LIMIT 1;

  IF 'super_admin' = ANY(_roles) THEN
    RETURN QUERY SELECT code FROM public.permissions;
    RETURN;
  END IF;

  IF 'admin_pemda' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('pemda.view'),('pemda.manage'),('pemda.monitor'),
      ('view_all_opd'),('view_all_submissions'),('view_all_attendance'),('view_all_assets'),
      ('view_all_datasets'),('view_all_reports'),('view_all_performance'),('view_all_surveys'),
      ('view_kabupaten_dashboard'),('view_executive_dashboard'),('view_cross_opd_analytics'),
      ('executive.view'),
      ('can_manage_users'),('can_manage_opd'),('can_view_audit_logs'),('can_export_data'),
      ('can_manage_forms'),('can_publish_form'),('can_verify_submission'),('can_approve_registration'),
      ('can_request_data'),('can_approve_data_request'),
      ('can_view_sensitive_document'),('can_download_document'),('can_share_document')
    ) AS v(permission_code);
  END IF;

  IF 'pimpinan' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('view_all_opd'),('view_all_submissions'),('view_all_attendance'),('view_all_assets'),
      ('view_all_datasets'),('view_all_reports'),('view_all_performance'),('view_all_surveys'),
      ('view_kabupaten_dashboard'),('view_executive_dashboard'),('view_cross_opd_analytics'),
      ('executive.view'),('can_export_data'),('can_download_document')
    ) AS v(permission_code);

    IF public.is_bupati(_user_id) THEN
      RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
        ('executive.approve'),('executive.sign'),('executive.disposition')
      ) AS v(permission_code);
    END IF;
  END IF;

  IF 'admin_bkpsdm' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('can_manage_users'),('can_approve_registration'),('can_view_audit_logs'),('can_export_data'),
      ('view_all_performance'),('view_all_attendance'),('view_all_reports'),
      ('can_request_data'),('can_approve_data_request'),
      ('can_view_sensitive_document'),('can_download_document'),('can_share_document')
    ) AS v(permission_code);
  END IF;

  IF 'kepala_bkpsdm' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('executive.view'),('view_executive_dashboard'),('view_all_performance'),('view_all_attendance'),
      ('view_all_reports'),('can_approve_registration'),('can_approve_data_request'),
      ('can_view_sensitive_document'),('can_download_document'),('can_export_data')
    ) AS v(permission_code);
  END IF;

  IF 'admin_opd' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('can_manage_forms'),('can_create_form'),('can_edit_form'),('can_publish_form'),('can_assign_form'),
      ('can_verify_submission'),('can_approve_submission'),('can_reject_submission'),('can_request_revision'),
      ('can_request_data'),('can_approve_data_request'),
      ('can_view_sensitive_document'),('can_download_document'),('can_share_document'),('can_request_document'),
      ('can_export_data')
    ) AS v(permission_code);
  END IF;

  IF 'admin_desa' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('can_approve_registration'),('can_verify_submission'),('can_request_revision'),
      ('can_request_document'),('can_download_document'),('can_share_document')
    ) AS v(permission_code);
  END IF;

  IF 'asn' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('can_request_document'),('can_download_document'),('can_share_document')
    ) AS v(permission_code);

    IF _asn_type IN ('pns','pppk_penuh_waktu') THEN
      RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
        ('can_request_data')
      ) AS v(permission_code);
    END IF;

    IF _system_position IN ('operator','verifikator') THEN
      RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
        ('can_verify_submission'),('can_request_revision')
      ) AS v(permission_code);
    END IF;

    IF _system_position IN ('kepala_bidang','sekretaris','kepala_opd','kepala_sekolah') THEN
      RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
        ('can_approve_submission'),('can_reject_submission'),('can_request_revision'),('can_view_sensitive_document')
      ) AS v(permission_code);
    END IF;

    IF _system_position = 'kepala_opd' THEN
      RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
        ('can_publish_form'),('can_manage_forms'),('can_approve_data_request')
      ) AS v(permission_code);
    END IF;

    IF _system_position IN ('guru','tenaga_teknis','staff','lainnya') THEN
      RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
        ('can_create_form')
      ) AS v(permission_code);
    END IF;
  END IF;

  IF 'warga' = ANY(_roles) THEN
    RETURN QUERY SELECT DISTINCT v.permission_code FROM (VALUES
      ('can_request_document')
    ) AS v(permission_code);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_permissions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _override boolean;
BEGIN
  SELECT up.granted
    INTO _override
  FROM public.user_permissions up
  WHERE up.user_id = _user_id
    AND up.permission_code = _permission_code
    AND up.revoked_at IS NULL
    AND (up.expires_at IS NULL OR up.expires_at > now())
  ORDER BY up.updated_at DESC NULLS LAST, up.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(_override, false);
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.get_default_permissions(_user_id) d
    WHERE d.permission_code = _permission_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH defaults AS (
    SELECT DISTINCT permission_code
    FROM public.get_default_permissions(_user_id)
  ), active_overrides AS (
    SELECT DISTINCT ON (permission_code) permission_code, granted
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY permission_code, updated_at DESC NULLS LAST, created_at DESC
  ), effective AS (
    SELECT d.permission_code
    FROM defaults d
    WHERE NOT EXISTS (
      SELECT 1 FROM active_overrides o
      WHERE o.permission_code = d.permission_code AND o.granted = false
    )
    UNION
    SELECT o.permission_code
    FROM active_overrides o
    WHERE o.granted = true
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('code', e.permission_code, 'permission_code', e.permission_code)
      ORDER BY e.permission_code
    ),
    '[]'::jsonb
  )
  FROM effective e
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated, service_role;