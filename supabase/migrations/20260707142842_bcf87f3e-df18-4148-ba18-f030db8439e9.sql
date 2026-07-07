DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='forms')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='forms' AND constraint_type='PRIMARY KEY'
     ) THEN
    ALTER TABLE public.forms ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.forms ADD CONSTRAINT forms_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='generated_documents')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='generated_documents' AND constraint_type='PRIMARY KEY'
     ) THEN
    ALTER TABLE public.generated_documents ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.generated_documents ADD CONSTRAINT generated_documents_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signature_requests')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='signature_requests' AND constraint_type='PRIMARY KEY'
     ) THEN
    ALTER TABLE public.signature_requests ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.signature_requests ADD CONSTRAINT signature_requests_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signature_request_signers')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='signature_request_signers' AND constraint_type='PRIMARY KEY'
     ) THEN
    ALTER TABLE public.signature_request_signers ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.signature_request_signers ADD CONSTRAINT signature_request_signers_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS show_in_open_data boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS forms_open_data_idx ON public.forms(show_in_open_data) WHERE show_in_open_data = true;

ALTER TABLE public.laporan_masyarakat
  ADD COLUMN IF NOT EXISTS ticket_code text,
  ADD COLUMN IF NOT EXISTS pelapor_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS laporan_masyarakat_ticket_code_key
  ON public.laporan_masyarakat(ticket_code)
  WHERE ticket_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_laporan_masyarakat_pelapor_id ON public.laporan_masyarakat(pelapor_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='form_submissions')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='forms')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='form_submissions' AND constraint_name='form_submissions_form_id_fkey'
     ) THEN
    ALTER TABLE public.form_submissions
      ADD CONSTRAINT form_submissions_form_id_fkey
      FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signature_requests')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='generated_documents')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='signature_requests' AND constraint_name='signature_requests_generated_document_id_fkey'
     ) THEN
    ALTER TABLE public.signature_requests
      ADD CONSTRAINT signature_requests_generated_document_id_fkey
      FOREIGN KEY (generated_document_id) REFERENCES public.generated_documents(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signature_request_signers')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='signature_requests')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema='public' AND table_name='signature_request_signers' AND constraint_name='signature_request_signers_request_id_fkey'
     ) THEN
    ALTER TABLE public.signature_request_signers
      ADD CONSTRAINT signature_request_signers_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES public.signature_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_survey_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH r AS (
    SELECT * FROM public.ikm_responses WHERE survey_id = _survey_id
  ), agg AS (
    SELECT
      COUNT(*)::int AS total,
      AVG((COALESCE(u1,0)+COALESCE(u2,0)+COALESCE(u3,0)+COALESCE(u4,0)+COALESCE(u5,0)+COALESCE(u6,0)+COALESCE(u7,0)+COALESCE(u8,0)+COALESCE(u9,0))::numeric / 9.0) AS rata,
      AVG(u1)::numeric AS u1, AVG(u2)::numeric AS u2, AVG(u3)::numeric AS u3,
      AVG(u4)::numeric AS u4, AVG(u5)::numeric AS u5, AVG(u6)::numeric AS u6,
      AVG(u7)::numeric AS u7, AVG(u8)::numeric AS u8, AVG(u9)::numeric AS u9
    FROM r
  )
  SELECT jsonb_build_object(
    'total', total,
    'rata', ROUND(COALESCE(rata,0), 2),
    'nilai_ikm', ROUND(COALESCE(rata,0) * 25, 2),
    'mutu', CASE WHEN COALESCE(rata,0) >= 3.53 THEN 'A' WHEN COALESCE(rata,0) >= 3.06 THEN 'B' WHEN COALESCE(rata,0) >= 2.60 THEN 'C' ELSE 'D' END,
    'u1', ROUND(COALESCE(u1,0),2), 'u2', ROUND(COALESCE(u2,0),2), 'u3', ROUND(COALESCE(u3,0),2),
    'u4', ROUND(COALESCE(u4,0),2), 'u5', ROUND(COALESCE(u5,0),2), 'u6', ROUND(COALESCE(u6,0),2),
    'u7', ROUND(COALESCE(u7,0),2), 'u8', ROUND(COALESCE(u8,0),2), 'u9', ROUND(COALESCE(u9,0),2)
  ) FROM agg;
$$;

