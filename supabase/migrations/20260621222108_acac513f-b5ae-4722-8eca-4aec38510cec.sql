SET search_path = public;

DROP TYPE IF EXISTS public.employment_type;
CREATE TYPE public.employment_type AS ENUM ('PNS','PPPK','PPPK_PW','NON_ASN','THL');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending';

ALTER TABLE public.submission_tasks
  ADD COLUMN IF NOT EXISTS node_key text,
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS submission_id uuid;

ALTER TABLE public.workflow_audit_logs
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;