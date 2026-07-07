
CREATE OR REPLACE FUNCTION public.fwd_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.form_wizard_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE,
  step TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX form_wizard_drafts_user_idx ON public.form_wizard_drafts(user_id, updated_at DESC);
CREATE INDEX form_wizard_drafts_form_idx ON public.form_wizard_drafts(form_id) WHERE form_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_wizard_drafts TO authenticated;
GRANT ALL ON public.form_wizard_drafts TO service_role;

ALTER TABLE public.form_wizard_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wizard_drafts_owner_select" ON public.form_wizard_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wizard_drafts_owner_insert" ON public.form_wizard_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wizard_drafts_owner_update" ON public.form_wizard_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wizard_drafts_owner_delete" ON public.form_wizard_drafts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER fwd_updated_at
  BEFORE UPDATE ON public.form_wizard_drafts
  FOR EACH ROW EXECUTE FUNCTION public.fwd_set_updated_at();
