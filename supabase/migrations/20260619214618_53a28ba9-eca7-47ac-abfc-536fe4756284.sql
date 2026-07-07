
DROP POLICY IF EXISTS doc_tpl_select ON storage.objects;
DROP POLICY IF EXISTS doc_tpl_write  ON storage.objects;
CREATE POLICY doc_tpl_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='document-templates' AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
    OR public.has_role(auth.uid(),'admin_opd')));
CREATE POLICY doc_tpl_write ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='document-templates' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd')))
  WITH CHECK (bucket_id='document-templates' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd')));

DROP POLICY IF EXISTS doc_files_select ON storage.objects;
CREATE POLICY doc_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='documents' AND EXISTS(
    SELECT 1 FROM public.generated_documents g
    JOIN public.form_submissions s ON s.id = g.submission_id
    WHERE g.storage_path = storage.objects.name AND (
      public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')
      OR s.user_id = auth.uid() OR s.opd_id = public.get_user_opd(auth.uid())
    )));
