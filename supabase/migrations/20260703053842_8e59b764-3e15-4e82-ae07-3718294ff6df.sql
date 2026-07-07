
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS system_position text,
  ADD COLUMN IF NOT EXISTS golongan text,
  ADD COLUMN IF NOT EXISTS pangkat text,
  ADD COLUMN IF NOT EXISTS tempat_lahir text,
  ADD COLUMN IF NOT EXISTS tanggal_lahir date,
  ADD COLUMN IF NOT EXISTS jenis_kelamin text,
  ADD COLUMN IF NOT EXISTS alamat text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS numbering_rule_id uuid REFERENCES public.document_numbering_rules(id),
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.permohonan ADD COLUMN IF NOT EXISTS current_disposition_id uuid;

DROP FUNCTION IF EXISTS public.fn_approve_user(uuid, text);
DROP FUNCTION IF EXISTS public.fn_reject_user(uuid, text);
DROP FUNCTION IF EXISTS public.aset_compliance();
DROP FUNCTION IF EXISTS public.aset_due_warranty();
DROP FUNCTION IF EXISTS public.fn_susut_bulanan_run();

CREATE OR REPLACE FUNCTION public.fn_approve_user(_target_user_id uuid, _role text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.profiles SET verification_status='verified', verified_at=now(), verified_by=auth.uid() WHERE id=_target_user_id;
  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_target_user_id, _role::public.app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_reject_user(_target_user_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.profiles SET verification_status='rejected' WHERE id=_target_user_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.aset_compliance(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.aset_due_warranty(_days int DEFAULT 30)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run(_periode text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('ok', true) $$;

CREATE OR REPLACE FUNCTION public.attendance_compliance(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.opd_attendance_today(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(_bulan int DEFAULT NULL, _tahun int DEFAULT NULL, _opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.attendance_device_alert(_hours int DEFAULT 24)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

GRANT EXECUTE ON FUNCTION
  public.attendance_compliance(date,date),
  public.opd_attendance_today(uuid),
  public.attendance_rekap_bulanan(int,int,uuid),
  public.attendance_device_alert(int),
  public.get_effective_permissions(uuid),
  public.fn_approve_user(uuid,text),
  public.fn_reject_user(uuid,text),
  public.aset_compliance(uuid),
  public.aset_due_warranty(int),
  public.fn_susut_bulanan_run(text)
  TO authenticated, service_role;
