-- Batch 1 P0: kunci search_path untuk SECURITY DEFINER & helper publik
ALTER FUNCTION public._bulk_exec(sql text) SET search_path = public, pg_temp;
ALTER FUNCTION public.aset_due_warranty(_days integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.attendance_compliance(_opd uuid, _from date, _to date) SET search_path = public, pg_temp;
ALTER FUNCTION public.attendance_rekap_bulanan(_opd uuid, _tahun integer, _bulan integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_ikm_dashboard(_opd uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_touch_updated_at() SET search_path = public, pg_temp;

-- Cabut hak EXEC _bulk_exec dari semua role yang tak diperlukan (dipakai oleh runner internal saja)
REVOKE EXECUTE ON FUNCTION public._bulk_exec(sql text) FROM PUBLIC, anon, authenticated;