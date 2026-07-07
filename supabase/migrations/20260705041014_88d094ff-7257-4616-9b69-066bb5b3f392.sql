-- ============================================================
-- FASE 1 — Standar Pelayanan lengkap
-- ============================================================
ALTER TABLE public.layanan_publik
  ADD COLUMN IF NOT EXISTS dasar_hukum text,
  ADD COLUMN IF NOT EXISTS biaya text,
  ADD COLUMN IF NOT EXISTS produk_layanan text,
  ADD COLUMN IF NOT EXISTS jam_pelayanan text,
  ADD COLUMN IF NOT EXISTS sarana_prasarana text,
  ADD COLUMN IF NOT EXISTS kompetensi_pelaksana text,
  ADD COLUMN IF NOT EXISTS jumlah_pelaksana integer,
  ADD COLUMN IF NOT EXISTS jaminan_pelayanan text,
  ADD COLUMN IF NOT EXISTS jaminan_keamanan text,
  ADD COLUMN IF NOT EXISTS mekanisme_pengaduan text,
  ADD COLUMN IF NOT EXISTS evaluasi_kinerja text,
  ADD COLUMN IF NOT EXISTS maklumat_pelayanan text,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- FASE 2 — Laporan Masyarakat: nomor tiket & pelapor
-- ============================================================
ALTER TABLE public.laporan_masyarakat
  ADD COLUMN IF NOT EXISTS ticket_code text,
  ADD COLUMN IF NOT EXISTS pelapor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Sequence untuk nomor tiket per tahun
CREATE TABLE IF NOT EXISTS public.laporan_ticket_sequence (
  tahun integer PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.laporan_ticket_sequence TO authenticated;
GRANT ALL ON public.laporan_ticket_sequence TO service_role;
ALTER TABLE public.laporan_ticket_sequence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seq_service_only" ON public.laporan_ticket_sequence;
CREATE POLICY "seq_service_only" ON public.laporan_ticket_sequence FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fungsi generate nomor tiket: LAPOR-YYYY-000001
CREATE OR REPLACE FUNCTION public.fn_generate_laporan_ticket()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y integer := EXTRACT(YEAR FROM now())::int;
  s integer;
BEGIN
  INSERT INTO public.laporan_ticket_sequence(tahun, last_seq)
    VALUES (y, 1)
  ON CONFLICT (tahun) DO UPDATE
    SET last_seq = public.laporan_ticket_sequence.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO s;
  RETURN 'LAPOR-' || y::text || '-' || lpad(s::text, 6, '0');
END $$;

-- Trigger: auto-assign ticket_code saat INSERT
CREATE OR REPLACE FUNCTION public.trg_laporan_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_code IS NULL OR NEW.ticket_code = '' THEN
    NEW.ticket_code := public.fn_generate_laporan_ticket();
  END IF;
  IF NEW.pelapor_id IS NULL THEN
    NEW.pelapor_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS laporan_before_insert ON public.laporan_masyarakat;
CREATE TRIGGER laporan_before_insert
  BEFORE INSERT ON public.laporan_masyarakat
  FOR EACH ROW EXECUTE FUNCTION public.trg_laporan_before_insert();

-- Backfill ticket_code untuk baris lama
UPDATE public.laporan_masyarakat
SET ticket_code = public.fn_generate_laporan_ticket()
WHERE ticket_code IS NULL;

-- Unique setelah backfill
CREATE UNIQUE INDEX IF NOT EXISTS laporan_ticket_code_uidx
  ON public.laporan_masyarakat(ticket_code);

-- RLS policy: pelapor dapat SELECT laporan sendiri (policy admin/OPD tetap dari policy existing)
DROP POLICY IF EXISTS "pelapor_read_own" ON public.laporan_masyarakat;
CREATE POLICY "pelapor_read_own" ON public.laporan_masyarakat
  FOR SELECT TO authenticated
  USING (pelapor_id = auth.uid());
