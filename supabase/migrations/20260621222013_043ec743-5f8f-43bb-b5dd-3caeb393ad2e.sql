SET search_path = public;

ALTER TABLE public.form_wizard_drafts ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS external_signer_id text;

ALTER TABLE public.signature_providers
  ADD COLUMN IF NOT EXISTS webhook_secret text;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS external_request_id text,
  ADD COLUMN IF NOT EXISTS file_hash text;

ALTER TABLE public.form_audit_logs ALTER COLUMN resource DROP NOT NULL;