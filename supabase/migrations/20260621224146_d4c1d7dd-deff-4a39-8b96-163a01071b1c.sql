
ALTER TABLE public.generated_documents ALTER COLUMN file_path DROP NOT NULL;

ALTER TABLE public.document_template_versions
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS template_html text,
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.document_numbering_rules
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ALTER COLUMN reset_per DROP NOT NULL;
