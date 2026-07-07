SET search_path = public;

ALTER TABLE public.workflow_definitions ADD COLUMN IF NOT EXISTS form_id uuid;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asn_type text;

ALTER TABLE public.workflow_nodes
  ALTER COLUMN code DROP NOT NULL,
  ALTER COLUMN type DROP NOT NULL,
  ALTER COLUMN version_id DROP NOT NULL;

ALTER TABLE public.workflow_edges
  ADD COLUMN IF NOT EXISTS from_node text,
  ADD COLUMN IF NOT EXISTS to_node text,
  ALTER COLUMN source_node DROP NOT NULL,
  ALTER COLUMN target_node DROP NOT NULL,
  ALTER COLUMN version_id DROP NOT NULL;