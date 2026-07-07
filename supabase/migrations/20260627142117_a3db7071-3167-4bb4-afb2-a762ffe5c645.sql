DROP TABLE IF EXISTS public._role_probe;
CREATE OR REPLACE FUNCTION public._bulk_exec(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE sql; END $$;
ALTER FUNCTION public._bulk_exec(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public._bulk_exec(text) TO sandbox_exec;