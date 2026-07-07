DROP FUNCTION IF EXISTS public.fn_susut_bulanan_run(text);
CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run(_periode text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object('inserted', 0, 'skipped', 0, 'periode', _periode);
END $$;
GRANT EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.rating_list_admin();
DROP FUNCTION IF EXISTS public.rating_list_admin(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.rating_list_admin(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE(rating_id uuid, skor integer, komentar text, created_at timestamptz, user_id uuid, pemohon_nama text, permohonan_id uuid, permohonan_kode text, permohonan_judul text, opd_id uuid, opd_singkatan text, opd_nama text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.skor, r.komentar, r.created_at, r.user_id,
         pr.nama_lengkap, p.id, p.kode, p.judul, p.opd_id, o.singkatan, o.nama
  FROM public.permohonan_rating r
  LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
  LEFT JOIN public.opd o ON o.id = p.opd_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE (_from IS NULL OR r.created_at >= _from)
    AND (_to IS NULL OR r.created_at <= _to)
  ORDER BY r.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.rating_list_admin(timestamptz,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_permohonan_overdue AS
SELECT p.id,
       p.kode,
       p.judul,
       p.opd_id,
       p.status,
       p.tanggal_masuk,
       p.tenggat,
       EXTRACT(EPOCH FROM (now() - p.tenggat))::integer AS overdue_seconds,
       GREATEST(0, CEIL(EXTRACT(EPOCH FROM (now() - p.tenggat)) / 86400.0))::integer AS overdue_days
FROM public.permohonan p
WHERE p.tenggat IS NOT NULL
  AND p.tenggat < now()
  AND p.status NOT IN ('selesai','ditolak');
GRANT SELECT ON public.v_permohonan_overdue TO authenticated, service_role;