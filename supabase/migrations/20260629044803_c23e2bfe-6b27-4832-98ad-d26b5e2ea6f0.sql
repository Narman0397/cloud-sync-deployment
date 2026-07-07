-- Helper: drop any existing policies we own (idempotent)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname LIKE 'lov_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.polname);
  END LOOP;
END$$;

-- ===== branding (logo / aset publik) =====
CREATE POLICY "lov_branding_read_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');
CREATE POLICY "lov_branding_write_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  ));
CREATE POLICY "lov_branding_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  ));
CREATE POLICY "lov_branding_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  ));

-- ===== pejabat-foto (foto pejabat publik) =====
CREATE POLICY "lov_pejabat_read_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'pejabat-foto');
CREATE POLICY "lov_pejabat_write_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pejabat-foto' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  ));
CREATE POLICY "lov_pejabat_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pejabat-foto' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  ));
CREATE POLICY "lov_pejabat_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pejabat-foto' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
  ));

-- ===== berkas-permohonan (folder = pemohon_id/...) =====
CREATE POLICY "lov_berkas_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'berkas-permohonan' AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
    OR public.has_role(auth.uid(),'admin_desa')
  ));
CREATE POLICY "lov_berkas_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'berkas-permohonan' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lov_berkas_update_owner" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'berkas-permohonan' AND owner = auth.uid());
CREATE POLICY "lov_berkas_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'berkas-permohonan' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));

-- ===== absensi-foto (folder = user_id/yyyy-mm/...) =====
CREATE POLICY "lov_absensi_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'absensi-foto' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
    OR public.has_role(auth.uid(),'admin_bkpsdm')
    OR public.has_role(auth.uid(),'kepala_bkpsdm')
  ));
CREATE POLICY "lov_absensi_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'absensi-foto' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lov_absensi_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'absensi-foto' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
  ));

-- ===== form-submissions (folder = submission_id/...; akses via server fn) =====
CREATE POLICY "lov_formsub_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'form-submissions' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));
CREATE POLICY "lov_formsub_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-submissions' AND auth.uid() IS NOT NULL);
CREATE POLICY "lov_formsub_update_owner" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'form-submissions' AND owner = auth.uid());
CREATE POLICY "lov_formsub_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'form-submissions' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));

-- ===== aset-foto (admin OPD pemilik aset) =====
CREATE POLICY "lov_aset_read_admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'aset-foto' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
    OR public.has_role(auth.uid(),'asn')
  ));
CREATE POLICY "lov_aset_write_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'aset-foto' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));
CREATE POLICY "lov_aset_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'aset-foto' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));
CREATE POLICY "lov_aset_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'aset-foto' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));

-- ===== share-files (paket berbagi data: admin only; akses publik via signed URL) =====
CREATE POLICY "lov_share_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'share-files' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ))
  WITH CHECK (bucket_id = 'share-files' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
  ));

-- ===== signatures (spesimen TTD; folder user_id/) =====
CREATE POLICY "lov_sig_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
  ));
CREATE POLICY "lov_sig_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "lov_sig_update_owner" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signatures' AND owner = auth.uid());
CREATE POLICY "lov_sig_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signatures' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
  ));

-- ===== signed-documents (PDF hasil TTE; ditulis oleh server fn) =====
CREATE POLICY "lov_signed_read_admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signed-documents' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
    OR public.has_role(auth.uid(),'asn')
    OR public.has_role(auth.uid(),'pimpinan')
  ));
CREATE POLICY "lov_signed_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signed-documents' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
    OR public.has_role(auth.uid(),'asn')
  ));
CREATE POLICY "lov_signed_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signed-documents' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
  ));
CREATE POLICY "lov_signed_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'signed-documents' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
  ));

-- ===== verification-assets (bukti verifikasi) =====
CREATE POLICY "lov_verif_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-assets' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')
    OR public.has_role(auth.uid(),'admin_desa')
    OR public.has_role(auth.uid(),'admin_bkpsdm')
  ));
CREATE POLICY "lov_verif_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "lov_verif_update_owner" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-assets' AND owner = auth.uid());
CREATE POLICY "lov_verif_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-assets' AND (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin_pemda')
  ));