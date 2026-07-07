SET search_path = public;

ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS current_workflow_version_id uuid;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.submission_assignments
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS due_at timestamptz;