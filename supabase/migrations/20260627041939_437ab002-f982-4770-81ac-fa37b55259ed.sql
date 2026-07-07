-- Harden SECURITY DEFINER function permissions.
-- Fixes Supabase linter warnings 0028 (anon execute) and 0029 (authenticated execute).
-- Strategy:
--   1. Revoke EXECUTE from PUBLIC, anon, authenticated for ALL public SECURITY DEFINER functions.
--   2. Grant EXECUTE to service_role for all of them (cron / admin work).
--   3. Re-grant to authenticated only the functions that are legitimate RPCs called by the app.
--   Trigger functions (tg_*, sync_*, handle_new_user, log_*, set_*, prevent_*) do NOT need
--   any direct EXECUTE grant — they run as table owner inside the trigger.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')' AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ============================================================
-- Re-grant to authenticated only the functions that are
-- legitimately called from the signed-in client/RPC.
-- ============================================================

-- Role / permission helpers
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_opd(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_desa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_pemda(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_bupati(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_executive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pimpinan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_elevated_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pemohon_in_admin_opd(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pemohon_in_admin_desa(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pemohon_in_admin_desa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_profile_pemohon_in_admin_opd(uuid) TO authenticated;

-- Permohonan / disposisi / nomor surat
GRANT EXECUTE ON FUNCTION public.fn_approve_user(uuid, app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reject_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_disposition(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_complete_disposition(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_permohonan_bulan_ini() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text, text, integer, integer, text, text) TO authenticated;

-- Dashboard / governance / analytics (semua sudah cek role di body / safe untuk auth user)
GRANT EXECUTE ON FUNCTION public.governance_inventory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.executive_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.production_health_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.opd_kinerja_agg() TO authenticated;
GRANT EXECUTE ON FUNCTION public.opd_kinerja_trend(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.opd_rating_agg() TO authenticated;
GRANT EXECUTE ON FUNCTION public.layanan_kinerja_agg() TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_device_alert(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rating_list_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_signed_document_status(uuid) TO authenticated;

-- Cron-only / maintenance — service_role only, do NOT grant authenticated:
--   fn_expire_signed_document_tokens, fn_retention_cleanup, fn_susut_bulanan_run