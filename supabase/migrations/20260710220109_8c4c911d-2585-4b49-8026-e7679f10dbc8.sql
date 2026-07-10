
ALTER TABLE public.master_jabatan ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

INSERT INTO public.master_jabatan (kode, nama, kategori, system_position, urutan, aktif, is_system) VALUES
('SYS_KEPALA_OPD', 'Kepala OPD', 'Struktural', 'kepala_opd', 10, true, true),
('SYS_SEKRETARIS', 'Sekretaris', 'Struktural', 'sekretaris', 20, true, true),
('SYS_KEPALA_BIDANG', 'Kepala Bidang', 'Struktural', 'kepala_bidang', 30, true, true),
('SYS_KEPALA_SEKOLAH', 'Kepala Sekolah', 'Struktural', 'kepala_sekolah', 40, true, true),
('SYS_OPERATOR', 'Operator', 'Fungsional', 'operator', 50, true, true),
('SYS_VERIFIKATOR', 'Verifikator', 'Fungsional', 'verifikator', 60, true, true),
('SYS_STAFF', 'Staff', 'Pelaksana', 'staff', 70, true, true),
('SYS_GURU', 'Guru', 'Fungsional', 'guru', 80, true, true),
('SYS_TENAGA_TEKNIS', 'Tenaga Teknis', 'Fungsional', 'tenaga_teknis', 90, true, true),
('SYS_LAINNYA', 'Lainnya', 'Umum', 'lainnya', 100, true, true)
ON CONFLICT (kode) DO UPDATE SET
  is_system = true,
  system_position = EXCLUDED.system_position,
  nama = CASE WHEN public.master_jabatan.is_system THEN EXCLUDED.nama ELSE public.master_jabatan.nama END,
  aktif = true;

CREATE OR REPLACE FUNCTION public.protect_system_jabatan() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'Jabatan sistem tidak dapat dihapus';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system THEN
    IF NEW.is_system = false THEN
      RAISE EXCEPTION 'Status jabatan sistem tidak dapat diubah';
    END IF;
    IF NEW.system_position IS DISTINCT FROM OLD.system_position THEN
      RAISE EXCEPTION 'Klasifikasi jabatan sistem tidak dapat diubah';
    END IF;
    IF NEW.kode IS DISTINCT FROM OLD.kode THEN
      RAISE EXCEPTION 'Kode jabatan sistem tidak dapat diubah';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_system_jabatan ON public.master_jabatan;
CREATE TRIGGER trg_protect_system_jabatan
BEFORE UPDATE OR DELETE ON public.master_jabatan
FOR EACH ROW EXECUTE FUNCTION public.protect_system_jabatan();
