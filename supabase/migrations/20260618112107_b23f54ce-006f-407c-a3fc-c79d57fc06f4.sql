-- Batch E2 — Aggregate functions: revoke PUBLIC/anon, keep authenticated + service_role.
-- Verified: dipanggil via supabaseAdmin (service_role) atau client authenticated dari kinerja-queries.ts.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'aset_compliance(uuid)',
    'aset_due_warranty(integer)',
    'attendance_compliance(uuid,date,date)',
    'attendance_device_alert(integer)',
    'attendance_rekap_bulanan(uuid,integer,integer)',
    'opd_attendance_today(uuid)',
    'opd_kategori_benchmark(text)',
    'opd_kinerja_agg()',
    'opd_kinerja_trend(uuid,integer)',
    'opd_rating_agg()',
    'opd_skor_komposit()',
    'layanan_kinerja_agg()',
    'fn_ikm_dashboard(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r);
  END LOOP;
END $$;