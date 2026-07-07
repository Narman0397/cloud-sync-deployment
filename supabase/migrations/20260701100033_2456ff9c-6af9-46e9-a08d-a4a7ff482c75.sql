
DROP POLICY IF EXISTS "documents_bucket_read_internal" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_write_internal" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_update_internal" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_delete_admin" ON storage.objects;

CREATE POLICY "documents_bucket_read_internal" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_opd'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_desa'::public.app_role)
    OR public.has_role(auth.uid(), 'asn'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bkpsdm'::public.app_role)
    OR public.has_role(auth.uid(), 'kepala_bkpsdm'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role)
    OR public.has_role(auth.uid(), 'pimpinan'::public.app_role)
  )
);

CREATE POLICY "documents_bucket_write_internal" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_opd'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_desa'::public.app_role)
    OR public.has_role(auth.uid(), 'asn'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_bkpsdm'::public.app_role)
    OR public.has_role(auth.uid(), 'kepala_bkpsdm'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role)
  )
);

CREATE POLICY "documents_bucket_update_internal" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_opd'::public.app_role)
  )
);

CREATE POLICY "documents_bucket_delete_admin" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin_opd'::public.app_role)
  )
);
