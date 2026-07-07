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

ALTER TABLE public.form_wizard_drafts
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles SET full_name = nama_lengkap WHERE full_name IS NULL;

CREATE INDEX IF NOT EXISTS ux_forms_code ON public.forms(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_forms_owner_status ON public.forms(opd_pemilik_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_forms_allowed_emp_gin ON public.forms USING GIN (allowed_employee_types);
CREATE INDEX IF NOT EXISTS ux_form_submissions_code ON public.form_submissions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_form_submissions_workflow_node ON public.form_submissions(workflow_version_id, current_workflow_node);

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = _user_id
        AND up.permission_code = _permission_code
        AND up.granted = true
        AND up.revoked_at IS NULL
        AND (up.expires_at IS NULL OR up.expires_at > now())
    )
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_rule_id uuid, _opd_id uuid DEFAULT NULL, _category text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.document_numbering_rules;
  _year int := EXTRACT(YEAR FROM now())::int;
  _seq_year int;
  _scope_key text := '';
  _next int;
  _seq_str text;
  _opd_code text := '';
  _opd_name text := '';
  _formatted text;
BEGIN
  SELECT * INTO r FROM public.document_numbering_rules WHERE id = _rule_id AND (status='active' OR aktif = true) LIMIT 1;
  IF r IS NULL THEN RAISE EXCEPTION 'numbering rule not found'; END IF;
  _seq_year := CASE WHEN COALESCE(r.reset_period, r.reset_per, 'yearly') = 'yearly' THEN _year ELSE 0 END;
  IF r.scope IN ('per_opd','per_opd_category') THEN _scope_key := COALESCE(_opd_id::text,''); END IF;
  IF r.scope IN ('per_category','per_opd_category') THEN _scope_key := _scope_key || '|' || COALESCE(_category, r.category, ''); END IF;
  INSERT INTO public.document_numbering_sequences(rule_id, scope_key, year, last_number)
    VALUES (r.id, _scope_key, _seq_year, 1)
  ON CONFLICT (rule_id, scope_key, year)
    DO UPDATE SET last_number = public.document_numbering_sequences.last_number + 1, updated_at = now()
  RETURNING last_number INTO _next;
  _seq_str := LPAD(_next::text, COALESCE(r.padding, 6), '0');
  IF _opd_id IS NOT NULL THEN
    SELECT COALESCE(singkatan,''), COALESCE(nomor_surat_kode,'') INTO _opd_name, _opd_code FROM public.opd WHERE id=_opd_id;
  END IF;
  _formatted := r.format;
  _formatted := REPLACE(_formatted, '{YEAR}', _year::text);
  _formatted := REPLACE(_formatted, '{tahun}', _year::text);
  _formatted := REPLACE(_formatted, '{MONTH}', LPAD(EXTRACT(MONTH FROM now())::text,2,'0'));
  _formatted := REPLACE(_formatted, '{SEQ}', _seq_str);
  _formatted := REPLACE(_formatted, '{seq}', _seq_str);
  _formatted := REPLACE(_formatted, '{OPD}', _opd_name);
  _formatted := REPLACE(_formatted, '{singkatan}', _opd_name);
  _formatted := REPLACE(_formatted, '{OPD_CODE}', _opd_code);
  _formatted := REPLACE(_formatted, '{kode}', _opd_code);
  _formatted := REPLACE(_formatted, '{CATEGORY}', COALESCE(_category, r.category, ''));
  RETURN _formatted;
END $$;
REVOKE ALL ON FUNCTION public.fn_doc_next_number(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid,uuid,text) TO authenticated, service_role;