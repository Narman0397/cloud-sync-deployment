
-- Providers
CREATE TABLE public.signature_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mock','bsre','esign','custom')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.signature_providers TO authenticated;
GRANT ALL ON public.signature_providers TO service_role;
ALTER TABLE public.signature_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers select auth" ON public.signature_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers manage super" ON public.signature_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_signature_providers_updated BEFORE UPDATE ON public.signature_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.signature_providers (code,name,kind,status,config) VALUES
  ('mock','Mock Provider (Testing)','mock','active','{}'::jsonb),
  ('bsre','BSrE','bsre','disabled','{"base_url":"https://bsre.example/api"}'::jsonb),
  ('esign','e-Sign','esign','disabled','{"base_url":"https://esign.example/api"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- Requests
CREATE TABLE public.signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_document_id uuid NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  submission_id uuid,
  provider_id uuid NOT NULL REFERENCES public.signature_providers(id),
  mode text NOT NULL DEFAULT 'sequential' CHECK (mode IN ('sequential','parallel')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','sent','signed','rejected','expired','cancelled','failed')),
  external_request_id text,
  file_hash text,
  current_step integer NOT NULL DEFAULT 0,
  opd_id uuid,
  created_by uuid REFERENCES auth.users(id),
  sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sigreq_doc ON public.signature_requests(generated_document_id);
CREATE INDEX idx_sigreq_status ON public.signature_requests(status);
CREATE INDEX idx_sigreq_provider ON public.signature_requests(provider_id);
CREATE INDEX idx_sigreq_opd ON public.signature_requests(opd_id);
GRANT SELECT ON public.signature_requests TO authenticated;
GRANT ALL ON public.signature_requests TO service_role;
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sigreq select scoped" ON public.signature_requests FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(),'super_admin')
  OR public.has_role(auth.uid(),'admin_pemda')
  OR (public.has_role(auth.uid(),'admin_opd') AND opd_id = public.get_user_opd(auth.uid()))
);
CREATE POLICY "sigreq manage super" ON public.signature_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_sigreq_updated BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signers
CREATE TABLE public.signature_request_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  signer_type text NOT NULL CHECK (signer_type IN ('user','role','position')),
  user_id uuid REFERENCES auth.users(id),
  role text,
  position text,
  opd_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','signed','rejected','expired','cancelled')),
  external_signer_id text,
  signed_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sigsigner_req ON public.signature_request_signers(request_id);
GRANT SELECT ON public.signature_request_signers TO authenticated;
GRANT ALL ON public.signature_request_signers TO service_role;
ALTER TABLE public.signature_request_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sigsigner select via req" ON public.signature_request_signers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.signature_requests r WHERE r.id = request_id AND (
    r.created_by = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR (public.has_role(auth.uid(),'admin_opd') AND r.opd_id = public.get_user_opd(auth.uid()))
    OR signature_request_signers.user_id = auth.uid()
  ))
);
CREATE TRIGGER trg_sigsigner_updated BEFORE UPDATE ON public.signature_request_signers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Events (immutable)
CREATE TABLE public.signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES public.signature_request_signers(id) ON DELETE SET NULL,
  event text NOT NULL CHECK (event IN ('requested','sent','viewed','signed','rejected','expired','cancelled','downloaded','webhook_received','retry','failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sigevt_req ON public.signature_events(request_id, created_at DESC);
GRANT SELECT, INSERT ON public.signature_events TO authenticated;
GRANT ALL ON public.signature_events TO service_role;
ALTER TABLE public.signature_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sigevt select via req" ON public.signature_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.signature_requests r WHERE r.id = request_id AND (
    r.created_by = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR (public.has_role(auth.uid(),'admin_opd') AND r.opd_id = public.get_user_opd(auth.uid()))
  ))
);
CREATE POLICY "sigevt insert auth" ON public.signature_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_signature_events_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'signature_events is immutable (operation %)', TG_OP; END $$;
CREATE TRIGGER trg_sigevt_immutable BEFORE UPDATE OR DELETE ON public.signature_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_signature_events_immutable();
