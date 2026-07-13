
-- Storage RLS policies for all app buckets

-- BRANDING (publicly readable via anon SELECT policy; write for admin roles)
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');
CREATE POLICY "branding_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')));
CREATE POLICY "branding_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')));
CREATE POLICY "branding_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')));

-- PEJABAT-FOTO (publicly readable; write for admin roles)
CREATE POLICY "pejabat_foto_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'pejabat-foto');
CREATE POLICY "pejabat_foto_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pejabat-foto' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd')));
CREATE POLICY "pejabat_foto_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pejabat-foto' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd')));
CREATE POLICY "pejabat_foto_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pejabat-foto' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd')));

-- BERKAS-PERMOHONAN (private; path = {permohonan_id}/...)
CREATE POLICY "berkas_permohonan_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'berkas-permohonan' AND EXISTS (
      SELECT 1 FROM public.permohonan p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (
          p.pemohon_id = auth.uid()
          OR public.has_role(auth.uid(),'super_admin')
          OR (public.has_role(auth.uid(),'admin_opd') AND p.opd_id = public.get_user_opd(auth.uid()))
        )
    )
  );
CREATE POLICY "berkas_permohonan_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'berkas-permohonan' AND EXISTS (
      SELECT 1 FROM public.permohonan p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (
          p.pemohon_id = auth.uid()
          OR public.has_role(auth.uid(),'super_admin')
          OR (public.has_role(auth.uid(),'admin_opd') AND p.opd_id = public.get_user_opd(auth.uid()))
        )
    )
  );
CREATE POLICY "berkas_permohonan_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'berkas-permohonan' AND EXISTS (
      SELECT 1 FROM public.permohonan p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (p.pemohon_id = auth.uid() OR public.has_role(auth.uid(),'super_admin')
             OR (public.has_role(auth.uid(),'admin_opd') AND p.opd_id = public.get_user_opd(auth.uid())))
    )
  );
CREATE POLICY "berkas_permohonan_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'berkas-permohonan' AND EXISTS (
      SELECT 1 FROM public.permohonan p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND (p.pemohon_id = auth.uid() OR public.has_role(auth.uid(),'super_admin')
             OR (public.has_role(auth.uid(),'admin_opd') AND p.opd_id = public.get_user_opd(auth.uid())))
    )
  );

-- FORM-SUBMISSIONS (private; path = {form_id}/{user_id}/...)
CREATE POLICY "form_submissions_owner_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'form-submissions' AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.has_role(auth.uid(),'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND public.has_role(auth.uid(),'admin_opd')
          AND f.opd_pemilik_id = public.get_user_opd(auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'form-submissions' AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR public.has_role(auth.uid(),'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND public.has_role(auth.uid(),'admin_opd')
          AND f.opd_pemilik_id = public.get_user_opd(auth.uid())
      )
    )
  );

-- ASET-FOTO (private; path = {opd_id}/...)
CREATE POLICY "aset_foto_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'aset-foto' AND (
      public.has_role(auth.uid(),'super_admin')
      OR (storage.foldername(name))[1] = public.get_user_opd(auth.uid())::text
    )
  )
  WITH CHECK (
    bucket_id = 'aset-foto' AND (
      public.has_role(auth.uid(),'super_admin')
      OR (storage.foldername(name))[1] = public.get_user_opd(auth.uid())::text
    )
  );

-- SIGNATURES (private; path = {user_id}/...)
CREATE POLICY "signatures_owner_all" ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'signatures' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(),'super_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'signatures' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(),'super_admin')
    )
  );

-- SHARE-FILES and SIGNED-DOCUMENTS: writes via service role (bypasses RLS).
-- Allow authenticated admin roles to read (signed URLs bypass RLS anyway).
CREATE POLICY "share_files_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'share-files' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'admin_pemda')
      OR public.has_role(auth.uid(),'admin_opd')
    )
  );

CREATE POLICY "signed_documents_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'signed-documents' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'admin_pemda')
      OR public.has_role(auth.uid(),'admin_opd')
    )
  );
