DROP FUNCTION IF EXISTS public.rating_list_admin();
DROP FUNCTION IF EXISTS public.rating_list_admin(date, date);
DROP FUNCTION IF EXISTS public.rating_list_admin(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.rating_list_admin(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(
  rating_id uuid,
  skor integer,
  komentar text,
  created_at timestamptz,
  user_id uuid,
  pemohon_nama text,
  permohonan_id uuid,
  permohonan_kode text,
  permohonan_judul text,
  opd_id uuid,
  opd_singkatan text,
  opd_nama text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id AS rating_id,
    r.skor,
    r.komentar,
    r.created_at,
    r.user_id,
    pr.nama_lengkap AS pemohon_nama,
    p.id AS permohonan_id,
    p.kode AS permohonan_kode,
    p.judul AS permohonan_judul,
    p.opd_id,
    o.singkatan AS opd_singkatan,
    o.nama AS opd_nama
  FROM public.permohonan_rating r
  LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  LEFT JOIN public.opd o ON o.id = p.opd_id
  WHERE (public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin_pemda'::public.app_role))
    AND (_from IS NULL OR r.created_at >= _from)
    AND (_to IS NULL OR r.created_at <= _to)
  ORDER BY r.created_at DESC
  LIMIT 1000;
$$;

GRANT EXECUTE ON FUNCTION public.rating_list_admin(timestamptz, timestamptz) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rating_list_admin(timestamptz, timestamptz) FROM PUBLIC, anon;

CREATE OR REPLACE VIEW public.v_permohonan_overdue
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.kode,
  p.judul,
  p.opd_id,
  p.status,
  p.tanggal_masuk,
  p.tenggat,
  EXTRACT(EPOCH FROM (now() - p.tenggat))::integer AS overdue_seconds,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - p.tenggat)) / 86400)::integer) AS overdue_days
FROM public.permohonan p
WHERE p.tenggat IS NOT NULL
  AND p.tenggat < now()
  AND p.status NOT IN ('selesai'::public.status_permohonan, 'ditolak'::public.status_permohonan);

GRANT SELECT ON public.v_permohonan_overdue TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';