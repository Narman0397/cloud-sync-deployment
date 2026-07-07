-- =====================================================================
-- PHASE 1A: ENTERPRISE FORM BUILDER — DB FOUNDATION (reordered)
-- =====================================================================

-- 1. EMPLOYMENT TYPE ENUM
DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('PNS','PPPK','PPPK_PW','NON_ASN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type;

-- 2. EXTEND forms
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS allowed_employee_types public.employment_type[] NOT NULL DEFAULT ARRAY[]::public.employment_type[],
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sla_days integer,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_forms_code ON public.forms(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_forms_owner_status ON public.forms(opd_pemilik_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_forms_allowed_emp_gin ON public.forms USING GIN (allowed_employee_types);

-- 3. EXTEND form_submissions
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_workflow_node text,
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS form_snapshot jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS ux_form_submissions_code ON public.form_submissions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_form_submissions_opd_status_created ON public.form_submissions(opd_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_form_submissions_workflow_node ON public.form_submissions(workflow_version_id, current_workflow_node);

-- 4. form_versions
CREATE TABLE IF NOT EXISTS public.form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (form_id, version_number)
);
GRANT SELECT, INSERT, UPDATE ON public.form_versions TO authenticated;
GRANT ALL ON public.form_versions TO service_role;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;

-- 5. form_templates
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  category text,
  scope text NOT NULL DEFAULT 'opd' CHECK (scope IN ('global','opd')),
  owner_opd_id uuid REFERENCES public.opd(id),
  allowed_employee_types public.employment_type[] NOT NULL DEFAULT ARRAY[]::public.employment_type[],
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  workflow jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.form_templates TO authenticated;
GRANT ALL ON public.form_templates TO service_role;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- 6. workflow_*
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  current_version_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.workflow_definitions TO authenticated;
GRANT ALL ON public.workflow_definitions TO service_role;
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','locked','archived')),
  locked boolean NOT NULL DEFAULT false,
  submission_count integer NOT NULL DEFAULT 0,
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (workflow_id, version_number)
);
GRANT SELECT, INSERT, UPDATE ON public.workflow_versions TO authenticated;
GRANT ALL ON public.workflow_versions TO service_role;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workflow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES public.workflow_versions(id) ON DELETE CASCADE,
  node_key text NOT NULL,
  node_type text NOT NULL CHECK (node_type IN ('submit','review','approval','revision','disposisi','digital_signature','completed','rejected','parallel_split','parallel_join')),
  label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sla_hours integer,
  position jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_version_id, node_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_nodes TO authenticated;
GRANT ALL ON public.workflow_nodes TO service_role;
ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workflow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES public.workflow_versions(id) ON DELETE CASCADE,
  from_node text NOT NULL,
  to_node text NOT NULL,
  condition jsonb,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_edges TO authenticated;
GRANT ALL ON public.workflow_edges TO service_role;
ALTER TABLE public.workflow_edges ENABLE ROW LEVEL SECURITY;

-- 7. submission_versions, values, tasks, assignments, delegations, escalations
CREATE TABLE IF NOT EXISTS public.submission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (submission_id, version_number)
);
GRANT SELECT, INSERT ON public.submission_versions TO authenticated;
GRANT ALL ON public.submission_versions TO service_role;
ALTER TABLE public.submission_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submission_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.submission_versions(id) ON DELETE CASCADE,
  field_kode text NOT NULL,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_submission_values_submission ON public.submission_values(submission_id);
GRANT SELECT, INSERT ON public.submission_values TO authenticated;
GRANT ALL ON public.submission_values TO service_role;
ALTER TABLE public.submission_values ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submission_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  workflow_version_id uuid REFERENCES public.workflow_versions(id),
  node_key text NOT NULL,
  node_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected','escalated','delegated','cancelled')),
  due_at timestamptz,
  sla_hours integer,
  completed_at timestamptz,
  result jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_submission_tasks_sub_status ON public.submission_tasks(submission_id, status);
CREATE INDEX IF NOT EXISTS ix_submission_tasks_due ON public.submission_tasks(due_at) WHERE status IN ('pending','in_progress');
GRANT SELECT, INSERT, UPDATE ON public.submission_tasks TO authenticated;
GRANT ALL ON public.submission_tasks TO service_role;
ALTER TABLE public.submission_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.submission_tasks(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES auth.users(id),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','delegated','cancelled')),
  UNIQUE (task_id, assignee_id)
);
CREATE INDEX IF NOT EXISTS ix_submission_assignments_assignee ON public.submission_assignments(assignee_id, status);
GRANT SELECT, INSERT, UPDATE ON public.submission_assignments TO authenticated;
GRANT ALL ON public.submission_assignments TO service_role;
ALTER TABLE public.submission_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submission_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.submission_tasks(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  to_user_id uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  delegated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_submission_delegations_task ON public.submission_delegations(task_id);
GRANT SELECT, INSERT ON public.submission_delegations TO authenticated;
GRANT ALL ON public.submission_delegations TO service_role;
ALTER TABLE public.submission_delegations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.submission_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.submission_tasks(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  reason text,
  escalated_to uuid REFERENCES auth.users(id),
  escalated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_submission_escalations_task ON public.submission_escalations(task_id);
GRANT SELECT, INSERT ON public.submission_escalations TO authenticated;
GRANT ALL ON public.submission_escalations TO service_role;
ALTER TABLE public.submission_escalations ENABLE ROW LEVEL SECURITY;

-- 8. auto-numbering
CREATE TABLE IF NOT EXISTS public.submission_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  tahun integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, tahun)
);
GRANT SELECT ON public.submission_sequences TO authenticated;
GRANT ALL ON public.submission_sequences TO service_role;
ALTER TABLE public.submission_sequences ENABLE ROW LEVEL SECURITY;

-- 9. document templates & generated docs
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES public.forms(id) ON DELETE CASCADE,
  owner_opd_id uuid REFERENCES public.opd(id),
  name text NOT NULL,
  description text,
  template_html text,
  template_storage_path text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.document_templates(id),
  storage_path text NOT NULL,
  mime text NOT NULL DEFAULT 'application/pdf',
  size_bytes bigint,
  signed_document_id uuid REFERENCES public.signed_documents(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS ix_generated_documents_submission ON public.generated_documents(submission_id);
GRANT SELECT, INSERT ON public.generated_documents TO authenticated;
GRANT ALL ON public.generated_documents TO service_role;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- 10. immutable form audit log
CREATE TABLE IF NOT EXISTS public.form_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_form_audit_resource ON public.form_audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_form_audit_user_created ON public.form_audit_logs(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.form_audit_logs TO authenticated;
GRANT ALL ON public.form_audit_logs TO service_role;
ALTER TABLE public.form_audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- POLICIES (all tables exist now)
-- =====================================================================

-- form_versions
DROP POLICY IF EXISTS fv_select ON public.form_versions;
CREATE POLICY fv_select ON public.form_versions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_versions.form_id
    AND (f.opd_pemilik_id = public.get_user_opd(auth.uid()) OR f.is_public = true))
);
DROP POLICY IF EXISTS fv_insert ON public.form_versions;
CREATE POLICY fv_insert ON public.form_versions FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_versions.form_id
    AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
);

