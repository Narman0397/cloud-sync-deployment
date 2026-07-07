CREATE OR REPLACE FUNCTION public._lovable_exec_sql(_sql text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN EXECUTE _sql; END $fn$;
REVOKE ALL ON FUNCTION public._lovable_exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._lovable_exec_sql(text) TO authenticated, service_role;