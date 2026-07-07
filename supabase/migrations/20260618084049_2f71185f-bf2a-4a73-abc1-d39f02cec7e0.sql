DROP FUNCTION IF EXISTS public._bootstrap_exec_many(text[]);
CREATE OR REPLACE FUNCTION public._bootstrap_exec_many(_sqls text[]) RETURNS TABLE(idx int, ok boolean, err text) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE i int;
BEGIN
  FOR i IN array_lower(_sqls,1)..array_upper(_sqls,1) LOOP
    BEGIN
      EXECUTE _sqls[i];
      idx := i; ok := true; err := NULL; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      idx := i; ok := false; err := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public._bootstrap_exec_many(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bootstrap_exec_many(text[]) TO authenticated, service_role;