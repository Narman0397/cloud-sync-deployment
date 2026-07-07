
ALTER TABLE public.master_jabatan
  ADD COLUMN IF NOT EXISTS system_position text;
CREATE INDEX IF NOT EXISTS ix_master_jabatan_system_position
  ON public.master_jabatan(system_position) WHERE system_position IS NOT NULL;

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS reject_reason_code text,
  ADD COLUMN IF NOT EXISTS sequence_group integer;
CREATE INDEX IF NOT EXISTS ix_srs_sequence_group
  ON public.signature_request_signers(request_id, sequence_group);

ALTER TABLE public.permohonan
  ADD COLUMN IF NOT EXISTS rejection_reason_code text;
