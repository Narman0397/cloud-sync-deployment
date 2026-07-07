
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS publish_requested_by uuid,
  ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_approved_by uuid,
  ADD COLUMN IF NOT EXISTS publish_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_reject_reason text;

DROP FUNCTION IF EXISTS public.rate_limit_increment(text,integer,integer,text);
DROP FUNCTION IF EXISTS public.rate_limit_increment(text,integer,integer);
CREATE OR REPLACE FUNCTION public.rate_limit_increment(_scope text, _subject text, _window_start timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _n integer;
BEGIN
  INSERT INTO public.rate_limit(scope, subject, window_start, hits)
    VALUES (_scope, _subject, _window_start, 1)
    ON CONFLICT (scope, subject, window_start) DO UPDATE SET hits = public.rate_limit.hits + 1
    RETURNING hits INTO _n;
  RETURN _n;
EXCEPTION WHEN others THEN RETURN 1;
END $$;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text,text,timestamptz) TO authenticated, service_role;
