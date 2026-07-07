
ALTER TABLE public.signature_requests ADD COLUMN IF NOT EXISTS submission_id uuid;
ALTER TABLE public.generated_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asn_type text, ADD COLUMN IF NOT EXISTS requested_role text;
ALTER TABLE public.workflow_definitions ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.aset_nilai_buku ADD COLUMN IF NOT EXISTS opd_id uuid;

CREATE OR REPLACE FUNCTION public.fn_approve_user(_user_id uuid, _role text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.profiles SET verification_status='verified', verified_at=now(), verified_by=auth.uid() WHERE id=_user_id;
  IF _role IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role::public.app_role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_reject_user(_user_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.profiles SET verification_status='rejected' WHERE id=_user_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.aset_compliance()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.aset_due_warranty()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '[]'::jsonb $$;

CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('ok', true) $$;

GRANT EXECUTE ON FUNCTION public.fn_approve_user(uuid,text), public.fn_reject_user(uuid,text), public.aset_compliance(), public.aset_due_warranty(), public.fn_susut_bulanan_run() TO authenticated, service_role;
