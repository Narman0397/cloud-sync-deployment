
ALTER TABLE public.layanan_publik
  ADD COLUMN IF NOT EXISTS document_template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tte_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tte_signer_role text;

CREATE INDEX IF NOT EXISTS idx_layanan_publik_template ON public.layanan_publik(document_template_id);
