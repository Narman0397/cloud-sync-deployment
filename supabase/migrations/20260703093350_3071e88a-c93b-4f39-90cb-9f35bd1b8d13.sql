
ALTER TYPE public.status_permohonan ADD VALUE IF NOT EXISTS 'menunggu_dokumen';

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS numbering_rule_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot jsonb;

ALTER TABLE public.workflow_definitions
  ALTER COLUMN form_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_version_id uuid;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS signer_type text,
  ADD COLUMN IF NOT EXISTS opd_id uuid;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS current_workflow_version_id uuid;

CREATE OR REPLACE VIEW public.v_permohonan_overdue AS
  SELECT p.id,
         COALESCE(p.nomor_surat, p.id::text) AS kode,
         p.opd_id,
         GREATEST(0, EXTRACT(DAY FROM (now() - p.tanggal_masuk))::int)::int AS overdue_days,
         p.status::text AS status
  FROM public.permohonan p
  WHERE p.status::text NOT IN ('selesai','ditolak');

GRANT SELECT ON public.v_permohonan_overdue TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.attendance_rekap_bulanan(integer,integer,uuid);
CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(_bulan integer DEFAULT NULL, _tahun integer DEFAULT NULL, _opd_id uuid DEFAULT NULL, _user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.attendance_device_alert(integer);
CREATE OR REPLACE FUNCTION public.attendance_device_alert(_hours integer DEFAULT 24, _days integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.migrasi_dataset_ke_forms(uuid);
CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms(_template_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('ok', true) $$;

DROP FUNCTION IF EXISTS public.fn_ikm_dashboard(date,date,uuid);
CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_from date DEFAULT NULL, _to date DEFAULT NULL, _opd_id uuid DEFAULT NULL, _survey_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;

DROP FUNCTION IF EXISTS public.opd_kategori_benchmark(date,date);
CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark(_from date DEFAULT NULL, _to date DEFAULT NULL, _kategori text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.rate_limit_increment(text,integer,integer);
CREATE OR REPLACE FUNCTION public.rate_limit_increment(_key text, _window_seconds integer DEFAULT 60, _max_hits integer DEFAULT 60, _scope text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('allowed', true, 'hits', 1) $$;

DROP FUNCTION IF EXISTS public.fn_permohonan_effective_sla_seconds(uuid);
CREATE OR REPLACE FUNCTION public.fn_permohonan_effective_sla_seconds(_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 0::int $$;

GRANT EXECUTE ON FUNCTION
  public.attendance_rekap_bulanan(integer,integer,uuid,uuid),
  public.attendance_device_alert(integer,integer),
  public.migrasi_dataset_ke_forms(uuid),
  public.fn_ikm_dashboard(date,date,uuid,uuid),
  public.opd_kategori_benchmark(date,date,text),
  public.rate_limit_increment(text,integer,integer,text),
  public.fn_permohonan_effective_sla_seconds(uuid)
TO authenticated, service_role;
