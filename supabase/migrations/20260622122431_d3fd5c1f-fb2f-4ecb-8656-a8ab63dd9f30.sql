-- Restore EXECUTE for anon on read-only public aggregate RPCs used by public pages.
-- These are SECURITY DEFINER aggregates with no row-level data exposure beyond
-- counts/averages that the public Kinerja OPD / IKM pages already display.

DO $$
DECLARE
  fn text;
  public_fns text[] := ARRAY[
    'opd_kinerja_agg()',
    'opd_rating_agg()',
    'opd_skor_komposit()',
    'opd_kinerja_trend(uuid,uuid,integer)',
    'layanan_kinerja_agg(uuid,uuid)',
    'opd_kategori_benchmark(text)',
    'opd_attendance_today(uuid)',
    'aset_compliance(uuid)',
    'fn_ikm_dashboard(uuid,uuid)',
    'executive_summary()',
    'count_permohonan_bulan_ini()'
  ];
BEGIN
  FOREACH fn IN ARRAY public_fns LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Skip missing function: %', fn;
    END;
  END LOOP;
END $$;