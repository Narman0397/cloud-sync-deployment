CREATE OR REPLACE FUNCTION public._lovable_bootstrap_exec(p_sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $f$ BEGIN EXECUTE p_sql; END $f$;
ALTER FUNCTION public._lovable_bootstrap_exec(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._lovable_bootstrap_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lovable_bootstrap_exec(text) TO sandbox_exec, service_role;
SELECT proowner::regrole::text AS owner, prosecdef FROM pg_proc WHERE proname='_lovable_bootstrap_exec';