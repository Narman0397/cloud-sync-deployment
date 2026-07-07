CREATE OR REPLACE FUNCTION public.fn_approve_user(_target_user_id uuid, _role public.app_role, _method text DEFAULT 'manual') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN UPDATE public.profiles SET verification_status='verified', verified_at=now(), verified_by=auth.uid(), requested_role=COALESCE(_role, requested_role), verification_method=_method WHERE id=_target_user_id; INSERT INTO public.user_roles(user_id, role) VALUES (_target_user_id, _role) ON CONFLICT DO NOTHING; RETURN jsonb_build_object('ok', true); END $$;

CREATE OR REPLACE FUNCTION public.fn_reject_user(_target_user_id uuid, _reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN UPDATE public.profiles SET verification_status='rejected', rejected_at=now(), rejected_by=auth.uid(), rejection_reason=_reason WHERE id=_target_user_id; RETURN jsonb_build_object('ok', true); END $$;

CREATE OR REPLACE FUNCTION public.aset_compliance(_opd_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('total', count(*), 'verified', count(*) FILTER (WHERE last_verified_at IS NOT NULL), 'needs_attention', count(*) FILTER (WHERE status <> 'aktif')) FROM public.aset WHERE _opd_id IS NULL OR opd_id=_opd_id
$$;

CREATE OR REPLACE FUNCTION public.aset_due_warranty(_days integer DEFAULT 30)
RETURNS TABLE(aset_id uuid, kode text, nama text, opd_id uuid, jenis text, due_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, kode, nama, opd_id, 'garansi'::text, garansi_sampai FROM public.aset
  WHERE garansi_sampai IS NOT NULL AND garansi_sampai <= CURRENT_DATE + COALESCE(_days,30)
  UNION ALL
  SELECT id, kode, nama, opd_id, 'kalibrasi'::text, kalibrasi_berikut FROM public.aset
  WHERE kalibrasi_berikut IS NOT NULL AND kalibrasi_berikut <= CURRENT_DATE + COALESCE(_days,30)
$$;

CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run(_periode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN jsonb_build_object('inserted', 0, 'skipped', 0, 'periode', _periode); END $$;

CREATE OR REPLACE FUNCTION public.attendance_compliance(_user_id uuid, _from date, _to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('total', count(*), 'late', count(*) FILTER (WHERE is_late), 'late_minutes', COALESCE(sum(late_minutes),0)) FROM public.absensi_asn WHERE user_id=_user_id AND waktu::date BETWEEN _from AND _to
$$;

CREATE OR REPLACE FUNCTION public.opd_attendance_today(_opd_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, nama_lengkap text, opd_id uuid, tipe text, waktu timestamptz, is_late boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id, COALESCE(p.nama_lengkap,''), a.opd_id, a.tipe, a.waktu, a.is_late FROM public.absensi_asn a LEFT JOIN public.profiles p ON p.id=a.user_id WHERE a.waktu::date=CURRENT_DATE AND (_opd_id IS NULL OR a.opd_id=_opd_id)
$$;

CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(_user_id uuid, _year integer, _month integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('hadir', count(*), 'late', count(*) FILTER (WHERE is_late), 'late_minutes', COALESCE(sum(late_minutes),0)) FROM public.absensi_asn WHERE user_id=_user_id AND EXTRACT(YEAR FROM waktu)=_year AND EXTRACT(MONTH FROM waktu)=_month
$$;

CREATE OR REPLACE FUNCTION public.attendance_device_alert(_days integer DEFAULT 30)
RETURNS TABLE(user_id uuid, device_fingerprint_hash text, total bigint, last_seen timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, device_fingerprint_hash, count(*), max(waktu) FROM public.absensi_asn WHERE device_fingerprint_hash IS NOT NULL AND waktu >= now() - make_interval(days => COALESCE(_days,30)) GROUP BY user_id, device_fingerprint_hash HAVING count(*) > 1
$$;

CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(permission_code) FILTER (WHERE granted AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())), ARRAY[]::text[])
  FROM public.user_permissions WHERE user_id=_user_id
$$;

CREATE TABLE IF NOT EXISTS public.signature_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id uuid NOT NULL REFERENCES public.signature_request_signers(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'active',
  delegated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_delegations TO authenticated;
GRANT ALL ON public.signature_delegations TO service_role;
ALTER TABLE public.signature_delegations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_sig_deleg" ON public.signature_delegations;
CREATE POLICY "auth_read_sig_deleg" ON public.signature_delegations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_sig_deleg" ON public.signature_delegations;
CREATE POLICY "admin_write_sig_deleg" ON public.signature_delegations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'super_admin'::public.app_role));

GRANT EXECUTE ON FUNCTION public.fn_approve_user(uuid,public.app_role,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_reject_user(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aset_compliance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.aset_due_warranty(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attendance_compliance(uuid,date,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.opd_attendance_today(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attendance_rekap_bulanan(uuid,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attendance_device_alert(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated, service_role;