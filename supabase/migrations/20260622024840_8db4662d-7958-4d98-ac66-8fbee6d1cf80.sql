
CREATE OR REPLACE FUNCTION public.attendance_compliance(
  _opd_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL,
  _days integer DEFAULT NULL, _user_id uuid DEFAULT NULL,
  _bulan integer DEFAULT NULL, _tahun integer DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  WITH bounds AS (
    SELECT
      COALESCE(_from,
        CASE WHEN _tahun IS NOT NULL AND _bulan IS NOT NULL THEN make_date(_tahun,_bulan,1)
             WHEN _days IS NOT NULL THEN (CURRENT_DATE - (_days||' days')::interval)::date
             ELSE CURRENT_DATE - interval '30 days' END::date) AS d_from,
      COALESCE(_to,
        CASE WHEN _tahun IS NOT NULL AND _bulan IS NOT NULL
             THEN (make_date(_tahun,_bulan,1) + interval '1 month - 1 day')::date
             ELSE CURRENT_DATE END) AS d_to
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT pr.id AS user_id, pr.nama_lengkap, pr.opd_id,
      COUNT(a.id)::int AS total_hadir,
      COUNT(DISTINCT DATE(a.waktu))::int AS hari_hadir,
      (SELECT (d_to - d_from + 1) FROM bounds)::int AS hari_periode
    FROM public.profiles pr
    LEFT JOIN public.absensi_asn a ON a.user_id=pr.id
      AND DATE(a.waktu) BETWEEN (SELECT d_from FROM bounds) AND (SELECT d_to FROM bounds)
    WHERE (_opd_id IS NULL OR pr.opd_id=_opd_id)
      AND (_user_id IS NULL OR pr.id=_user_id)
      AND pr.opd_id IS NOT NULL
    GROUP BY pr.id, pr.nama_lengkap, pr.opd_id
    ORDER BY hari_hadir DESC LIMIT 500
  ) t
$$;

CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(
  _opd_id uuid DEFAULT NULL, _tahun integer DEFAULT NULL,
  _bulan integer DEFAULT NULL, _user_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT pr.id AS user_id, pr.nama_lengkap,
      COUNT(a.id)::int AS jumlah_absen,
      COUNT(DISTINCT DATE(a.waktu))::int AS hari_hadir,
      COUNT(a.id) FILTER (WHERE a.is_late)::int AS jumlah_terlambat
    FROM public.profiles pr
    LEFT JOIN public.absensi_asn a ON a.user_id=pr.id
      AND EXTRACT(YEAR FROM a.waktu)=COALESCE(_tahun, EXTRACT(YEAR FROM CURRENT_DATE))
      AND EXTRACT(MONTH FROM a.waktu)=COALESCE(_bulan, EXTRACT(MONTH FROM CURRENT_DATE))
    WHERE (_opd_id IS NULL OR pr.opd_id=_opd_id)
      AND (_user_id IS NULL OR pr.id=_user_id)
      AND pr.opd_id IS NOT NULL
    GROUP BY pr.id, pr.nama_lengkap
    ORDER BY hari_hadir DESC
  ) t
$$;

CREATE OR REPLACE FUNCTION public.attendance_device_alert(
  _opd_id uuid DEFAULT NULL, _days integer DEFAULT 7
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT o.id AS opd_id, o.nama AS opd_nama,
      MAX(a.waktu) AS last_seen,
      COUNT(a.id) FILTER (WHERE a.waktu >= now() - (_days||' days')::interval)::int AS absen_dalam_periode
    FROM public.opd o
    LEFT JOIN public.absensi_asn a ON a.opd_id=o.id
    WHERE (_opd_id IS NULL OR o.id=_opd_id)
    GROUP BY o.id, o.nama
    HAVING MAX(a.waktu) IS NULL OR MAX(a.waktu) < now() - (_days||' days')::interval
    ORDER BY last_seen ASC NULLS FIRST
  ) t
$$;

CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(
  _opd_id uuid DEFAULT NULL, _survey_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT jsonb_build_object(
    'total_responses', COUNT(r.id),
    'avg_score', COALESCE(AVG(
      (COALESCE(r.u1,0)+COALESCE(r.u2,0)+COALESCE(r.u3,0)+COALESCE(r.u4,0)+COALESCE(r.u5,0)
       +COALESCE(r.u6,0)+COALESCE(r.u7,0)+COALESCE(r.u8,0)+COALESCE(r.u9,0))::numeric
      / NULLIF(
        (CASE WHEN r.u1 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u2 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u3 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u4 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u5 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u6 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u7 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u8 IS NOT NULL THEN 1 ELSE 0 END)
       +(CASE WHEN r.u9 IS NOT NULL THEN 1 ELSE 0 END), 0)
    ), 0),
    'surveys_active', (SELECT COUNT(*) FROM public.ikm_surveys WHERE COALESCE(aktif,true)
                       AND (_opd_id IS NULL OR opd_id=_opd_id)),
    'generated_at', now()
  )
  FROM public.ikm_responses r
  LEFT JOIN public.ikm_surveys s ON s.id=r.survey_id
  WHERE (_survey_id IS NULL OR r.survey_id=_survey_id)
    AND (_opd_id IS NULL OR s.opd_id=_opd_id)
$$;

CREATE OR REPLACE FUNCTION public.opd_skor_komposit() RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT o.id AS opd_id, o.nama AS opd_nama, o.singkatan,
      COUNT(p.id)::int AS total_permohonan,
      COUNT(p.id) FILTER (WHERE p.status='selesai')::int AS selesai,
      CASE WHEN COUNT(p.id)>0
           THEN ROUND(COUNT(p.id) FILTER (WHERE p.status='selesai')::numeric*100/COUNT(p.id),2)
           ELSE 0 END AS pct_selesai,
      COALESCE(AVG(r.skor)::numeric(10,2),0) AS rata_rating,
      COALESCE(AVG(r.skor)::numeric(10,2),0)*20 +
        (CASE WHEN COUNT(p.id)>0
              THEN COUNT(p.id) FILTER (WHERE p.status='selesai')::numeric*100/COUNT(p.id)
              ELSE 0 END)*0.5 AS skor_komposit
    FROM public.opd o
    LEFT JOIN public.permohonan p ON p.opd_id=o.id
    LEFT JOIN public.permohonan_rating r ON r.permohonan_id=p.id
    GROUP BY o.id, o.nama, o.singkatan
    ORDER BY skor_komposit DESC
  ) t
$$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(
  _opd_id uuid DEFAULT NULL, _opd uuid DEFAULT NULL, _months integer DEFAULT 6
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT to_char(date_trunc('month', p.tanggal_masuk),'YYYY-MM') AS bulan,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE p.status='selesai')::int AS selesai
    FROM public.permohonan p
    WHERE p.tanggal_masuk >= date_trunc('month', now()) - (COALESCE(_months,6)||' months')::interval
      AND (COALESCE(_opd_id,_opd) IS NULL OR p.opd_id=COALESCE(_opd_id,_opd))
    GROUP BY 1 ORDER BY 1
  ) t
