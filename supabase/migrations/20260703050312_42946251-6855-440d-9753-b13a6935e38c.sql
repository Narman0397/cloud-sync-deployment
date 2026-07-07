
-- === 20260610100834_70bcb488-88c7-46a2-8b60-23207155ea26.sql ===
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.app_role AS ENUM ('warga','admin_opd','super_admin','admin_desa','asn');
CREATE TYPE public.job_status AS ENUM ('pending','running','success','failed','dead');
CREATE TYPE public.status_permohonan AS ENUM ('baru','diproses','selesai','ditolak');

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