CREATE OR REPLACE FUNCTION public.fn_permohonan_effective_sla_seconds(_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(p.updated_at, now()) - p.tanggal_masuk))::integer - COALESCE(p.sla_total_pause_seconds, 0))
    FROM public.permohonan p
    WHERE p.id = _id
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.fn_generate_nomor_surat(_opd_id uuid, _permohonan_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tahun integer := EXTRACT(YEAR FROM now())::integer;
  _seq integer;
  _fmt text;
  _kode text;
  _singkatan text;
  _nomor text;
BEGIN
  INSERT INTO public.nomor_surat_sequence (opd_id, tahun, last_number)
  VALUES (_opd_id, _tahun, 1)
  ON CONFLICT (opd_id, tahun)
  DO UPDATE SET last_number = public.nomor_surat_sequence.last_number + 1, updated_at = now()
  RETURNING last_number INTO _seq;

  SELECT COALESCE(nomor_surat_format, '{kode}/{seq}/{singkatan}/{tahun}'), COALESCE(nomor_surat_kode, '470'), COALESCE(singkatan, 'OPD')
  INTO _fmt, _kode, _singkatan
  FROM public.opd WHERE id = _opd_id;

  _nomor := replace(replace(replace(replace(_fmt, '{kode}', COALESCE(_kode, '470')), '{seq}', lpad(COALESCE(_seq, 1)::text, 3, '0')), '{singkatan}', COALESCE(_singkatan, 'OPD')), '{tahun}', _tahun::text);

  UPDATE public.permohonan SET nomor_surat = _nomor WHERE id = _permohonan_id;
  INSERT INTO public.nomor_surat_issued (nomor, tahun, opd_id, permohonan_id, issued_by)
  VALUES (_nomor, _tahun, _opd_id, _permohonan_id, auth.uid())
  ON CONFLICT (nomor) DO NOTHING;
  RETURN _nomor;
END;
$$;

CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg()
RETURNS TABLE(layanan_id uuid, layanan_judul text, opd_id uuid, opd_singkatan text, kategori text, total bigint, selesai bigint, on_time bigint, selesai_dengan_sla bigint, rata_hari_selesai numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lp.id, COALESCE(lp.judul, p.kategori), p.opd_id, o.singkatan, p.kategori,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai')::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::bigint,
    COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.updated_at - p.tanggal_masuk))/86400.0) FILTER (WHERE p.status='selesai')::numeric, 2), 0)
  FROM public.permohonan p
  LEFT JOIN public.layanan_publik lp ON lp.judul = p.kategori OR lp.slug = p.kategori
  LEFT JOIN public.opd o ON o.id = p.opd_id
  GROUP BY lp.id, lp.judul, p.kategori, p.opd_id, o.singkatan
  ORDER BY 6 DESC;
$$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(_opd uuid DEFAULT NULL::uuid, _months integer DEFAULT 12)
RETURNS TABLE(bulan text, masuk bigint, selesai bigint, on_time bigint, selesai_dengan_sla bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_char(date_trunc('month', p.tanggal_masuk), 'YYYY-MM') AS bulan,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai')::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::bigint
  FROM public.permohonan p
  WHERE p.tanggal_masuk >= date_trunc('month', now()) - make_interval(months => GREATEST(COALESCE(_months,12),1))
    AND (_opd IS NULL OR p.opd_id = _opd)
  GROUP BY date_trunc('month', p.tanggal_masuk)
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark(_kategori text)
RETURNS TABLE(opd_id uuid, opd_nama text, opd_singkatan text, total bigint, selesai bigint, sla_pct numeric, rating_avg numeric, skor numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT * FROM public.permohonan WHERE kategori = _kategori
  ), agg AS (
    SELECT opd_id,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status='selesai')::numeric AS selesai,
      COUNT(*) FILTER (WHERE status='selesai' AND tenggat IS NOT NULL AND updated_at <= tenggat)::numeric AS on_time,
      COUNT(*) FILTER (WHERE status='selesai' AND tenggat IS NOT NULL)::numeric AS with_sla
    FROM p GROUP BY opd_id
  ), rate AS (
    SELECT p.opd_id, AVG(r.skor)::numeric AS r
    FROM public.permohonan_rating r JOIN public.permohonan p ON p.id = r.permohonan_id
    WHERE p.kategori = _kategori
    GROUP BY p.opd_id
  )
  SELECT o.id, o.nama, o.singkatan,
    COALESCE(a.total,0)::bigint,
    COALESCE(a.selesai,0)::bigint,
    CASE WHEN a.with_sla > 0 THEN ROUND(a.on_time / a.with_sla * 100, 2) ELSE NULL END,
    ROUND(COALESCE(rate.r,0)::numeric, 2),
    ROUND((COALESCE(a.selesai,0) + COALESCE(rate.r,0))::numeric, 2)
  FROM public.opd o
  LEFT JOIN agg a ON a.opd_id = o.id
  LEFT JOIN rate ON rate.opd_id = o.id
  ORDER BY 8 DESC;
