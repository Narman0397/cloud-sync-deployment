SET search_path = public;

ALTER TABLE public.workflow_versions
  ADD COLUMN IF NOT EXISTS graph jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_count integer DEFAULT 0;

ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.workflow_audit_logs
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_id text;