
-- Phase 3A: Document Runtime extensions

-- 1) Extend document_templates
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS current_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS numbering_rule_id uuid;
ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_kind_chk CHECK (kind IN ('html','docx','pdf'));

-- 2) document_template_versions (immutable snapshot)
CREATE TABLE IF NOT EXISTS public.document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  kind text NOT NULL,
  template_html text,
  template_storage_path text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);
GRANT SELECT, INSERT ON public.document_template_versions TO authenticated;
GRANT ALL ON public.document_template_versions TO service_role;
ALTER TABLE public.document_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dtv_select ON public.document_template_versions FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.document_templates t WHERE t.id = template_id
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_pemda')
      OR t.owner_opd_id = get_user_opd(auth.uid()))));
CREATE POLICY dtv_insert ON public.document_template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.document_templates t WHERE t.id = template_id
    AND (has_role(auth.uid(),'super_admin') OR t.owner_opd_id = get_user_opd(auth.uid()))));

-- 3) Extend generated_documents
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS doc_number text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS template_version int,
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS numbering_rule_id uuid;
ALTER TABLE public.generated_documents
  ADD CONSTRAINT generated_documents_status_chk
    CHECK (status IN ('draft','generated','pending_signature','signed','rejected','archived'));
CREATE UNIQUE INDEX IF NOT EXISTS generated_documents_doc_number_uniq
  ON public.generated_documents(doc_number) WHERE doc_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS generated_documents_status_idx ON public.generated_documents(status);
CREATE INDEX IF NOT EXISTS generated_documents_template_idx ON public.generated_documents(template_id);

-- 4) document_numbering_rules
CREATE TABLE IF NOT EXISTS public.document_numbering_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  format text NOT NULL,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','per_opd','per_category','per_opd_category')),
  category text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  reset_period text NOT NULL DEFAULT 'yearly' CHECK (reset_period IN ('yearly','never')),
  padding int NOT NULL DEFAULT 6 CHECK (padding BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_numbering_rules TO authenticated;
GRANT ALL ON public.document_numbering_rules TO service_role;
ALTER TABLE public.document_numbering_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY dnr_select ON public.document_numbering_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY dnr_write ON public.document_numbering_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_pemda'))
  WITH CHECK (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_pemda'));

-- FK to templates
ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_numbering_rule_fk
  FOREIGN KEY (numbering_rule_id) REFERENCES public.document_numbering_rules(id) ON DELETE SET NULL;

-- 5) document_numbering_sequences
CREATE TABLE IF NOT EXISTS public.document_numbering_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.document_numbering_rules(id) ON DELETE CASCADE,
  scope_key text NOT NULL DEFAULT '',
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, scope_key, year)
);
GRANT SELECT ON public.document_numbering_sequences TO authenticated;
GRANT ALL ON public.document_numbering_sequences TO service_role;
ALTER TABLE public.document_numbering_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY dns_select ON public.document_numbering_sequences FOR SELECT TO authenticated USING (true);

-- RPC fn_doc_next_number
CREATE OR REPLACE FUNCTION public.fn_doc_next_number(
  _rule_id uuid, _opd_id uuid DEFAULT NULL, _category text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.document_numbering_rules;
  _year int := EXTRACT(YEAR FROM now())::int;
  _seq_year int;
  _scope_key text := '';
  _next int;
  _seq_str text;
  _opd_code text := '';
  _opd_name text := '';
  _formatted text;
BEGIN
  SELECT * INTO r FROM public.document_numbering_rules WHERE id = _rule_id AND status='active';
  IF r IS NULL THEN RAISE EXCEPTION 'numbering rule not found'; END IF;
  _seq_year := CASE WHEN r.reset_period='yearly' THEN _year ELSE 0 END;
  IF r.scope='per_opd' OR r.scope='per_opd_category' THEN
    _scope_key := COALESCE(_opd_id::text,'');
  END IF;
  IF r.scope='per_category' OR r.scope='per_opd_category' THEN
    _scope_key := _scope_key || '|' || COALESCE(_category, r.category, '');
  END IF;
  INSERT INTO public.document_numbering_sequences(rule_id, scope_key, year, last_number)
    VALUES (r.id, _scope_key, _seq_year, 1)
  ON CONFLICT (rule_id, scope_key, year)
    DO UPDATE SET last_number = document_numbering_sequences.last_number + 1, updated_at = now()
  RETURNING last_number INTO _next;
  _seq_str := LPAD(_next::text, r.padding, '0');
  IF _opd_id IS NOT NULL THEN
    SELECT COALESCE(singkatan,''), COALESCE(nomor_surat_kode,'') INTO _opd_name, _opd_code
      FROM public.opd WHERE id=_opd_id;
  END IF;
  _formatted := r.format;
  _formatted := REPLACE(_formatted, '{YEAR}', _year::text);
  _formatted := REPLACE(_formatted, '{MONTH}', LPAD(EXTRACT(MONTH FROM now())::text,2,'0'));
  _formatted := REPLACE(_formatted, '{SEQ}', _seq_str);
  _formatted := REPLACE(_formatted, '{OPD}', _opd_name);
  _formatted := REPLACE(_formatted, '{OPD_CODE}', _opd_code);
  _formatted := REPLACE(_formatted, '{CATEGORY}', COALESCE(_category, r.category, ''));
  RETURN _formatted;
END $$;
REVOKE ALL ON FUNCTION public.fn_doc_next_number(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid,uuid,text) TO authenticated, service_role;

-- 6) document_history
CREATE TABLE IF NOT EXISTS public.document_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created','generated','downloaded','archived','sent_for_signature','signed','rejected','restored')),
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_history TO authenticated;
GRANT ALL ON public.document_history TO service_role;
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY dh_select ON public.document_history FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.generated_documents g WHERE g.id=document_id
    AND (has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'admin_pemda')
      OR EXISTS(SELECT 1 FROM public.form_submissions s WHERE s.id=g.submission_id
        AND (s.user_id=auth.uid() OR s.opd_id=get_user_opd(auth.uid()))))));
CREATE POLICY dh_insert ON public.document_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS document_history_document_idx ON public.document_history(document_id, created_at DESC);

-- 7) updated_at trigger for numbering rules
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_dnr_touch ON public.document_numbering_rules;
CREATE TRIGGER trg_dnr_touch BEFORE UPDATE ON public.document_numbering_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
