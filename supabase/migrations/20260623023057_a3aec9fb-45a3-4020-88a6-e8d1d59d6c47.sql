ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_forms_deleted_at ON public.forms(deleted_at);