SET search_path = public;

ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS opd_pemilik_id uuid;

ALTER TABLE public.workflow_templates
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS graph jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_opd_id uuid,
  ADD COLUMN IF NOT EXISTS allowed_employee_types text[] DEFAULT '{}'::text[];

ALTER TABLE public.workflow_nodes
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid,
  ADD COLUMN IF NOT EXISTS node_key text,
  ADD COLUMN IF NOT EXISTS node_type text,
  ADD COLUMN IF NOT EXISTS sla_hours integer;

ALTER TABLE public.workflow_edges
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid;

-- backfill workflow_version_id from existing version_id for consistency
UPDATE public.workflow_nodes SET workflow_version_id = version_id WHERE workflow_version_id IS NULL;
UPDATE public.workflow_edges SET workflow_version_id = version_id WHERE workflow_version_id IS NULL;