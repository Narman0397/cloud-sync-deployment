
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'PNS';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'PPPK';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'PPPK_PW';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'NON_ASN';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'THL';

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS external_request_id text;
ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS external_signer_id text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS opd_pemilik_id uuid;
