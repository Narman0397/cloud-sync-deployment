
-- 1. Tambah kolom yang hilang
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE public.master_jabatan ADD COLUMN IF NOT EXISTS urutan INTEGER;

-- 2. Tambah relasi work_schedule.opd_id -> opd.id
ALTER TABLE public.work_schedule ADD COLUMN IF NOT EXISTS opd_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_schedule_opd_id_fkey'
  ) THEN
    ALTER TABLE public.work_schedule
      ADD CONSTRAINT work_schedule_opd_id_fkey
      FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_schedule_opd_id ON public.work_schedule(opd_id);

-- 3. Perbaiki infinite recursion pada policy permohonan <-> profiles
--    Sebelumnya: permohonan policy SELECT profiles, dan profiles policy SELECT permohonan.
--    Solusi: gunakan SECURITY DEFINER helpers agar tidak memicu RLS lain.

CREATE OR REPLACE FUNCTION public.is_pemohon_in_admin_desa(_pemohon_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _pemohon_id
      AND p.desa IS NOT NULL
      AND p.desa = public.get_user_desa(auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_profile_pemohon_in_admin_opd(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permohonan pm
    WHERE pm.pemohon_id = _profile_id
      AND pm.opd_id = public.get_user_opd(auth.uid())
  )
$$;

-- Drop old recursive policies
DROP POLICY IF EXISTS "Admin desa lihat permohonan warga" ON public.permohonan;
DROP POLICY IF EXISTS "Admin lihat profil pemohon" ON public.profiles;

-- Recreate using SECURITY DEFINER helpers (tidak memicu RLS rekursif)
CREATE POLICY "Admin desa lihat permohonan warga"
ON public.permohonan
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_desa'::app_role)
  AND public.is_pemohon_in_admin_desa(pemohon_id)
);

CREATE POLICY "Admin lihat profil pemohon"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin_opd'::app_role)
  AND public.is_profile_pemohon_in_admin_opd(id)
);
