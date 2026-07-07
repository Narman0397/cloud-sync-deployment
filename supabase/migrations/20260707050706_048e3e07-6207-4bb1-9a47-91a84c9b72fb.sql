
-- P1: signature_delegations — delegasi slot penandatangan TTE
CREATE TABLE IF NOT EXISTS public.signature_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id uuid NOT NULL REFERENCES public.signature_request_signers(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'active',
  delegated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_delegations TO authenticated;
GRANT ALL ON public.signature_delegations TO service_role;

ALTER TABLE public.signature_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sig_deleg_read_own" ON public.signature_delegations
  FOR SELECT TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'admin_opd')
  );

CREATE POLICY "sig_deleg_insert_own" ON public.signature_delegations
  FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "sig_deleg_update_own" ON public.signature_delegations
  FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (from_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS ix_sig_deleg_signer ON public.signature_delegations(signer_id);
CREATE INDEX IF NOT EXISTS ix_sig_deleg_to ON public.signature_delegations(to_user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ix_sig_deleg_from ON public.signature_delegations(from_user_id);

CREATE TRIGGER trg_sig_deleg_updated
  BEFORE UPDATE ON public.signature_delegations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index untuk mempercepat listing inbox signer
CREATE INDEX IF NOT EXISTS ix_srs_user_status
  ON public.signature_request_signers(user_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_srs_deadline
  ON public.signature_request_signers(deadline_at)
  WHERE status = 'pending';
