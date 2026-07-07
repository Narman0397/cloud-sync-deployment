
DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('pns','pppk','pppk_paruh_waktu','honorer','kontrak','magang','lainnya');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sla_days integer,
  ADD COLUMN IF NOT EXISTS allowed_employee_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS current_version_id uuid;

ALTER TABLE public.form_wizard_drafts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS workflow_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_workflow_node text;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS current_version_id uuid;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'super_admin')
      OR public.has_role(_user_id,'admin_opd')
      OR public.has_role(_user_id,'admin_pemda');
$$;

CREATE OR REPLACE FUNCTION public.fn_next_number(_rule_code text, _scope_key text DEFAULT '', _year int DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.document_numbering_rules%ROWTYPE; yr int; n int; out_text text;
BEGIN
  SELECT * INTO r FROM public.document_numbering_rules WHERE code = _rule_code AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Numbering rule % not found', _rule_code; END IF;
  yr := COALESCE(_year, EXTRACT(YEAR FROM now())::int);
  INSERT INTO public.document_numbering_sequences(rule_id, scope_key, year, last_number)
    VALUES (r.id, COALESCE(_scope_key,''), yr, 1)
    ON CONFLICT (rule_id, scope_key, year) DO UPDATE SET last_number = public.document_numbering_sequences.last_number + 1, updated_at=now()
    RETURNING last_number INTO n;
  out_text := replace(replace(replace(r.format,'{{seq}}', lpad(n::text, r.padding, '0')),'{{year}}', yr::text),'{{scope}}', COALESCE(_scope_key,''));
  RETURN out_text;
END $$;

CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_rule_code text, _scope_key text DEFAULT '', _year int DEFAULT NULL)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_next_number(_rule_code, _scope_key, _year);
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.fn_next_number(text,text,int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(text,text,int) TO authenticated, service_role;
