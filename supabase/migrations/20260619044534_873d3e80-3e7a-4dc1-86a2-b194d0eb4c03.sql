
ALTER TABLE public.workflow_definitions
  ALTER COLUMN form_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS opd_pemilik_id UUID REFERENCES public.opd(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.workflow_definitions
  DROP CONSTRAINT IF EXISTS workflow_definitions_status_check;
ALTER TABLE public.workflow_definitions
  ADD CONSTRAINT workflow_definitions_status_check CHECK (status IN ('draft','active','archived'));

CREATE UNIQUE INDEX IF NOT EXISTS workflow_definitions_code_unique
  ON public.workflow_definitions (code) WHERE code IS NOT NULL AND deleted_at IS NULL;

UPDATE public.workflow_definitions wd
SET opd_pemilik_id = f.opd_pemilik_id
FROM public.forms f
WHERE wd.form_id = f.id AND wd.opd_pemilik_id IS NULL;

DROP POLICY IF EXISTS wd_select ON public.workflow_definitions;
DROP POLICY IF EXISTS wd_write ON public.workflow_definitions;

CREATE POLICY wd_select ON public.workflow_definitions FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR (opd_pemilik_id IS NOT NULL AND opd_pemilik_id = get_user_opd(auth.uid()))
  OR (form_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = workflow_definitions.form_id AND f.opd_pemilik_id = get_user_opd(auth.uid())))
);

CREATE POLICY wd_write ON public.workflow_definitions FOR ALL TO authenticated USING (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR (opd_pemilik_id IS NOT NULL AND opd_pemilik_id = get_user_opd(auth.uid()))
  OR (form_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = workflow_definitions.form_id AND f.opd_pemilik_id = get_user_opd(auth.uid())))
) WITH CHECK (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR (opd_pemilik_id IS NOT NULL AND opd_pemilik_id = get_user_opd(auth.uid()))
  OR (form_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = workflow_definitions.form_id AND f.opd_pemilik_id = get_user_opd(auth.uid())))
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  category TEXT,
  scope TEXT NOT NULL DEFAULT 'opd' CHECK (scope IN ('global','opd')),
  owner_opd_id UUID REFERENCES public.opd(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY wt_select ON public.workflow_templates FOR SELECT TO authenticated USING (
  scope = 'global'
  OR has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR (owner_opd_id IS NOT NULL AND owner_opd_id = get_user_opd(auth.uid()))
);
CREATE POLICY wt_write ON public.workflow_templates FOR ALL TO authenticated USING (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR (owner_opd_id IS NOT NULL AND owner_opd_id = get_user_opd(auth.uid()))
) WITH CHECK (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR (owner_opd_id IS NOT NULL AND owner_opd_id = get_user_opd(auth.uid()))
);

DROP TRIGGER IF EXISTS trg_workflow_templates_updated ON public.workflow_templates;
CREATE TRIGGER trg_workflow_templates_updated BEFORE UPDATE ON public.workflow_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.workflow_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.workflow_audit_logs TO authenticated;
GRANT ALL ON public.workflow_audit_logs TO service_role;
ALTER TABLE public.workflow_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY wal_select ON public.workflow_audit_logs FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'super_admin'::app_role)
  OR has_role(auth.uid(),'admin_pemda'::app_role)
  OR user_id = auth.uid()
);
CREATE POLICY wal_insert ON public.workflow_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS workflow_audit_logs_resource_idx ON public.workflow_audit_logs (resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workflow_definitions_status_idx ON public.workflow_definitions (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS workflow_definitions_opd_idx ON public.workflow_definitions (opd_pemilik_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS workflow_versions_workflow_idx ON public.workflow_versions (workflow_id, version_number DESC);
