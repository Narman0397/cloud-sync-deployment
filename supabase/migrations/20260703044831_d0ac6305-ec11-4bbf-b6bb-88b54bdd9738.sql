DO $$
DECLARE r record;
BEGIN
  GRANT USAGE ON SCHEMA auth TO sandbox_exec;
  GRANT REFERENCES, SELECT ON TABLE auth.users TO sandbox_exec;
END $$;
SELECT n.nspname, has_schema_privilege('sandbox_exec', n.oid, 'USAGE') AS usage
FROM pg_namespace n WHERE n.nspname IN ('auth','public');