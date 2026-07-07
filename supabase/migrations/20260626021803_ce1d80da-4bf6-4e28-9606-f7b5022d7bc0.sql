
UPDATE public.profiles SET username = lower(btrim(username)) WHERE username IS NOT NULL AND username <> lower(btrim(username));

WITH dups AS (
  SELECT id, username,
    ROW_NUMBER() OVER (PARTITION BY lower(username) ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.profiles WHERE username IS NOT NULL
)
UPDATE public.profiles p SET username = d.username || '-' || d.rn
FROM dups d WHERE p.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

DROP FUNCTION IF EXISTS public.fn_reject_user(uuid, text);

CREATE FUNCTION public.fn_reject_user(_target_user_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_super boolean; _is_pemda boolean;
  _target_opd uuid; _target_desa text; _target_role text;
  _caller_opd uuid; _caller_desa text;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Tidak terautentikasi'; END IF;
  IF _target_user_id = _caller THEN RAISE EXCEPTION 'Tidak dapat menolak akun sendiri'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi minimal 5 karakter';
  END IF;

  _is_super := public.has_role(_caller,'super_admin');
  _is_pemda := public.has_role(_caller,'admin_pemda');

  SELECT opd_id, desa, requested_role INTO _target_opd, _target_desa, _target_role
  FROM public.profiles WHERE id = _target_user_id;
  SELECT opd_id, desa INTO _caller_opd, _caller_desa
  FROM public.profiles WHERE id = _caller;

  IF NOT (_is_super OR _is_pemda) THEN
    IF _target_role = 'asn' AND (NOT public.has_role(_caller,'admin_opd') OR _caller_opd IS NULL OR _caller_opd <> _target_opd) THEN
      RAISE EXCEPTION 'Admin OPD hanya dapat menolak ASN di OPD-nya';
    ELSIF _target_role = 'warga' AND (NOT public.has_role(_caller,'admin_desa') OR _caller_desa IS NULL OR _caller_desa <> _target_desa) THEN
      RAISE EXCEPTION 'Admin Desa hanya dapat menolak warga di desanya';
    ELSIF _target_role IN ('admin_opd','admin_desa') THEN
      RAISE EXCEPTION 'Hanya Super Admin / Admin Pemda yang dapat menolak role %', _target_role;
    END IF;
  END IF;

  UPDATE public.profiles
  SET verification_status = 'rejected',
      rejected_at = now(), rejected_by = _caller,
      rejection_reason = btrim(_reason),
      verified_at = NULL, verified_by = NULL
  WHERE id = _target_user_id;

  INSERT INTO public.audit_log (user_id, aksi, entitas, entitas_id, data_sesudah)
  VALUES (_caller, 'user.rejected', 'profile', _target_user_id::text,
    jsonb_build_object('reason', _reason, 'requested_role', _target_role));

  RETURN jsonb_build_object('ok', true, 'user_id', _target_user_id);
END;
$$;
