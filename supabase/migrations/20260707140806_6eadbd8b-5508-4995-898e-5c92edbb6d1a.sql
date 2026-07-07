CREATE TABLE IF NOT EXISTS public.opd (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL, singkatan text NOT NULL,
  kategori text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  nomor_surat_format text DEFAULT '{kode}/{seq}/{singkatan}/{tahun}'::text,
  nomor_surat_kode text DEFAULT '470'::text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opd TO authenticated;
GRANT ALL ON public.opd TO service_role;
ALTER TABLE public.opd ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  nama_lengkap text DEFAULT ''::text NOT NULL,
  nik text, no_hp text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  desa text, verified_at timestamptz, verified_by uuid,
  nip text, jabatan text, username text,
  asn_type text, system_position text, pangkat text, golongan text, foto_url text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pejabat (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL, jabatan text NOT NULL, foto_url text,
  urutan integer DEFAULT 0 NOT NULL, aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid, pimpinan_type text, is_pimpinan boolean DEFAULT false NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pejabat TO authenticated;
GRANT ALL ON public.pejabat TO service_role;
ALTER TABLE public.pejabat ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.permohonan (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  kode text NOT NULL UNIQUE,
  pemohon_id uuid NOT NULL,
  opd_id uuid NOT NULL REFERENCES public.opd(id) ON DELETE RESTRICT,
  judul text NOT NULL, kategori text NOT NULL, deskripsi text,
  status public.status_permohonan DEFAULT 'baru'::public.status_permohonan NOT NULL,
  petugas_id uuid,
  tanggal_masuk timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  prioritas text DEFAULT 'normal'::text NOT NULL,
  tenggat timestamptz, ringkasan text,
  untuk_orang_lain boolean DEFAULT false NOT NULL,
  atas_nama_nama text, atas_nama_nik text, atas_nama_hp text,
  wakil_ambil_nama text, wakil_ambil_nik text,
  current_disposition_id uuid, dokumen_final_path text,
  sla_paused_at timestamptz, sla_total_pause_seconds integer DEFAULT 0,
  nomor_surat text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permohonan TO authenticated;
GRANT ALL ON public.permohonan TO service_role;
ALTER TABLE public.permohonan ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.permohonan_rating (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  permohonan_id uuid NOT NULL REFERENCES public.permohonan(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, skor integer NOT NULL, komentar text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (permohonan_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permohonan_rating TO authenticated;
GRANT ALL ON public.permohonan_rating TO service_role;
ALTER TABLE public.permohonan_rating ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.permohonan_riwayat (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  permohonan_id uuid NOT NULL REFERENCES public.permohonan(id) ON DELETE CASCADE,
  oleh uuid, aksi text NOT NULL, catatan text,
  created_at timestamptz DEFAULT now() NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permohonan_riwayat TO authenticated;
GRANT ALL ON public.permohonan_riwayat TO service_role;
ALTER TABLE public.permohonan_riwayat ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_subscription (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscription TO authenticated;
GRANT ALL ON public.push_subscription TO service_role;
ALTER TABLE public.push_subscription ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rate_limit (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  identifier text NOT NULL, bucket text NOT NULL,
  window_start timestamptz DEFAULT now() NOT NULL,
  count integer DEFAULT 1 NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit TO authenticated;
GRANT ALL ON public.rate_limit TO service_role;
ALTER TABLE public.rate_limit ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.verification_token (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '30 days') NOT NULL,
  used_at timestamptz, used_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_token TO authenticated;
GRANT ALL ON public.verification_token TO service_role;
ALTER TABLE public.verification_token ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS profiles_username_lower_uidx ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permohonan_opd ON public.permohonan (opd_id);
CREATE INDEX IF NOT EXISTS idx_permohonan_pemohon ON public.permohonan (pemohon_id);
CREATE INDEX IF NOT EXISTS idx_permohonan_status ON public.permohonan (status);
CREATE INDEX IF NOT EXISTS idx_riwayat_permohonan ON public.permohonan_riwayat (permohonan_id);
CREATE INDEX IF NOT EXISTS idx_push_subscription_user ON public.push_subscription (user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON public.rate_limit (identifier, bucket, window_start DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.get_user_desa(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT desa FROM public.profiles WHERE id = _user_id LIMIT 1; $$;
CREATE OR REPLACE FUNCTION public.get_user_opd(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT opd_id FROM public.profiles WHERE id = _user_id LIMIT 1; $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE OR REPLACE FUNCTION public.count_permohonan_bulan_ini() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COUNT(*)::int FROM public.permohonan WHERE tanggal_masuk >= date_trunc('month', now()); $$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_agg() RETURNS TABLE(opd_id uuid, status text, total bigint, total_hari_selesai numeric, jumlah_selesai bigint, tepat_waktu bigint, selesai_dengan_sla bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT p.opd_id, p.status::text, COUNT(*)::bigint,
  COALESCE(SUM(CASE WHEN p.status='selesai' AND p.tanggal_masuk IS NOT NULL AND p.updated_at IS NOT NULL THEN EXTRACT(EPOCH FROM (p.updated_at - p.tanggal_masuk))/86400.0 ELSE 0 END),0)::numeric,
  COUNT(*) FILTER (WHERE p.status='selesai' AND p.tanggal_masuk IS NOT NULL AND p.updated_at IS NOT NULL)::bigint,
  COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::bigint,
  COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::bigint
FROM public.permohonan p GROUP BY p.opd_id, p.status;
$$;

CREATE OR REPLACE FUNCTION public.opd_rating_agg() RETURNS TABLE(opd_id uuid, total_rating bigint, jumlah_rating bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT p.opd_id, COALESCE(SUM(r.skor),0)::bigint, COUNT(r.id)::bigint
FROM public.permohonan p JOIN public.permohonan_rating r ON r.permohonan_id = p.id
WHERE p.opd_id IS NOT NULL GROUP BY p.opd_id; $$;

CREATE OR REPLACE FUNCTION public.rating_list_admin() RETURNS TABLE(rating_id uuid, skor integer, komentar text, created_at timestamptz, user_id uuid, pemohon_nama text, permohonan_id uuid, permohonan_kode text, permohonan_judul text, opd_id uuid, opd_singkatan text, opd_nama text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT r.id, r.skor, r.komentar, r.created_at, r.user_id, pr.nama_lengkap, p.id, p.kode, p.judul, p.opd_id, o.singkatan, o.nama
FROM public.permohonan_rating r
LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
LEFT JOIN public.opd o ON o.id = p.opd_id
LEFT JOIN public.profiles pr ON pr.id = r.user_id
WHERE public.has_role(auth.uid(),'super_admin') ORDER BY r.created_at DESC; $$;

CREATE OR REPLACE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid) RETURNS TABLE(id uuid, created_at timestamptz, aksi text, catatan text, oleh uuid, nama_petugas text, email_petugas text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _opd uuid; _pemohon uuid;
BEGIN
  SELECT opd_id, pemohon_id INTO _opd, _pemohon FROM public.permohonan WHERE id = _permohonan_id;
  IF _opd IS NULL THEN RETURN; END IF;
  IF NOT (auth.uid() = _pemohon OR public.has_role(auth.uid(),'super_admin') OR (public.has_role(auth.uid(),'admin_opd') AND _opd = public.get_user_opd(auth.uid()))) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT r.id, r.created_at, r.aksi, r.catatan, r.oleh, COALESCE(p.nama_lengkap,''), COALESCE(u.email,'')
    FROM public.permohonan_riwayat r
    LEFT JOIN public.profiles p ON p.id = r.oleh
    LEFT JOIN auth.users u ON u.id = r.oleh
    WHERE r.permohonan_id = _permohonan_id ORDER BY r.created_at ASC;
END $$;

DO $$ BEGIN CREATE POLICY "authenticated can read opd" ON public.opd FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_opd') OR public.has_role(auth.uid(), 'admin_desa') OR public.has_role(auth.uid(), 'asn') OR public.has_role(auth.uid(), 'admin_pemda') OR public.has_role(auth.uid(), 'pimpinan')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "authenticated read roles" ON public.user_roles FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "authenticated manage own push" ON public.push_subscription FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "authenticated manage own permohonan" ON public.permohonan FOR ALL TO authenticated USING (pemohon_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_opd') OR public.has_role(auth.uid(), 'admin_pemda') OR public.has_role(auth.uid(), 'pimpinan')) WITH CHECK (pemohon_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_opd') OR public.has_role(auth.uid(), 'admin_pemda') OR public.has_role(auth.uid(), 'pimpinan')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "authenticated read pejabat" ON public.pejabat FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "authenticated manage ratings" ON public.permohonan_rating FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_opd')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin_opd')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "authenticated read riwayat" ON public.permohonan_riwayat FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;