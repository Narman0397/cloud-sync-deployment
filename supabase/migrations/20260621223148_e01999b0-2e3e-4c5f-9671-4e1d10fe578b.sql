SET search_path = public;

-- aset: add all missing columns referenced by code
ALTER TABLE public.aset
  ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'aktif',
  ADD COLUMN IF NOT EXISTS qr_token text,
  ADD COLUMN IF NOT EXISTS kib text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS garansi_sampai date,
  ADD COLUMN IF NOT EXISTS kalibrasi_berikut date,
  ADD COLUMN IF NOT EXISTS umur_ekonomis_bulan integer,
  ADD COLUMN IF NOT EXISTS metode_susut text,
  ADD COLUMN IF NOT EXISTS dokumen_kehilangan_url text,
  ADD COLUMN IF NOT EXISTS nilai_sisa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS merk text,
  ADD COLUMN IF NOT EXISTS nomor_seri text,
  ADD COLUMN IF NOT EXISTS lokasi_terkini text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

-- aset_nilai_buku: add opd_id alias
ALTER TABLE public.aset_nilai_buku ADD COLUMN IF NOT EXISTS opd_id uuid;

-- profiles: add missing columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS system_position text,
  ADD COLUMN IF NOT EXISTS requested_role text,
  ADD COLUMN IF NOT EXISTS pangkat text,
  ADD COLUMN IF NOT EXISTS golongan text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS nip text,
  ADD COLUMN IF NOT EXISTS jabatan text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS asn_type text;

-- Recreate stub RPCs with the parameter names the callers use
DROP FUNCTION IF EXISTS public.attendance_compliance(uuid, date, date);
CREATE OR REPLACE FUNCTION public.attendance_compliance(_opd_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.attendance_device_alert(uuid);
CREATE OR REPLACE FUNCTION public.attendance_device_alert(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.attendance_rekap_bulanan(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(_opd_id uuid DEFAULT NULL, _tahun integer DEFAULT NULL, _bulan integer DEFAULT NULL, _user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.aset_due_warranty(integer);
CREATE OR REPLACE FUNCTION public.aset_due_warranty(_opd_id uuid DEFAULT NULL, _days integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.aset_compliance();
CREATE OR REPLACE FUNCTION public.aset_compliance(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.opd_attendance_today(uuid);
CREATE OR REPLACE FUNCTION public.opd_attendance_today(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.opd_kinerja_trend(uuid);
CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.layanan_kinerja_agg(uuid);
CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

DROP FUNCTION IF EXISTS public.fn_ikm_dashboard(uuid);
CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '{}'::jsonb $$;

-- Permissions
DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public' AND p.proname IN (
      'attendance_compliance','attendance_device_alert','attendance_rekap_bulanan',
      'aset_due_warranty','aset_compliance','opd_attendance_today',
      'opd_kinerja_trend','layanan_kinerja_agg','fn_ikm_dashboard'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;