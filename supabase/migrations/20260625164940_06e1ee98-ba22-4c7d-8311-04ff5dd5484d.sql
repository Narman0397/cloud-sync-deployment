
-- berkas-permohonan & form-submissions: owner folder = auth.uid()
DO $$ BEGIN
  CREATE POLICY "user_upload_own_folder_permohonan" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('berkas-permohonan','form-submissions')
                AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_read_own_folder_permohonan" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id IN ('berkas-permohonan','form-submissions')
           AND ((storage.foldername(name))[1] = auth.uid()::text
                OR public.has_role(auth.uid(),'super_admin')
                OR public.has_role(auth.uid(),'admin_pemda')
                OR public.has_role(auth.uid(),'admin_opd')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_delete_own_folder_permohonan" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id IN ('berkas-permohonan','form-submissions')
           AND ((storage.foldername(name))[1] = auth.uid()::text
                OR public.has_role(auth.uid(),'super_admin')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- aset-foto & pejabat-foto: admin-only write, authenticated read
DO $$ BEGIN
  CREATE POLICY "admin_write_foto" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('aset-foto','pejabat-foto')
                AND (public.has_role(auth.uid(),'super_admin')
                     OR public.has_role(auth.uid(),'admin_pemda')
                     OR public.has_role(auth.uid(),'admin_opd')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_read_foto" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id IN ('aset-foto','pejabat-foto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_update_foto" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id IN ('aset-foto','pejabat-foto')
           AND (public.has_role(auth.uid(),'super_admin')
                OR public.has_role(auth.uid(),'admin_pemda')
                OR public.has_role(auth.uid(),'admin_opd')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admin_delete_foto" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id IN ('aset-foto','pejabat-foto')
           AND (public.has_role(auth.uid(),'super_admin')
                OR public.has_role(auth.uid(),'admin_pemda')
                OR public.has_role(auth.uid(),'admin_opd')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
