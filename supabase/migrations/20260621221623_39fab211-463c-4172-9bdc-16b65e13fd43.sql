SET search_path = public;

DO $$ BEGIN CREATE TYPE public.employment_type AS ENUM ('pns','pppk','honorer','tkk','non_asn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.submission_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid, task_id uuid, level integer DEFAULT 1 NOT NULL,
  reason text, escalated_to uuid, escalated_by uuid, status text DEFAULT 'open' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL, action text NOT NULL, actor uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.submission_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL, field_kode text NOT NULL, value jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.form_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, resource text NOT NULL, resource_id text,
  actor_id uuid, payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Extra columns on forms
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sla_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_employee_types text[] DEFAULT '{}'::text[];

-- Extra columns on form_submissions
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_workflow_node text;

-- GRANTs + RLS
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN
    ('submission_escalations','document_history','submission_values','form_audit_logs')
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "admin_all_%s" ON public.%I', r.tablename, r.tablename);
    EXECUTE format('CREATE POLICY "admin_all_%s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''super_admin''::app_role) OR public.has_role(auth.uid(),''admin_opd''::app_role)) WITH CHECK (public.has_role(auth.uid(),''super_admin''::app_role) OR public.has_role(auth.uid(),''admin_opd''::app_role))', r.tablename, r.tablename);
  END LOOP;
END $$;

-- Helper RPCs referenced by code
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _code text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission_code = _code AND granted = true
      AND (revoked_at IS NULL) AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_opd_id uuid, _tahun integer)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE seq_row public.nomor_surat_sequence%ROWTYPE; next_num integer; BEGIN
  SELECT * INTO seq_row FROM public.nomor_surat_sequence WHERE opd_id = _opd_id AND tahun = _tahun FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.nomor_surat_sequence (opd_id, tahun, last_number) VALUES (_opd_id, _tahun, 1) RETURNING last_number INTO next_num;
  ELSE
    UPDATE public.nomor_surat_sequence SET last_number = last_number + 1, updated_at = now()
      WHERE id = seq_row.id RETURNING last_number INTO next_num;
  END IF;
  RETURN lpad(next_num::text, 5, '0');
END $$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer) TO authenticated, service_role;