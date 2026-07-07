CREATE OR REPLACE FUNCTION public._bootstrap_exec_many(_sqls text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY _sqls LOOP
    EXECUTE s;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._bootstrap_exec_many(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bootstrap_exec_many(text[]) TO authenticated, service_role;