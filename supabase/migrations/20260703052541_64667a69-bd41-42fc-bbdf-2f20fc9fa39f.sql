SET search_path = public;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('warga','admin_opd','super_admin','admin_desa','asn','admin_pemda','pimpinan'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.bast_status AS ENUM ('draft','issued','approved','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.checklist_status AS ENUM ('todo','in_progress','done','na'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.izin_jenis AS ENUM ('cuti_tahunan','cuti_sakit','dinas_luar','wfh','lainnya'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.izin_status AS ENUM ('pending','approved','rejected','dibatalkan'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.job_status AS ENUM ('pending','running','success','failed','dead'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.metode_susut AS ENUM ('garis_lurus','saldo_menurun'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mutasi_status AS ENUM ('pending','approved','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.retry_status AS ENUM ('pending','retrying','success','dead_letter','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.shift_jenis AS ENUM ('pagi','malam','khusus'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sla_event_type AS ENUM ('pause','resume','reset'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.submission_status AS ENUM ('draft','submitted','approved','rejected','revision'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.uat_result_status AS ENUM ('pass','partial','fail'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_pemda';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pimpinan';

-- absensi_asn extra columns
ALTER TABLE public.absensi_asn
  ADD COLUMN IF NOT EXISTS device_fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS is_late boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS late_minutes integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS schedule_id uuid;

ALTER TABLE public.app_setting
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'internal' NOT NULL,
  ADD COLUMN IF NOT EXISTS public_visible boolean DEFAULT false NOT NULL;

ALTER TABLE public.aset
  ADD COLUMN IF NOT EXISTS kib text,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS qr_token text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS garansi_sampai date,
  ADD COLUMN IF NOT EXISTS kalibrasi_berikut date,
  ADD COLUMN IF NOT EXISTS umur_ekonomis_bulan integer,
  ADD COLUMN IF NOT EXISTS metode_susut text,
  ADD COLUMN IF NOT EXISTS dokumen_kehilangan_url text,
  ADD COLUMN IF NOT EXISTS nilai_sisa numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.aset_bast (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nomor text NOT NULL,
  pemberi_user uuid, penerima_user uuid, opd_id uuid,
  tanggal date DEFAULT CURRENT_DATE NOT NULL,
  catatan text,
  status text DEFAULT 'issued' NOT NULL,
  created_by uuid, approved_by uuid, approved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_bast_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bast_id uuid NOT NULL, aset_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_mutasi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aset_id uuid NOT NULL,
  dari_user uuid, ke_user uuid, dari_opd uuid, ke_opd uuid,
  alasan text, diajukan_oleh uuid,
  status text DEFAULT 'pending' NOT NULL,
  catatan text, ttd_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  approved_by uuid, approved_at timestamptz, catatan_approval text
);
CREATE TABLE IF NOT EXISTS public.aset_opname (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opd_id uuid, periode text NOT NULL,
  status text DEFAULT 'open' NOT NULL,
  catatan text, dibuat_oleh uuid, ditutup_oleh uuid, closed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_opname_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opname_id uuid NOT NULL, aset_id uuid NOT NULL,
  hadir boolean, kondisi_temuan text, catatan text,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_pemeliharaan (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aset_id uuid NOT NULL, opd_id uuid,
  jenis text, deskripsi text, jadwal date, selesai_at timestamptz,
  biaya numeric DEFAULT 0, vendor text,
  status text DEFAULT 'dijadwalkan' NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_penyusutan_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aset_id uuid NOT NULL, periode text NOT NULL,
  susut_bulan numeric DEFAULT 0 NOT NULL,
  akumulasi numeric DEFAULT 0 NOT NULL,
  nilai_buku numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_verification_campaign (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nama text NOT NULL, opd_id uuid,
  status text DEFAULT 'open' NOT NULL,
  catatan text, created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deskripsi text, periode_mulai date, periode_selesai date,
  target_opd_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL
);
CREATE TABLE IF NOT EXISTS public.aset_verification_item (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL, aset_id uuid NOT NULL,
  verified boolean DEFAULT false, kondisi text, catatan text,
  verified_by uuid, verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  opd_id uuid,
  status text DEFAULT 'belum' NOT NULL,
  lat numeric, lng numeric, lokasi_text text, foto_url text
);
CREATE TABLE IF NOT EXISTS public.attendance_shift_assignment (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL, shift_id uuid NOT NULL,
  dari date NOT NULL, sampai date,
  aktif boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.attendance_shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opd_id uuid, nama text NOT NULL,
  jam_masuk time NOT NULL, jam_pulang time NOT NULL,
  toleransi_menit integer DEFAULT 15 NOT NULL,
  jenis text DEFAULT 'pagi' NOT NULL,
  aktif boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

DO $g$ DECLARE t text; tables text[] := ARRAY['aset_bast','aset_bast_items','aset_mutasi','aset_opname','aset_opname_items','aset_pemeliharaan','aset_penyusutan_history','aset_verification_campaign','aset_verification_item','attendance_shift_assignment','attendance_shifts'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "auth_all_%s" ON public.%I TO authenticated USING (public.has_role(auth.uid(),''super_admin'') OR public.has_role(auth.uid(),''admin_opd'')) WITH CHECK (public.has_role(auth.uid(),''super_admin'') OR public.has_role(auth.uid(),''admin_opd''))', t, t);
  END LOOP;
END $g$;