$$;

CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark(_kategori text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT p.kategori,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE p.status='selesai')::int AS selesai,
      COALESCE(AVG(r.skor)::numeric(10,2),0) AS rata_rating
    FROM public.permohonan p
    LEFT JOIN public.permohonan_rating r ON r.permohonan_id=p.id
    WHERE (_kategori IS NULL OR p.kategori=_kategori)
    GROUP BY p.kategori ORDER BY total DESC
  ) t
$$;

CREATE OR REPLACE FUNCTION public.rating_list_admin(
  _from date DEFAULT NULL, _to date DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
    SELECT r.id, r.permohonan_id, r.skor, r.komentar, r.created_at,
      p.kode AS permohonan_kode, p.opd_id
    FROM public.permohonan_rating r
    LEFT JOIN public.permohonan p ON p.id=r.permohonan_id
    WHERE (_from IS NULL OR r.created_at::date >= _from)
      AND (_to IS NULL OR r.created_at::date <= _to)
    ORDER BY r.created_at DESC LIMIT 500
  ) t
$$;

CREATE OR REPLACE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at ASC),'[]'::jsonb) FROM (
    SELECT h.id, h.aksi, h.catatan, h.created_at, h.oleh AS user_id,
      pr.nama_lengkap AS petugas_nama
    FROM public.permohonan_riwayat h
    LEFT JOIN public.profiles pr ON pr.id=h.oleh
    WHERE h.permohonan_id=_permohonan_id
  ) t
