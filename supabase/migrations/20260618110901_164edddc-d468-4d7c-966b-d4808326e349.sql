-- Batch C: drop duplicate INSERT policy on laporan_masyarakat
DROP POLICY IF EXISTS "lap_ins" ON public.laporan_masyarakat;