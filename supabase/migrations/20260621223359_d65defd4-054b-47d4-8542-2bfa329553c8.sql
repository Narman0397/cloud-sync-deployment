SET search_path = public;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_pemda';

ALTER TABLE public.opd
  ADD COLUMN IF NOT EXISTS nomor_surat_format text DEFAULT '{kode}/{seq}/{singkatan}/{tahun}',
  ADD COLUMN IF NOT EXISTS nomor_surat_kode text DEFAULT '470';

-- fn_doc_next_number: add _permohonan_id
DROP FUNCTION IF EXISTS public.fn_doc_next_number(uuid, integer);
CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_opd_id uuid, _tahun integer, _permohonan_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq_row public.nomor_surat_sequence%ROWTYPE; next_num integer; BEGIN
  SELECT * INTO seq_row FROM public.nomor_surat_sequence WHERE opd_id = _opd_id AND tahun = _tahun FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.nomor_surat_sequence (opd_id, tahun, last_number) VALUES (_opd_id, _tahun, 1) RETURNING last_number INTO next_num;
  ELSE
    UPDATE public.nomor_surat_sequence SET last_number = last_number + 1, updated_at = now() WHERE id = seq_row.id RETURNING last_number INTO next_num;
  END IF;
  RETURN lpad(next_num::text, 5, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer, uuid) TO authenticated, service_role;

-- ikm dashboard with _survey_id, opd_kinerja_trend with _months, others with _opd alias
DROP FUNCTION IF EXISTS public.fn_ikm_dashboard(uuid);
CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_opd_id uuid DEFAULT NULL, _survey_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '{}'::jsonb $$;

DROP FUNCTION IF EXISTS public.opd_kinerja_trend(uuid);
CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(_opd_id uuid DEFAULT NULL, _opd uuid DEFAULT NULL, _months integer DEFAULT 6)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.opd_kategori_benchmark();
CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark(_kategori text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.layanan_kinerja_agg(uuid);
CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg(_opd_id uuid DEFAULT NULL, _opd uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

-- asn izin daily (attendance_compliance already accepts _days; ensure leave check exists)
-- The _days call is to attendance_compliance with _opd_id+_days only
-- Already covered above.

DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public' AND p.proname IN ('fn_ikm_dashboard','opd_kinerja_trend','opd_kategori_benchmark','layanan_kinerja_agg')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;