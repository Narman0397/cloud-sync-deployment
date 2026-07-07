
ALTER TABLE public.opd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App setting publik baca" ON public.app_setting;
CREATE POLICY "App setting publik baca" ON public.app_setting
  FOR SELECT TO anon, authenticated
  USING (public_visible = true);

DROP POLICY IF EXISTS "Rating publik baca" ON public.permohonan_rating;
CREATE POLICY "Rating login baca" ON public.permohonan_rating
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin OPD lihat laporan" ON public.laporan_masyarakat;
CREATE POLICY "Admin OPD lihat laporan" ON public.laporan_masyarakat
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin_opd'::public.app_role)
    AND (opd_id IS NULL OR opd_id = public.get_user_opd(auth.uid()))
  );

DROP POLICY IF EXISTS "Publik kirim laporan" ON public.laporan_masyarakat;
CREATE POLICY "Publik kirim laporan" ON public.laporan_masyarakat
  FOR INSERT TO anon, authenticated
  WITH CHECK (status IS NULL OR status = 'baru');

DROP POLICY IF EXISTS "Aset baca login" ON public.aset;
CREATE POLICY "Aset baca scoped" ON public.aset
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bkpsdm'::public.app_role)
    OR public.has_role(auth.uid(), 'pimpinan'::public.app_role)
    OR opd_id = public.get_user_opd(auth.uid())
  );

DROP POLICY IF EXISTS "Kantor QR baca login" ON public.kantor_qr;
CREATE POLICY "Kantor QR baca scoped" ON public.kantor_qr
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role)
    OR opd_id = public.get_user_opd(auth.uid())
  );

ALTER VIEW public.v_permohonan_overdue SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.aset_compliance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aset_due_warranty(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_compliance(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_device_alert(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_rekap_bulanan(integer, integer, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.executive_summary(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_approve_user(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_reject_user(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ikm_dashboard(date, date, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_susut_bulanan_run(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_generate_nomor_surat(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_permohonan_effective_sla_seconds(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_next_number(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_next_number(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_next_number(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.governance_summary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.layanan_kinerja_agg(date, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opd_attendance_today(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opd_kategori_benchmark(date, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opd_kinerja_agg(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opd_kinerja_trend(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opd_rating_agg(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.opd_skor_komposit(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_health_score() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_increment(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rating_list_admin(date, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.riwayat_dengan_petugas(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_effective_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_opd(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_desa(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.count_permohonan_bulan_ini() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.count_permohonan_bulan_ini() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_opd(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_desa(uuid) TO authenticated;

DROP POLICY IF EXISTS "Private buckets owner read" ON storage.objects;
CREATE POLICY "Private buckets owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('berkas-permohonan','signatures','signed-documents','aset-foto','share-files','branding','pejabat-foto')
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS "Private buckets owner write" ON storage.objects;
CREATE POLICY "Private buckets owner write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('berkas-permohonan','signatures','signed-documents','aset-foto','share-files','branding','pejabat-foto')
    AND owner = auth.uid()
  );

DROP POLICY IF EXISTS "Private buckets owner update" ON storage.objects;
CREATE POLICY "Private buckets owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('berkas-permohonan','signatures','signed-documents','aset-foto','share-files','branding','pejabat-foto')
    AND owner = auth.uid()
  )
  WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS "Private buckets owner delete" ON storage.objects;
CREATE POLICY "Private buckets owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('berkas-permohonan','signatures','signed-documents','aset-foto','share-files','branding','pejabat-foto')
    AND owner = auth.uid()
  );
