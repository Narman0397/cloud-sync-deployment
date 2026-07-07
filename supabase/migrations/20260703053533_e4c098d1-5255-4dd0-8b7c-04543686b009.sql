
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS generated_document_id uuid REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS doc_number text;

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS position jsonb,
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.signature_providers
  ADD COLUMN IF NOT EXISTS webhook_secret text;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS doc_number text;
