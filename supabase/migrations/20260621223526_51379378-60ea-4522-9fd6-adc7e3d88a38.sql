SET search_path = public;

DO $$ BEGIN
  ALTER TABLE public.form_submissions
    ADD CONSTRAINT form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

ALTER TABLE public.generated_documents ADD COLUMN IF NOT EXISTS template_version integer DEFAULT 1;

DROP FUNCTION IF EXISTS public.attendance_device_alert(uuid);
CREATE OR REPLACE FUNCTION public.attendance_device_alert(_opd_id uuid DEFAULT NULL, _days integer DEFAULT 7)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
REVOKE EXECUTE ON FUNCTION public.attendance_device_alert(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_device_alert(uuid, integer) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rate_limit_increment(text, text, integer, integer, text);
CREATE OR REPLACE FUNCTION public.rate_limit_increment(
  _identifier text DEFAULT NULL, _bucket text DEFAULT NULL,
  _window_seconds integer DEFAULT 60, _max integer DEFAULT 100,
  _scope text DEFAULT NULL, _subject text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT '{"allowed":true,"count":1}'::jsonb
$$;
REVOKE EXECUTE ON FUNCTION public.rate_limit_increment(text, text, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text, text, integer, integer, text, text) TO authenticated, service_role;