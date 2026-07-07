
DROP FUNCTION IF EXISTS public._lovable_exec_sql(text);
DROP FUNCTION IF EXISTS public._bootstrap_exec(text);

ALTER VIEW IF EXISTS public.aset_nilai_buku SET (security_invoker = on);

DROP POLICY IF EXISTS "fal_insert" ON public.form_audit_logs;
CREATE POLICY "fal_insert" ON public.form_audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "wal_insert" ON public.workflow_audit_logs;
CREATE POLICY "wal_insert" ON public.workflow_audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sigevt insert auth" ON public.signature_events;
CREATE POLICY "sigevt_insert_auth" ON public.signature_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ikm_responses_insert" ON public.ikm_responses;
CREATE POLICY "ikm_responses_insert" ON public.ikm_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (survey_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ikm_surveys s WHERE s.id = survey_id AND COALESCE(s.aktif,true)
  ));

DROP POLICY IF EXISTS "lap_ins" ON public.laporan_masyarakat;
DROP POLICY IF EXISTS "Publik kirim laporan" ON public.laporan_masyarakat;
CREATE POLICY "laporan_masyarakat_insert" ON public.laporan_masyarakat
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    nama IS NOT NULL AND length(btrim(nama)) > 0
    AND email IS NOT NULL AND length(btrim(email)) > 0
    AND uraian IS NOT NULL AND length(btrim(uraian)) > 0
    AND kategori IS NOT NULL
  );

REVOKE EXECUTE ON FUNCTION public.executive_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.opd_rating_agg() FROM anon;
REVOKE EXECUTE ON FUNCTION public.opd_kinerja_agg() FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_permohonan_bulan_ini() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_pemohon_in_admin_desa(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_profile_pemohon_in_admin_opd(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO service_role;

DROP FUNCTION IF EXISTS public.fn_approve_user(uuid);
DROP FUNCTION IF EXISTS public.attendance_compliance(uuid, date, date);
DROP FUNCTION IF EXISTS public.rate_limit_increment(text, text, timestamptz);

ALTER FUNCTION public.tg_bump_version_number() SET search_path = public;
ALTER FUNCTION public.tg_pengajuan_izin_set_saldo_flag() SET search_path = public;
