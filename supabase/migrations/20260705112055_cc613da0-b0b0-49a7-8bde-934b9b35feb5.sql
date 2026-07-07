-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE public.app_role AS ENUM ('warga','admin_opd','super_admin','admin_desa','asn');
CREATE TYPE public.job_status AS ENUM ('pending','running','success','failed','dead');
CREATE TYPE public.status_permohonan AS ENUM ('baru','diproses','selesai','ditolak');

-- Plpgsql-only helper functions (deferred body parse)
CREATE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE FUNCTION public.prevent_self_role_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Pengguna tidak diizinkan mengubah perannya sendiri';
  END IF;
  RETURN NEW;
END; $$;

-- Tables
CREATE TABLE public.opd (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL, singkatan text NOT NULL,
  kategori text[] DEFAULT '{}'::text[] NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap text DEFAULT '' NOT NULL,
  nik text, no_hp text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active','suspended')),
  desa text, verified_at timestamptz, verified_by uuid,
  nip text, jabatan text, username text
);
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
CREATE UNIQUE INDEX profiles_username_lower_uidx ON public.profiles (lower(username)) WHERE (username IS NOT NULL);

CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.desa (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL UNIQUE, kecamatan text,
  aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.absensi_asn (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  tipe text NOT NULL,
  waktu timestamptz DEFAULT now() NOT NULL,
  lokasi text, lat numeric, lng numeric, foto_url text, catatan text, device_info text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.app_setting (
  key text NOT NULL PRIMARY KEY,
  value jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.aset (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  kode text NOT NULL UNIQUE, nama text NOT NULL,
  kategori text, kondisi text DEFAULT 'baik' NOT NULL,
  lokasi text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  pemegang_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nilai_perolehan numeric DEFAULT 0,
  tanggal_perolehan date, deskripsi text, foto_url text,
  merk text, nomor_seri text, lokasi_terkini text, lat numeric, lng numeric,
  status text DEFAULT 'aktif' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  catatan text
);

CREATE TABLE public.aset_riwayat (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  aset_id uuid NOT NULL REFERENCES public.aset(id) ON DELETE CASCADE,
  aksi text NOT NULL, catatan text,
  oleh uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data jsonb, lat numeric, lng numeric, lokasi_text text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid, user_email text,
  aksi text NOT NULL, entitas text NOT NULL, entitas_id text,
  data_sebelum jsonb, data_sesudah jsonb, ip_address text, user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_entitas ON public.audit_log (entitas, entitas_id);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id);

CREATE TABLE public.backup_snapshot (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  label text NOT NULL, tipe text DEFAULT 'manual' NOT NULL,
  size_bytes bigint DEFAULT 0 NOT NULL,
  table_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid
);
CREATE INDEX idx_backup_snapshot_created_at ON public.backup_snapshot (created_at DESC);

CREATE TABLE public.berita (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  judul text NOT NULL, slug text NOT NULL UNIQUE,
  ringkasan text, isi text DEFAULT '' NOT NULL,
  gambar_url text,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft','terbit')),
  published_at timestamptz, penulis_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_berita_status_pub ON public.berita (status, published_at DESC);

CREATE TABLE public.data_terpadu_item (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  kategori text NOT NULL CHECK (kategori IN ('kpi','chart_layanan','penduduk','anggaran','dataset')),
  label text NOT NULL, nilai_teks text, nilai_num numeric, nilai_num2 numeric,
  satuan text, trend text, ikon text, format text, ukuran text, url text, opd text,
  aktif boolean DEFAULT true NOT NULL, urutan integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_data_terpadu_kat_urut ON public.data_terpadu_item (kategori, urutan);

CREATE TABLE public.job_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  job_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  status public.job_status DEFAULT 'pending' NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  scheduled_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz, finished_at timestamptz,
  error text, result jsonb, created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_job_queue_status_scheduled ON public.job_queue (status, scheduled_at) WHERE (status IN ('pending','failed'));

CREATE TABLE public.kantor_qr (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  opd_id uuid NOT NULL UNIQUE REFERENCES public.opd(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE, label text, lokasi text,
  lat numeric, lng numeric, radius_m integer DEFAULT 100 NOT NULL,
  aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.kategori_layanan (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL UNIQUE, slug text NOT NULL UNIQUE,
  sla_hari integer DEFAULT 7 NOT NULL CHECK (sla_hari > 0 AND sla_hari <= 365),
  deskripsi text, aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.laporan_masyarakat (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL, nik text, email text NOT NULL, no_hp text,
  kategori text NOT NULL, lokasi text, uraian text NOT NULL,
  status text DEFAULT 'baru' NOT NULL,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  tindak_lanjut text, ditangani_oleh uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_laporan_created ON public.laporan_masyarakat (created_at DESC);
CREATE INDEX idx_laporan_opd ON public.laporan_masyarakat (opd_id);
CREATE INDEX idx_laporan_status ON public.laporan_masyarakat (status);

CREATE TABLE public.layanan_publik (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  judul text NOT NULL, slug text NOT NULL UNIQUE, deskripsi text, ikon text,
  opd_id uuid REFERENCES public.opd(id) ON DELETE SET NULL,
  persyaratan text, alur text,
  aktif boolean DEFAULT true NOT NULL, urutan integer DEFAULT 0 NOT NULL,
  sla_hari integer DEFAULT 14 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.pejabat (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  nama text NOT NULL, jabatan text NOT NULL, foto_url text,
  urutan integer DEFAULT 0 NOT NULL, aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.permohonan (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  kode text NOT NULL UNIQUE,
  pemohon_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opd_id uuid NOT NULL REFERENCES public.opd(id) ON DELETE RESTRICT,
  judul text NOT NULL, kategori text NOT NULL, deskripsi text,
  status public.status_permohonan DEFAULT 'baru' NOT NULL,
  petugas_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tanggal_masuk timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  prioritas text DEFAULT 'normal' NOT NULL CHECK (prioritas IN ('rendah','normal','tinggi')),
  tenggat timestamptz, ringkasan text,
  untuk_orang_lain boolean DEFAULT false NOT NULL,
  atas_nama_nama text, atas_nama_nik text, atas_nama_hp text,
  wakil_ambil_nama text, wakil_ambil_nik text
);
CREATE INDEX idx_permohonan_opd ON public.permohonan (opd_id);
CREATE INDEX idx_permohonan_pemohon ON public.permohonan (pemohon_id);
CREATE INDEX idx_permohonan_status ON public.permohonan (status);

CREATE TABLE public.permohonan_rating (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  permohonan_id uuid NOT NULL REFERENCES public.permohonan(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skor integer NOT NULL CHECK (skor >= 1 AND skor <= 10),
  komentar text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (permohonan_id, user_id)
);

CREATE TABLE public.permohonan_riwayat (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  permohonan_id uuid NOT NULL REFERENCES public.permohonan(id) ON DELETE CASCADE,
  oleh uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aksi text NOT NULL, catatan text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_riwayat_permohonan ON public.permohonan_riwayat (permohonan_id);

CREATE TABLE public.push_subscription (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_push_subscription_user ON public.push_subscription (user_id);

CREATE TABLE public.rate_limit (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  identifier text NOT NULL, bucket text NOT NULL,
  window_start timestamptz DEFAULT now() NOT NULL,
  count integer DEFAULT 1 NOT NULL
);
CREATE INDEX idx_rate_limit_lookup ON public.rate_limit (identifier, bucket, window_start DESC);

CREATE TABLE public.verification_token (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '30 days') NOT NULL,
  used_at timestamptz, used_by uuid
);
CREATE INDEX idx_verification_token_token ON public.verification_token (token);

-- SQL-language functions (after tables exist)
CREATE FUNCTION public.get_user_desa(_user_id uuid) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$ SELECT desa FROM public.profiles WHERE id = _user_id LIMIT 1; $$;

CREATE FUNCTION public.get_user_opd(_user_id uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$ SELECT opd_id FROM public.profiles WHERE id = _user_id LIMIT 1; $$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE FUNCTION public.count_permohonan_bulan_ini() RETURNS integer
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$ SELECT COUNT(*)::int FROM public.permohonan WHERE tanggal_masuk >= date_trunc('month', now()); $$;

CREATE FUNCTION public.opd_kinerja_agg() RETURNS TABLE(opd_id uuid, status text, total bigint, total_hari_selesai numeric, jumlah_selesai bigint, tepat_waktu bigint, selesai_dengan_sla bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$
  SELECT p.opd_id, p.status::text, COUNT(*)::bigint,
    COALESCE(SUM(CASE WHEN p.status='selesai' AND p.tanggal_masuk IS NOT NULL AND p.updated_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (p.updated_at - p.tanggal_masuk))/86400.0 ELSE 0 END),0)::numeric,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tanggal_masuk IS NOT NULL AND p.updated_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL AND p.updated_at <= p.tenggat)::bigint,
    COUNT(*) FILTER (WHERE p.status='selesai' AND p.tenggat IS NOT NULL)::bigint
  FROM public.permohonan p GROUP BY p.opd_id, p.status;
$$;

CREATE FUNCTION public.opd_rating_agg() RETURNS TABLE(opd_id uuid, total_rating bigint, jumlah_rating bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$
  SELECT p.opd_id, COALESCE(SUM(r.skor),0)::bigint, COUNT(r.id)::bigint
  FROM public.permohonan p JOIN public.permohonan_rating r ON r.permohonan_id = p.id
  WHERE p.opd_id IS NOT NULL GROUP BY p.opd_id;
$$;

CREATE FUNCTION public.rating_list_admin() RETURNS TABLE(rating_id uuid, skor integer, komentar text, created_at timestamptz, user_id uuid, pemohon_nama text, permohonan_id uuid, permohonan_kode text, permohonan_judul text, opd_id uuid, opd_singkatan text, opd_nama text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$
  SELECT r.id, r.skor, r.komentar, r.created_at, r.user_id,
    pr.nama_lengkap, p.id, p.kode, p.judul, p.opd_id, o.singkatan, o.nama
  FROM public.permohonan_rating r
  LEFT JOIN public.permohonan p ON p.id = r.permohonan_id
  LEFT JOIN public.opd o ON o.id = p.opd_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  WHERE public.has_role(auth.uid(),'super_admin') ORDER BY r.created_at DESC;
$$;

-- Plpgsql functions referencing tables (deferred but referenced after tables anyway)
CREATE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, no_hp, nik, desa) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', ''),
    NEW.raw_user_meta_data->>'no_hp',
    NEW.raw_user_meta_data->>'nik',
    NEW.raw_user_meta_data->>'desa'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'warga') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.log_permohonan_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
  AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah)
    VALUES (auth.uid(),'permohonan.status_changed','permohonan',NEW.id::text,
      jsonb_build_object('status',OLD.status), jsonb_build_object('status',NEW.status));
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.riwayat_dengan_petugas(_permohonan_id uuid) RETURNS TABLE(id uuid, created_at timestamptz, aksi text, catatan text, oleh uuid, nama_petugas text, email_petugas text)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
  AS $$
DECLARE _opd uuid; _pemohon uuid;
BEGIN
  SELECT opd_id, pemohon_id INTO _opd, _pemohon FROM public.permohonan WHERE id = _permohonan_id;
  IF _opd IS NULL THEN RETURN; END IF;
  IF NOT (auth.uid() = _pemohon OR public.has_role(auth.uid(),'super_admin')
      OR (public.has_role(auth.uid(),'admin_opd') AND _opd = public.get_user_opd(auth.uid()))) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT r.id, r.created_at, r.aksi, r.catatan, r.oleh,
      COALESCE(p.nama_lengkap,''), COALESCE(u.email,'')
    FROM public.permohonan_riwayat r
    LEFT JOIN public.profiles p ON p.id = r.oleh
    LEFT JOIN auth.users u ON u.id = r.oleh
    WHERE r.permohonan_id = _permohonan_id ORDER BY r.created_at ASC;
END $$;
