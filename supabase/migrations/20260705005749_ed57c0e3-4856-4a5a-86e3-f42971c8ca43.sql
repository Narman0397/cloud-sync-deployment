ALTER TABLE public.pejabat
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pimpinan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pimpinan_type text,
  ADD COLUMN IF NOT EXISTS opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nip text;

CREATE INDEX IF NOT EXISTS pejabat_user_id_idx ON public.pejabat(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pejabat_pimpinan_type_idx ON public.pejabat(pimpinan_type) WHERE pimpinan_type IS NOT NULL;

-- authenticated sudah punya SELECT lewat policy "Pejabat publik baca" untuk row aktif.
-- Pastikan role authenticated & anon boleh SELECT (policy sudah membatasi row).
GRANT SELECT ON public.pejabat TO anon, authenticated;