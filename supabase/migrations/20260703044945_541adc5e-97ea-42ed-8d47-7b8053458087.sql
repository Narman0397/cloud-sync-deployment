CREATE OR REPLACE FUNCTION public._lovable_bootstrap_exec(_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN EXECUTE _sql; END $$;
ALTER FUNCTION public._lovable_bootstrap_exec(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public._lovable_bootstrap_exec(text) TO sandbox_exec, service_role;
REVOKE EXECUTE ON FUNCTION public._lovable_bootstrap_exec(text) FROM PUBLIC, anon, authenticated;