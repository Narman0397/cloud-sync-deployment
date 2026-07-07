-- 1) Hapus overload rating_list_admin() tanpa argumen agar tidak ambigu
DROP FUNCTION IF EXISTS public.rating_list_admin();

-- Ganti rating_list_admin(date,date) agar mengembalikan kolom lengkap yang dibutuhkan UI
DROP FUNCTION IF EXISTS public.rating_list_admin(date, date);
CREATE OR REPLACE FUNCTION public.rating_list_admin(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS TABLE(
  rating_id uuid, skor integer, komentar text, created_at timestamptz,
  user_id uuid, pemohon_nama text,
  permohonan_id uuid, permohonan_kode text, permohonan_judul text,
  opd_id uuid, opd_singkatan text, opd_nama text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.skor, r.komentar, r.created_at, r.user_id,
    pr.nama_lengkap, p.id, p.kode, p.judul, p.opd_id, o.singkatan, o.nama
  FROM public.permohonan_rating r
  LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
  LEFT JOIN public.opd o ON o.id = p.opd_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE public.has_role(auth.uid(),'super_admin'::app_role)
    AND (_from IS NULL OR r.created_at::date >= _from)
    AND (_to IS NULL OR r.created_at::date <= _to)
  ORDER BY r.created_at DESC
  LIMIT 1000;
$$;

-- 2) Tambah kolom show_in_open_data (is_public sudah ada)
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS show_in_open_data boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS forms_open_data_idx ON public.forms(show_in_open_data) WHERE show_in_open_data = true;