-- form_templates
DROP POLICY IF EXISTS ft_select ON public.form_templates;
CREATE POLICY ft_select ON public.form_templates FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    (scope = 'global' AND status = 'published')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR (scope = 'opd' AND owner_opd_id = public.get_user_opd(auth.uid()))
  )
);
DROP POLICY IF EXISTS ft_insert ON public.form_templates;
CREATE POLICY ft_insert ON public.form_templates FOR INSERT TO authenticated
WITH CHECK (
  (scope = 'global' AND public.has_role(auth.uid(),'super_admin'))
  OR (scope = 'opd' AND owner_opd_id = public.get_user_opd(auth.uid()))
);
DROP POLICY IF EXISTS ft_update ON public.form_templates;
CREATE POLICY ft_update ON public.form_templates FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin')
  OR (scope = 'opd' AND owner_opd_id = public.get_user_opd(auth.uid()))
);

-- workflow_definitions
DROP POLICY IF EXISTS wd_select ON public.workflow_definitions;
CREATE POLICY wd_select ON public.workflow_definitions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = workflow_definitions.form_id
    AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
);
DROP POLICY IF EXISTS wd_write ON public.workflow_definitions;
CREATE POLICY wd_write ON public.workflow_definitions FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = workflow_definitions.form_id
    AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = workflow_definitions.form_id
    AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
);

