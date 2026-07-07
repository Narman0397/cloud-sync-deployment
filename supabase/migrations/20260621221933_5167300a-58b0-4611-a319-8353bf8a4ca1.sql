SET search_path = public;

-- Expand employment_type enum to match UI codes
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'PNS';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'PPPK';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'PPPK_PW';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'NON_ASN';
ALTER TYPE public.employment_type ADD VALUE IF NOT EXISTS 'THL';

-- Branding
CREATE TABLE IF NOT EXISTS public.branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL, value jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid
);

-- Master jabatan
CREATE TABLE IF NOT EXISTS public.master_jabatan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode text, nama text NOT NULL, kategori text,
  pangkat_min text, golongan_min text,
  aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Asset book value
CREATE TABLE IF NOT EXISTS public.aset_nilai_buku (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aset_id uuid NOT NULL, periode text NOT NULL,
  nilai_perolehan numeric DEFAULT 0,
  akumulasi_penyusutan numeric DEFAULT 0,
  nilai_buku numeric DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Document templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text, name text NOT NULL, description text,
  category text, opd_id uuid,
  current_version_id uuid,
  status text DEFAULT 'draft' NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  version_number integer DEFAULT 1 NOT NULL,
  content text, storage_path text,
  schema_snapshot jsonb DEFAULT '{}'::jsonb,
  published_at timestamptz, published_by uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_numbering_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, name text NOT NULL,
  format text NOT NULL DEFAULT '{kode}/{seq}/{singkatan}/{tahun}',
  opd_id uuid, reset_per text DEFAULT 'yearly' NOT NULL,
  last_value integer DEFAULT 0 NOT NULL,
  aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Form wizard drafts
CREATE TABLE IF NOT EXISTS public.form_wizard_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  form_id uuid, step text,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Signature request signers
CREATE TABLE IF NOT EXISTS public.signature_request_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  user_id uuid, role text, status text DEFAULT 'pending' NOT NULL,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Submission versions
CREATE TABLE IF NOT EXISTS public.submission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  version_number integer DEFAULT 1 NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Workflow tables
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE, name text NOT NULL, description text,
  opd_id uuid, status text DEFAULT 'draft' NOT NULL,
  current_version_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  version_number integer DEFAULT 1 NOT NULL,
  definition jsonb DEFAULT '{}'::jsonb NOT NULL,
  published_at timestamptz, published_by uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.workflow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  code text NOT NULL, label text, type text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  position jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.workflow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  source_node text NOT NULL, target_node text NOT NULL,
  condition jsonb DEFAULT '{}'::jsonb,
  label text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text, name text NOT NULL, description text,
  category text, definition jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Patch columns
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS doc_number text,
  ADD COLUMN IF NOT EXISTS mime text;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS generated_document_id uuid;

ALTER TABLE public.form_audit_logs
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- v_permohonan_overdue view
CREATE OR REPLACE VIEW public.v_permohonan_overdue AS
  SELECT p.id, p.kode, p.judul, p.opd_id, p.status, p.tanggal_masuk, p.tenggat,
         EXTRACT(EPOCH FROM (now() - p.tenggat))::integer AS overdue_seconds
  FROM public.permohonan p
  WHERE p.tenggat IS NOT NULL AND p.tenggat < now()
    AND p.status NOT IN ('selesai','ditolak');

GRANT SELECT ON public.v_permohonan_overdue TO authenticated, service_role;

-- GRANTs + RLS for new tables
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
    'branding','master_jabatan','aset_nilai_buku','document_templates','document_template_versions',
    'document_numbering_rules','form_wizard_drafts','signature_request_signers','submission_versions',
    'workflow_definitions','workflow_versions','workflow_nodes','workflow_edges','workflow_templates'
  ) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "admin_all_%s" ON public.%I', r.tablename, r.tablename);
    EXECUTE format('CREATE POLICY "admin_all_%s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''super_admin''::app_role) OR public.has_role(auth.uid(),''admin_opd''::app_role)) WITH CHECK (public.has_role(auth.uid(),''super_admin''::app_role) OR public.has_role(auth.uid(),''admin_opd''::app_role))', r.tablename, r.tablename);
  END LOOP;
END $$;