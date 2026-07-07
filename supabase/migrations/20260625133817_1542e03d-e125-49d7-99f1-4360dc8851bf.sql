CREATE OR REPLACE FUNCTION public._lovable_exec_sql(_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$ BEGIN EXECUTE _sql; END $f$;
REVOKE ALL ON FUNCTION public._lovable_exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._lovable_exec_sql(text) TO service_role;