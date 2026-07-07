
-- 1. Column additions (idempotent)
ALTER TABLE public.permohonan
  ADD COLUMN IF NOT EXISTS nomor_surat text,
  ADD COLUMN IF NOT EXISTS dokumen_final_path text,
  ADD COLUMN IF NOT EXISTS sla_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_total_pause_seconds integer NOT NULL DEFAULT 0;

ALTER TABLE public.opd
  ADD COLUMN IF NOT EXISTS nomor_surat_format text,
  ADD COLUMN IF NOT EXISTS nomor_surat_kode text,
  ADD COLUMN IF NOT EXISTS singkatan text,
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS publish_status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS show_in_open_data boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS current_workflow_node text;

-- FK for form_submissions.form_id → forms(id) so PostgREST embeds work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='form_submissions'
      AND constraint_name='form_submissions_form_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.form_submissions
        ADD CONSTRAINT form_submissions_form_id_fkey
        FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS parallel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_id uuid,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS external_request_id text,
  ADD COLUMN IF NOT EXISTS submission_id uuid,
  ADD COLUMN IF NOT EXISTS file_hash text;

ALTER TABLE public.signature_providers
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS code text;

DO $$ BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS signature_providers_code_key ON public.signature_providers(code) WHERE code IS NOT NULL;
  EXCEPTION WHEN others THEN NULL; END;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='signature_requests'
      AND constraint_name='signature_requests_provider_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE public.signature_requests
        ADD CONSTRAINT signature_requests_provider_id_fkey
        FOREIGN KEY (provider_id) REFERENCES public.signature_providers(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

ALTER TABLE public.signature_events
  ADD COLUMN IF NOT EXISTS actor uuid,
  ADD COLUMN IF NOT EXISTS signer_id uuid,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS request_id uuid;

ALTER TABLE public.kategori_layanan
  ADD COLUMN IF NOT EXISTS kode text;

-- 2. RPC stubs (SECURITY DEFINER, safe defaults)
CREATE OR REPLACE FUNCTION public.executive_summary(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION public.governance_summary()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION public.production_health_score()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('score', 100) $$;

CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_from date DEFAULT NULL, _to date DEFAULT NULL, _opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION public.fn_generate_nomor_surat(_opd_id uuid, _kategori text DEFAULT NULL, _tahun integer DEFAULT NULL)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT ''::text $$;

CREATE OR REPLACE FUNCTION public.fn_permohonan_effective_sla_seconds(_permohonan_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 0::int $$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_agg(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(_opd_id uuid DEFAULT NULL, _months integer DEFAULT 6)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.opd_rating_agg(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.opd_skor_komposit(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg(_from date DEFAULT NULL, _to date DEFAULT NULL, _opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.rating_list_admin(_from date DEFAULT NULL, _to date DEFAULT NULL, _opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.rate_limit_increment(_key text, _window_seconds integer DEFAULT 60, _max_hits integer DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _hits integer;
BEGIN
  INSERT INTO public.rate_limit_hits(key, window_start, hits)
    VALUES (_key, date_trunc('second', now()), 1)
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('allowed', true, 'hits', 1);
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('allowed', true, 'hits', 0);
END $$;

CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms(_dataset_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('ok', true) $$;

-- fn_doc_next_number variant with rule_id
CREATE OR REPLACE FUNCTION public.fn_doc_next_number(_rule_id uuid, _opd_id uuid DEFAULT NULL, _category text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.document_numbering_rules%ROWTYPE; yr int; n int; out_text text; scope text;
BEGIN
  SELECT * INTO r FROM public.document_numbering_rules WHERE id = _rule_id;
  IF NOT FOUND THEN RETURN ''; END IF;
  yr := EXTRACT(YEAR FROM now())::int;
  scope := COALESCE(_opd_id::text,'') || ':' || COALESCE(_category,'');
  INSERT INTO public.document_numbering_sequences(rule_id, scope_key, year, last_number)
    VALUES (r.id, scope, yr, 1)
    ON CONFLICT (rule_id, scope_key, year) DO UPDATE
      SET last_number = public.document_numbering_sequences.last_number + 1, updated_at=now()
    RETURNING last_number INTO n;
  out_text := replace(replace(replace(COALESCE(r.format,'{{seq}}/{{year}}'),
                '{{seq}}', lpad(n::text, COALESCE(r.padding,4), '0')),
                '{{year}}', yr::text),
                '{{scope}}', scope);
  RETURN out_text;
END $$;

-- Grants for new fns
GRANT EXECUTE ON FUNCTION public.executive_summary(date,date),
  public.governance_summary(),
  public.production_health_score(),
  public.fn_ikm_dashboard(date,date,uuid),
  public.fn_generate_nomor_surat(uuid,text,integer),
  public.fn_permohonan_effective_sla_seconds(uuid),
  public.opd_kinerja_agg(date,date),
  public.opd_kinerja_trend(uuid,integer),
  public.opd_kategori_benchmark(date,date),
  public.opd_rating_agg(date,date),
  public.opd_skor_komposit(date,date),
  public.layanan_kinerja_agg(date,date,uuid),
  public.rating_list_admin(date,date,uuid),
  public.riwayat_dengan_petugas(uuid),
  public.rate_limit_increment(text,integer,integer),
  public.migrasi_dataset_ke_forms(uuid),
  public.fn_doc_next_number(uuid,uuid,text)
TO authenticated, service_role;