$$;

CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT permission_code),'[]'::jsonb)
  FROM public.user_permissions
  WHERE user_id=_user_id AND granted=true
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
$$;

CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_hits_scope_subject_window_uq
  ON public.rate_limit_hits (scope, subject, window_start);

CREATE OR REPLACE FUNCTION public.rate_limit_increment(
  _identifier text DEFAULT NULL, _bucket text DEFAULT NULL,
  _window_seconds integer DEFAULT 60, _max integer DEFAULT 100,
  _scope text DEFAULT NULL, _subject text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _sc text; _sub text; _now timestamptz := now(); _win timestamptz; _cnt int;
BEGIN
  _sc := COALESCE(_scope,_bucket,'default');
  _sub := COALESCE(_subject,_identifier,'anon');
  _win := date_trunc('second', _now) - ((EXTRACT(EPOCH FROM _now)::int % GREATEST(_window_seconds,1))||' seconds')::interval;
  INSERT INTO public.rate_limit_hits (scope, subject, window_start, count, last_hit_at)
    VALUES (_sc, _sub, _win, 1, _now)
  ON CONFLICT (scope, subject, window_start)
    DO UPDATE SET count = public.rate_limit_hits.count + 1, last_hit_at = _now
  RETURNING count INTO _cnt;
  RETURN jsonb_build_object('allowed', _cnt <= _max, 'count', _cnt, 'limit', _max, 'window_seconds', _window_seconds);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('allowed', true, 'count', 1, 'error', SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run(_periode text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _p text; _n int := 0;
BEGIN
  _p := COALESCE(_periode, to_char(now(),'YYYY-MM'));
  INSERT INTO public.aset_penyusutan_history (aset_id, periode, susut_bulan, akumulasi, nilai_buku, created_at)
  SELECT a.id, _p,
    COALESCE(a.nilai_perolehan,0) / NULLIF(COALESCE(a.umur_ekonomis_bulan,60),0),
    LEAST(COALESCE(a.nilai_perolehan,0),
          (COALESCE(a.nilai_perolehan,0) / NULLIF(COALESCE(a.umur_ekonomis_bulan,60),0))
          * GREATEST(1, EXTRACT(MONTH FROM age(now(), COALESCE(a.tanggal_perolehan, now())))::int
                      + 12*EXTRACT(YEAR FROM age(now(), COALESCE(a.tanggal_perolehan, now())))::int)),
    GREATEST(COALESCE(a.nilai_sisa,0),
      COALESCE(a.nilai_perolehan,0)
      - (COALESCE(a.nilai_perolehan,0) / NULLIF(COALESCE(a.umur_ekonomis_bulan,60),0))
        * GREATEST(1, EXTRACT(MONTH FROM age(now(), COALESCE(a.tanggal_perolehan, now())))::int
                    + 12*EXTRACT(YEAR FROM age(now(), COALESCE(a.tanggal_perolehan, now())))::int)),
    now()
  FROM public.aset a
  WHERE COALESCE(a.lifecycle_status,'aktif')='aktif' AND COALESCE(a.nilai_perolehan,0) > 0
    AND NOT EXISTS (SELECT 1 FROM public.aset_penyusutan_history h WHERE h.aset_id=a.id AND h.periode=_p);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN jsonb_build_object('periode',_p,'processed',_n,'generated_at',now());
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLERRM,'periode',_p);
END $$;

CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms(_template_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _n int := 0;
BEGIN
  IF _template_id IS NULL THEN
    RETURN jsonb_build_object('migrated',0,'note','no template_id supplied');
  END IF;
  SELECT COUNT(*) INTO _n FROM public.dataset_submission WHERE template_id=_template_id;
  RETURN jsonb_build_object('migrated',0,'eligible',_n,'template_id',_template_id);
END $$;
