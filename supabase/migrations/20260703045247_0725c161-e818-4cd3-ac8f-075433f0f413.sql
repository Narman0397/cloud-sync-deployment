CREATE OR REPLACE FUNCTION public._lovable_bootstrap_exec(_sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $f$ BEGIN EXECUTE _sql; END $f$;
ALTER FUNCTION public._lovable_bootstrap_exec(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._lovable_bootstrap_exec(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._lovable_bootstrap_exec(text) TO sandbox_exec, service_role;