$$;

CREATE OR REPLACE FUNCTION public.opd_skor_komposit()
RETURNS TABLE(opd_id uuid, opd_nama text, opd_singkatan text, kategori text[], total bigint, selesai bigint, sla_pct numeric, rating_avg numeric, completion_pct numeric, skor numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH agg AS (
    SELECT p.opd_id, COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE p.status='selesai')::numeric AS selesai,
      COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::numeric AS on_time,
      COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::numeric AS with_sla,
      array_agg(DISTINCT p.kategori) FILTER (WHERE p.kategori IS NOT NULL)::text[] AS kategori
    FROM public.permohonan p GROUP BY p.opd_id
  ), rate AS (
    SELECT p.opd_id, AVG(r.skor)::numeric AS r
    FROM public.permohonan_rating r JOIN public.permohonan p ON p.id = r.permohonan_id
    GROUP BY p.opd_id
  )
  SELECT o.id, o.nama, o.singkatan, COALESCE(a.kategori, ARRAY[]::text[]),
    COALESCE(a.total,0)::bigint,
    COALESCE(a.selesai,0)::bigint,
    CASE WHEN a.with_sla>0 THEN ROUND(a.on_time/a.with_sla*100,2) ELSE NULL END,
    ROUND(COALESCE(rate.r,0)::numeric,2),
    CASE WHEN a.total>0 THEN ROUND(a.selesai/a.total*100,2) ELSE NULL END,
    ROUND(COALESCE(
      0.5 * CASE WHEN a.total>0 THEN a.selesai/a.total*100 ELSE 0 END
      + 0.3 * CASE WHEN a.with_sla>0 THEN a.on_time/a.with_sla*100 ELSE 0 END
      + 0.2 * COALESCE(rate.r,0)*20, 0)::numeric, 2)
  FROM public.opd o LEFT JOIN agg a ON a.opd_id = o.id LEFT JOIN rate ON rate.opd_id = o.id
  ORDER BY 10 DESC;
$$;

CREATE OR REPLACE FUNCTION public.governance_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'audit_log_count', (SELECT COUNT(*) FROM public.audit_log),
    'audit_log_24h', (SELECT COUNT(*) FROM public.audit_log WHERE created_at > now() - interval '24 hours'),
    'rbac_audit_count', (SELECT COUNT(*) FROM public.rbac_audit),
    'pending_users', (SELECT COUNT(*) FROM public.profiles WHERE status='pending'),
    'active_users', (SELECT COUNT(*) FROM public.profiles WHERE status='active'),
    'compliance_open', (SELECT COUNT(*) FROM public.compliance_checklist WHERE COALESCE(status,'open')='open'),
    'generated_at', now()
  );
$$;

CREATE OR REPLACE FUNCTION public.production_health_score()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'score', 85,
    'cron_recent_success', (SELECT COUNT(*) FROM public.cron_history WHERE started_at > now() - interval '24 hours' AND COALESCE(status,'ok')='ok'),
    'cron_recent_fail', (SELECT COUNT(*) FROM public.cron_history WHERE started_at > now() - interval '24 hours' AND status='error'),
    'dead_letter_count', (SELECT COUNT(*) FROM public.dead_letter_jobs WHERE resolved_at IS NULL),
    'retry_queue_count', (SELECT COUNT(*) FROM public.retry_queue WHERE COALESCE(status,'pending')='pending'),
    'generated_at', now()
  );
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_increment(_scope text, _subject text, _window_start timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.rate_limit_hits (scope, subject, window_start, count, last_hit_at)
  VALUES (_scope, _subject, _window_start, 1, now())
  ON CONFLICT (scope, subject, window_start)
  DO UPDATE SET count = public.rate_limit_hits.count + 1, last_hit_at = now()
  RETURNING count INTO _count;
  RETURN COALESCE(_count, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ikm_dashboard(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_permohonan_effective_sla_seconds(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.layanan_kinerja_agg() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.opd_kinerja_trend(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.opd_kategori_benchmark(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.opd_skor_komposit() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.governance_summary() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.production_health_score() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text, text, timestamptz) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_ikm_dashboard(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_permohonan_effective_sla_seconds(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.layanan_kinerja_agg() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.opd_kinerja_trend(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.opd_kategori_benchmark(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.opd_skor_komposit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.governance_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.production_health_score() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rate_limit_increment(text, text, timestamptz) FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';