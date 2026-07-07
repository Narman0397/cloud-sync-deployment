CREATE OR REPLACE FUNCTION public._bootstrap_exec(_sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE _sql; END; $$;
REVOKE ALL ON FUNCTION public._bootstrap_exec(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bootstrap_exec(text) TO authenticated, service_role;