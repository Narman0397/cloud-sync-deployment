
-- 1. Restore EXECUTE for authenticated users on permission resolver
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated;

-- 2. Seed internal signature provider (idempotent, auto-active)
INSERT INTO public.signature_providers (code, name, kind, status, config)
VALUES ('internal','Internal Sistem','internal','active','{}'::jsonb)
ON CONFLICT (code) DO UPDATE
  SET status='active', kind='internal', name='Internal Sistem';

-- 3. Public read policies for branding & pejabat-foto buckets
DROP POLICY IF EXISTS "Public read branding" ON storage.objects;
CREATE POLICY "Public read branding"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('branding','pejabat-foto'));

DROP POLICY IF EXISTS "Admins manage branding" ON storage.objects;
CREATE POLICY "Admins manage branding"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id IN ('branding','pejabat-foto')
    AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd'))
  )
  WITH CHECK (
    bucket_id IN ('branding','pejabat-foto')
    AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd'))
  );
