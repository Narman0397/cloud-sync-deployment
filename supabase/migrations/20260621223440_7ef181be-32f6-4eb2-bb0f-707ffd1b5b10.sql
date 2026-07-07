SET search_path = public;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pimpinan';

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS request_id text;
ALTER TABLE public.app_setting ADD COLUMN IF NOT EXISTS category text DEFAULT 'internal';

-- FKs so PostgREST can embed
DO $$ BEGIN
  ALTER TABLE public.signature_request_signers
    ADD CONSTRAINT signature_request_signers_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.signature_requests(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.signature_requests
    ADD CONSTRAINT signature_requests_generated_document_id_fkey
    FOREIGN KEY (generated_document_id) REFERENCES public.generated_documents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- rate_limit_increment accept _scope alias
DROP FUNCTION IF EXISTS public.rate_limit_increment(text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.rate_limit_increment(
  _identifier text, _bucket text, _window_seconds integer DEFAULT 60,
  _max integer DEFAULT 100, _scope text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT '{"allowed":true,"count":1}'::jsonb
$$;
REVOKE EXECUTE ON FUNCTION public.rate_limit_increment(text, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text, text, integer, integer, text) TO authenticated, service_role;

-- attendance_compliance final overload set: ensure (_opd_id, _days) covers the asn-izin call
DROP FUNCTION IF EXISTS public.attendance_compliance(uuid, date, date, integer, uuid);
CREATE OR REPLACE FUNCTION public.attendance_compliance(
  _opd_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL,
  _days integer DEFAULT NULL, _user_id uuid DEFAULT NULL, _bulan integer DEFAULT NULL, _tahun integer DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
REVOKE EXECUTE ON FUNCTION public.attendance_compliance(uuid, date, date, integer, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_compliance(uuid, date, date, integer, uuid, integer, integer) TO authenticated, service_role;