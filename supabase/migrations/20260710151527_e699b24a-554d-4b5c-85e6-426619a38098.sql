DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_assignments_form_id_fkey'
      AND conrelid = 'public.form_assignments'::regclass
  ) THEN
    ALTER TABLE public.form_assignments
      ADD CONSTRAINT form_assignments_form_id_fkey
      FOREIGN KEY (form_id)
      REFERENCES public.forms(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_targets_form_id_fkey'
      AND conrelid = 'public.form_targets'::regclass
  ) THEN
    ALTER TABLE public.form_targets
      ADD CONSTRAINT form_targets_form_id_fkey
      FOREIGN KEY (form_id)
      REFERENCES public.forms(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_assignments_user_id_fkey'
      AND conrelid = 'public.form_assignments'::regclass
  ) THEN
    ALTER TABLE public.form_assignments
      ADD CONSTRAINT form_assignments_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_form_assignments_user_assigned_at
  ON public.form_assignments (user_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_assignments_form_id
  ON public.form_assignments (form_id);

CREATE INDEX IF NOT EXISTS idx_form_targets_form_id
  ON public.form_targets (form_id);

NOTIFY pgrst, 'reload schema';