
ALTER TABLE public.permohonan
  ADD COLUMN IF NOT EXISTS bukti_token text,
  ADD COLUMN IF NOT EXISTS bukti_path text,
  ADD COLUMN IF NOT EXISTS bukti_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS bukti_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS bukti_verified_by uuid,
  ADD COLUMN IF NOT EXISTS bukti_verified_note text;

CREATE UNIQUE INDEX IF NOT EXISTS permohonan_bukti_token_key
  ON public.permohonan (bukti_token)
  WHERE bukti_token IS NOT NULL;