-- workflow_versions
DROP POLICY IF EXISTS wv_select ON public.workflow_versions;
CREATE POLICY wv_select ON public.workflow_versions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.workflow_definitions wd JOIN public.forms f ON f.id = wd.form_id
    WHERE wd.id = workflow_versions.workflow_id AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
);
DROP POLICY IF EXISTS wv_write ON public.workflow_versions;
CREATE POLICY wv_write ON public.workflow_versions FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.workflow_definitions wd JOIN public.forms f ON f.id = wd.form_id
    WHERE wd.id = workflow_versions.workflow_id AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.workflow_definitions wd JOIN public.forms f ON f.id = wd.form_id
    WHERE wd.id = workflow_versions.workflow_id AND f.opd_pemilik_id = public.get_user_opd(auth.uid()))
);

-- workflow_nodes, workflow_edges
DROP POLICY IF EXISTS wn_all ON public.workflow_nodes;
CREATE POLICY wn_all ON public.workflow_nodes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_versions wv WHERE wv.id = workflow_nodes.workflow_version_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_versions wv WHERE wv.id = workflow_nodes.workflow_version_id));

DROP POLICY IF EXISTS we_all ON public.workflow_edges;
CREATE POLICY we_all ON public.workflow_edges FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workflow_versions wv WHERE wv.id = workflow_edges.workflow_version_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_versions wv WHERE wv.id = workflow_edges.workflow_version_id));

-- submission_versions, values
DROP POLICY IF EXISTS sv_select ON public.submission_versions;
CREATE POLICY sv_select ON public.submission_versions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_versions.submission_id
    AND (s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())))
);
DROP POLICY IF EXISTS sv_insert ON public.submission_versions;
CREATE POLICY sv_insert ON public.submission_versions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_versions.submission_id
    AND (s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())
         OR public.has_role(auth.uid(),'super_admin')))
);

DROP POLICY IF EXISTS svals_select ON public.submission_values;
CREATE POLICY svals_select ON public.submission_values FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_values.submission_id
    AND (s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())))
);
DROP POLICY IF EXISTS svals_insert ON public.submission_values;
CREATE POLICY svals_insert ON public.submission_values FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_values.submission_id
    AND (s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())
         OR public.has_role(auth.uid(),'super_admin')))
);

-- submission_tasks (references submission_assignments which now exists)
DROP POLICY IF EXISTS st_select ON public.submission_tasks;
CREATE POLICY st_select ON public.submission_tasks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.submission_assignments sa WHERE sa.task_id = submission_tasks.id AND sa.assignee_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_tasks.submission_id
    AND (s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())))
);
DROP POLICY IF EXISTS st_write ON public.submission_tasks;
CREATE POLICY st_write ON public.submission_tasks FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_tasks.submission_id
    AND s.opd_id = public.get_user_opd(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = submission_tasks.submission_id
    AND s.opd_id = public.get_user_opd(auth.uid()))
);

-- submission_assignments
DROP POLICY IF EXISTS sa_select ON public.submission_assignments;
CREATE POLICY sa_select ON public.submission_assignments FOR SELECT TO authenticated
USING (
  assignee_id = auth.uid() OR assigned_by = auth.uid()
  OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.submission_tasks t JOIN public.form_submissions s ON s.id = t.submission_id
    WHERE t.id = submission_assignments.task_id AND s.opd_id = public.get_user_opd(auth.uid()))
);
DROP POLICY IF EXISTS sa_write ON public.submission_assignments;
CREATE POLICY sa_write ON public.submission_assignments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.submission_tasks t JOIN public.form_submissions s ON s.id = t.submission_id
    WHERE t.id = submission_assignments.task_id AND s.opd_id = public.get_user_opd(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.submission_tasks t JOIN public.form_submissions s ON s.id = t.submission_id
    WHERE t.id = submission_assignments.task_id AND s.opd_id = public.get_user_opd(auth.uid()))
);

