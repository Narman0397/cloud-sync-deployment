
ALTER TABLE public.signing_certificates
  ADD COLUMN IF NOT EXISTS rotated_from uuid REFERENCES public.signing_certificates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoke_reason text;

CREATE INDEX IF NOT EXISTS idx_signature_requests_status_opd_created
  ON public.signature_requests(status, opd_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signing_certificates_user_active
  ON public.signing_certificates(user_id, is_active);

CREATE OR REPLACE VIEW public.v_dc_kpi
WITH (security_invoker = true)
AS
SELECT
  date_trunc('day', sr.created_at)::date AS day,
  sr.opd_id,
  count(*) FILTER (WHERE sr.status IN ('pending','sent'))                       AS pending,
  count(*) FILTER (WHERE sr.status = 'signed')                                  AS signed,
  count(*) FILTER (WHERE sr.status = 'rejected')                                AS rejected,
  count(*) FILTER (WHERE sr.status = 'expired')                                 AS expired,
  count(*) FILTER (WHERE sr.status = 'failed')                                  AS failed,
  count(*)                                                                      AS total,
  COALESCE(
    avg(EXTRACT(EPOCH FROM (sr.completed_at - sr.sent_at)))
      FILTER (WHERE sr.status = 'signed' AND sr.sent_at IS NOT NULL AND sr.completed_at IS NOT NULL),
    0
  )::numeric AS avg_turnaround_seconds
FROM public.signature_requests sr
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.v_dc_provider_health
WITH (security_invoker = true)
AS
SELECT
  COALESCE(sp.code, 'internal')  AS provider_code,
  COALESCE(sp.name, 'Internal')  AS provider_name,
  COALESCE(sp.status, 'active')  AS provider_status,
  count(*) FILTER (WHERE sr.created_at >= now() - interval '24 hours')                       AS requests_24h,
  count(*) FILTER (WHERE sr.status = 'signed'   AND sr.completed_at >= now() - interval '24 hours') AS signed_24h,
  count(*) FILTER (WHERE sr.status = 'failed'   AND sr.updated_at   >= now() - interval '24 hours') AS failed_24h,
  count(*) FILTER (WHERE sr.status IN ('pending','sent'))                                    AS pending_now,
  max(sr.updated_at)                                                                         AS last_activity_at
FROM public.signature_requests sr
LEFT JOIN public.signature_providers sp ON sp.id = sr.provider_id
GROUP BY 1, 2, 3;

GRANT SELECT ON public.v_dc_kpi TO authenticated;
GRANT SELECT ON public.v_dc_kpi TO service_role;
GRANT SELECT ON public.v_dc_provider_health TO authenticated;
GRANT SELECT ON public.v_dc_provider_health TO service_role;
