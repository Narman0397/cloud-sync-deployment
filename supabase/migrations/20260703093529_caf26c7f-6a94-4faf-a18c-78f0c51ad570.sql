
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='signature_request_signers'
      AND constraint_name='signature_request_signers_request_id_fkey'
  ) THEN
    ALTER TABLE public.signature_request_signers
      ADD CONSTRAINT signature_request_signers_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES public.signature_requests(id) ON DELETE CASCADE;
  END IF;
END $$;