-- submission_delegations
DROP POLICY IF EXISTS sd_select ON public.submission_delegations;
CREATE POLICY sd_select ON public.submission_delegations FOR SELECT TO authenticated
USING (
  from_user_id = auth.uid() OR to_user_id = auth.uid()
  OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
);
DROP POLICY IF EXISTS sd_insert ON public.submission_delegations;
CREATE POLICY sd_insert ON public.submission_delegations FOR INSERT TO authenticated
WITH CHECK (from_user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

-- submission_escalations
DROP POLICY IF EXISTS se_select ON public.submission_escalations;
CREATE POLICY se_select ON public.submission_escalations FOR SELECT TO authenticated
USING (
  escalated_to = auth.uid()
  OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.submission_tasks t JOIN public.form_submissions s ON s.id = t.submission_id
    WHERE t.id = submission_escalations.task_id AND s.opd_id = public.get_user_opd(auth.uid()))
);
DROP POLICY IF EXISTS se_insert ON public.submission_escalations;
CREATE POLICY se_insert ON public.submission_escalations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.submission_tasks t JOIN public.form_submissions s ON s.id = t.submission_id
    WHERE t.id = submission_escalations.task_id AND s.opd_id = public.get_user_opd(auth.uid()))
);

-- submission_sequences
DROP POLICY IF EXISTS seq_select ON public.submission_sequences;
CREATE POLICY seq_select ON public.submission_sequences FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda'));

-- document_templates
DROP POLICY IF EXISTS dt_select ON public.document_templates;
CREATE POLICY dt_select ON public.document_templates FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
    OR owner_opd_id = public.get_user_opd(auth.uid())
  )
);
DROP POLICY IF EXISTS dt_write ON public.document_templates;
CREATE POLICY dt_write ON public.document_templates FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin')
  OR owner_opd_id = public.get_user_opd(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR owner_opd_id = public.get_user_opd(auth.uid())
);

-- generated_documents
DROP POLICY IF EXISTS gd_select ON public.generated_documents;
CREATE POLICY gd_select ON public.generated_documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = generated_documents.submission_id
    AND (s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())))
);
DROP POLICY IF EXISTS gd_insert ON public.generated_documents;
CREATE POLICY gd_insert ON public.generated_documents FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.form_submissions s WHERE s.id = generated_documents.submission_id
    AND s.opd_id = public.get_user_opd(auth.uid()))
);

-- form_audit_logs
DROP POLICY IF EXISTS fal_select ON public.form_audit_logs;
CREATE POLICY fal_select ON public.form_audit_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  OR user_id = auth.uid()
);
DROP POLICY IF EXISTS fal_insert ON public.form_audit_logs;
CREATE POLICY fal_insert ON public.form_audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- =====================================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_fb_generate_submission_code(_format text, _scope text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tahun integer := EXTRACT(YEAR FROM now())::integer;
  _seq integer;
BEGIN
  INSERT INTO public.submission_sequences (scope, tahun, last_number)
  VALUES (_scope, _tahun, 1)
  ON CONFLICT (scope, tahun) DO UPDATE SET last_number = public.submission_sequences.last_number + 1, updated_at = now()
  RETURNING last_number INTO _seq;
  RETURN replace(replace(_format, '{YEAR}', _tahun::text), '{SEQ}', lpad(_seq::text, 6, '0'));
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_fb_generate_submission_code(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_fb_generate_submission_code(text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_fb_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'form_audit_logs is immutable (operation %)', TG_OP;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_fb_audit_immutable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_fb_audit_immutable() TO service_role;

DROP TRIGGER IF EXISTS fb_audit_no_update ON public.form_audit_logs;
CREATE TRIGGER fb_audit_no_update BEFORE UPDATE ON public.form_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_fb_audit_immutable();

DROP TRIGGER IF EXISTS fb_audit_no_delete ON public.form_audit_logs;
CREATE TRIGGER fb_audit_no_delete BEFORE DELETE ON public.form_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_fb_audit_immutable();

-- updated_at triggers
DO $$
DECLARE _t text;
BEGIN
  FOR _t IN SELECT unnest(ARRAY['form_templates','workflow_definitions','submission_tasks','document_templates']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', _t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', _t);
  END LOOP;
END $$;