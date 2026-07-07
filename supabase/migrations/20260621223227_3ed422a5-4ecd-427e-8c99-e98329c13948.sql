SET search_path = public;

-- permohonan: add SLA and disposition + nomor_surat columns
ALTER TABLE public.permohonan
  ADD COLUMN IF NOT EXISTS current_disposition_id uuid,
  ADD COLUMN IF NOT EXISTS dokumen_final_path text,
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_total_pause_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nomor_surat text;

-- document_templates: rendering metadata
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS template_html text,
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_opd_id uuid,
  ADD COLUMN IF NOT EXISTS numbering_rule_id uuid,
  ADD COLUMN IF NOT EXISTS current_version jsonb DEFAULT '{}'::jsonb;

-- documents: rendering metadata
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS template_html text,
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS owner_opd_id uuid;

-- asn izin daily quota function (different signature)
DROP FUNCTION IF EXISTS public.attendance_compliance(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.attendance_compliance(_opd_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL, _days integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

REVOKE EXECUTE ON FUNCTION public.attendance_compliance(uuid, date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_compliance(uuid, date, date, integer) TO authenticated, service_role;