DO $$ BEGIN CREATE TYPE public.employment_type AS ENUM ('PNS','PPPK','PPPK_PW','NON_ASN','THL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS allowed_employee_types public.employment_type[] NOT NULL DEFAULT ARRAY[]::public.employment_type[],
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sla_days integer,
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS publish_requested_by uuid,
  ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_approved_by uuid,
  ADD COLUMN IF NOT EXISTS publish_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_reject_reason text;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_workflow_node text,
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS form_snapshot jsonb;

ALTER TABLE public.master_jabatan ADD COLUMN IF NOT EXISTS system_position text;
CREATE INDEX IF NOT EXISTS ix_master_jabatan_system_position ON public.master_jabatan(system_position) WHERE system_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_form_submissions_workflow_node ON public.form_submissions(workflow_version_id, current_workflow_node);

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = _user_id
      AND up.permission_code = _permission_code
      AND COALESCE(up.granted, true) = true
      AND up.revoked_at IS NULL
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ) OR public.has_role(_user_id, 'super_admin'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_rule_id uuid, _opd_id uuid DEFAULT NULL, _category text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _seq bigint; _scope text; _year int; BEGIN
  _scope := COALESCE(_opd_id::text,'') || '|' || COALESCE(_category,'');
  _year := extract(year from now())::int;
  INSERT INTO public.document_numbering_sequences(rule_id, scope_key, year, last_number, updated_at)
  VALUES (_rule_id, _scope, _year, 1, now())
  ON CONFLICT (rule_id, scope_key, year)
  DO UPDATE SET last_number = public.document_numbering_sequences.last_number + 1, updated_at = now()
  RETURNING last_number INTO _seq;
  RETURN lpad(_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.fn_doc_next_number(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid,uuid,text) TO authenticated, service_role;