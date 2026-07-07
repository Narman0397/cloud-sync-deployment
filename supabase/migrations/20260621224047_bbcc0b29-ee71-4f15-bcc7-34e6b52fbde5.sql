
-- status_permohonan: tambah nilai
ALTER TYPE public.status_permohonan ADD VALUE IF NOT EXISTS 'menunggu_dokumen';

-- audit_log
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_id text;

-- document_history
ALTER TABLE public.document_history
  ADD COLUMN IF NOT EXISTS actor_id uuid;

-- document_templates: ganti current_version (jsonb) menjadi integer
ALTER TABLE public.document_templates DROP COLUMN IF EXISTS current_version;
ALTER TABLE public.document_templates ADD COLUMN current_version integer DEFAULT 1;

-- generated_documents
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS numbering_rule_id uuid,
  ADD COLUMN IF NOT EXISTS generated_by uuid,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot jsonb;

-- form_versions: tambah fields/meta (kompat dengan kode baru)
ALTER TABLE public.form_versions
  ADD COLUMN IF NOT EXISTS fields jsonb,
  ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}'::jsonb;

-- signature_events
ALTER TABLE public.signature_events
  ADD COLUMN IF NOT EXISTS signer_id uuid,
  ADD COLUMN IF NOT EXISTS actor uuid;

-- signature_requests
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS provider_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- signature_request_signers
ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS signer_type text,
  ADD COLUMN IF NOT EXISTS opd_id uuid;
-- ubah tipe position dari integer ke text agar match dengan kode
ALTER TABLE public.signature_request_signers
  ALTER COLUMN position TYPE text USING position::text;

-- submission_versions: tambah values + reason (alias kompat data)
ALTER TABLE public.submission_versions
  ADD COLUMN IF NOT EXISTS values jsonb,
  ADD COLUMN IF NOT EXISTS reason text;

-- submission_delegations: tambah kolom yang dipakai kode baru
ALTER TABLE public.submission_delegations
  ADD COLUMN IF NOT EXISTS task_id uuid,
  ADD COLUMN IF NOT EXISTS from_user_id uuid,
  ADD COLUMN IF NOT EXISTS to_user_id uuid;

-- submission_tasks
ALTER TABLE public.submission_tasks
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS sla_hours integer,
  ADD COLUMN IF NOT EXISTS node_type text;

-- workflow_definitions
ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- absensi_asn
ALTER TABLE public.absensi_asn
  ADD COLUMN IF NOT EXISTS device_fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS schedule_id uuid;

-- v_permohonan_overdue: tambah kolom overdue_days
DROP VIEW IF EXISTS public.v_permohonan_overdue;
CREATE VIEW public.v_permohonan_overdue AS
  SELECT id, kode, judul, opd_id, status, tanggal_masuk, tenggat,
    EXTRACT(epoch FROM now() - tenggat)::integer AS overdue_seconds,
    GREATEST(0, EXTRACT(day FROM now() - tenggat)::integer) AS overdue_days
  FROM public.permohonan
  WHERE tenggat IS NOT NULL AND tenggat < now()
    AND status NOT IN ('selesai'::public.status_permohonan, 'ditolak'::public.status_permohonan);
GRANT SELECT ON public.v_permohonan_overdue TO authenticated, service_role;

-- RPC overload: fn_doc_next_number(_rule_id, _opd_id, _category)
CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_rule_id uuid, _opd_id uuid DEFAULT NULL, _category text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_num integer; padding integer; BEGIN
  UPDATE public.document_numbering_rules
    SET last_value = COALESCE(last_value,0) + 1, updated_at = now()
    WHERE id = _rule_id
    RETURNING last_value, COALESCE(padding,6) INTO next_num, padding;
  IF next_num IS NULL THEN RETURN NULL; END IF;
  RETURN lpad(next_num::text, padding, '0');
END $$;

-- RPC overload: fn_generate_nomor_surat(_opd_id, _permohonan_id)
CREATE OR REPLACE FUNCTION public.fn_generate_nomor_surat(_opd_id uuid, _permohonan_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_doc_next_number(_opd_id, EXTRACT(year FROM now())::integer, _permohonan_id)
$$;
