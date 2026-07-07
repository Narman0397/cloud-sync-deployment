
ALTER VIEW IF EXISTS public.v_permohonan_overdue SET (security_invoker = true);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC', r.proname, r.args);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_approve_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_reject_user(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.fn_approve_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_reject_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_desa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_opd(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated;
