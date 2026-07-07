
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS publish_requested_by uuid,
  ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_approved_by uuid,
  ADD COLUMN IF NOT EXISTS publish_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_reject_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forms_publish_status_chk') THEN
    ALTER TABLE public.forms ADD CONSTRAINT forms_publish_status_chk
      CHECK (publish_status IN ('draft','requested','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_forms_public_published
  ON public.forms (status, is_public, published_at DESC)
  WHERE status = 'published' AND is_public = true;

CREATE INDEX IF NOT EXISTS idx_forms_search_trgm_title
  ON public.forms USING gin (judul gin_trgm_ops);

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS parallel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opd_id uuid,
  channel text NOT NULL CHECK (channel IN ('email','push','inapp','wa')),
  key text NOT NULL,
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (opd_id, channel, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_tpl_admin_all" ON public.notification_templates;
CREATE POLICY "notif_tpl_admin_all" ON public.notification_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_opd'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_opd'));

DROP POLICY IF EXISTS "notif_tpl_read_all_auth" ON public.notification_templates;
CREATE POLICY "notif_tpl_read_all_auth" ON public.notification_templates
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.retention_policies (entity, retention_days, enabled)
VALUES ('digital_signatures_revoked', 90, true)
ON CONFLICT (entity) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_signature_events_created
  ON public.signature_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signature_events_event
  ON public.signature_events (event, created_at DESC);
