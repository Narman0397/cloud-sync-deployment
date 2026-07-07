SET search_path = public;

-- form_templates
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text, name text NOT NULL, description text, category text,
  scope text DEFAULT 'global' NOT NULL,
  status text DEFAULT 'draft' NOT NULL,
  owner_opd_id uuid,
  allowed_employee_types text[] DEFAULT '{}'::text[],
  fields jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- form_versions
CREATE TABLE IF NOT EXISTS public.form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  schema_snapshot jsonb DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Patch forms with version pointer + version_number
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1 NOT NULL;

-- form_audit_logs uses resource_type, not resource
ALTER TABLE public.form_audit_logs
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- document_history extra columns referenced by audit service
ALTER TABLE public.document_history
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS document_type text;

-- Fix has_permission signature to match call site (_permission_code)
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission_code = _permission_code AND granted = true
      AND (revoked_at IS NULL) AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

-- Stub RPCs (return empty JSON arrays/scalars) — bodies to be implemented later
CREATE OR REPLACE FUNCTION public.aset_compliance() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.aset_due_warranty(_days integer DEFAULT 30) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.attendance_compliance(_opd uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.attendance_device_alert(_opd uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(_opd uuid DEFAULT NULL, _tahun integer DEFAULT NULL, _bulan integer DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.count_permohonan_bulan_ini() RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT 0 $$;
CREATE OR REPLACE FUNCTION public.executive_summary() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.fn_approve_user(_user_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.profiles SET status='active', verified_at=now(), verified_by=auth.uid() WHERE id=_user_id $$;
CREATE OR REPLACE FUNCTION public.fn_reject_user(_user_id uuid, _reason text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.profiles SET status='rejected' WHERE id=_user_id $$;
CREATE OR REPLACE FUNCTION public.fn_generate_nomor_surat(_opd_id uuid, _tahun integer) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.fn_doc_next_number(_opd_id, _tahun) $$;
CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_opd uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.fn_permohonan_effective_sla_seconds(_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT 0 $$;
CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run(_periode text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.governance_summary() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg(_opd uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_attendance_today(_opd uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_kinerja_agg() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(_opd uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_rating_agg() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_skor_komposit() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.production_health_score() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '{}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.rate_limit_increment(_identifier text, _bucket text, _window_seconds integer DEFAULT 60, _max integer DEFAULT 100) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{"allowed":true,"count":1}'::jsonb $$;
CREATE OR REPLACE FUNCTION public.rating_list_admin(_from date DEFAULT NULL, _to date DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT '[]'::jsonb $$;

-- Lock down execute on all the new functions to authenticated + service_role
DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public' AND p.proname IN (
      'aset_compliance','aset_due_warranty','attendance_compliance','attendance_device_alert',
      'attendance_rekap_bulanan','count_permohonan_bulan_ini','executive_summary',
      'fn_approve_user','fn_reject_user','fn_generate_nomor_surat','fn_ikm_dashboard',
      'fn_permohonan_effective_sla_seconds','fn_susut_bulanan_run','get_effective_permissions',
      'governance_summary','layanan_kinerja_agg','migrasi_dataset_ke_forms','opd_attendance_today',
      'opd_kategori_benchmark','opd_kinerja_agg','opd_kinerja_trend','opd_rating_agg',
      'opd_skor_komposit','production_health_score','rate_limit_increment','rating_list_admin',
      'riwayat_dengan_petugas'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- GRANTs + RLS for new tables
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('form_templates','form_versions')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "admin_all_%s" ON public.%I', r.tablename, r.tablename);
    EXECUTE format('CREATE POLICY "admin_all_%s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''super_admin''::app_role) OR public.has_role(auth.uid(),''admin_opd''::app_role)) WITH CHECK (public.has_role(auth.uid(),''super_admin''::app_role) OR public.has_role(auth.uid(),''admin_opd''::app_role))', r.tablename, r.tablename);
  END LOOP;
END $$;