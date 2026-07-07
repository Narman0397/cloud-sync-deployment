
DO $$
DECLARE
  _opd_any uuid;
  r record;
  emails text[] := ARRAY['narman208@gmail.com','narman3397@gmail.com','narman33970011@gmail.com','narman33970012@gmail.com'];
  names text[] := ARRAY['Narman Super Admin','Narman ASN','Narman Admin Desa','Narman Warga'];
  roles text[] := ARRAY['super_admin','asn','admin_desa','warga'];
  i int;
  _uid uuid;
BEGIN
  SELECT id INTO _opd_any FROM public.opd ORDER BY nama LIMIT 1;

  FOR i IN 1..4 LOOP
    SELECT id INTO _uid FROM auth.users WHERE email = emails[i];
    IF _uid IS NULL THEN
      _uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', _uid, 'authenticated','authenticated',
        emails[i], crypt('Poogalampa97', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nama_lengkap', names[i]),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), _uid,
        jsonb_build_object('sub', _uid::text, 'email', emails[i], 'email_verified', true),
        'email', _uid::text, now(), now(), now());
    ELSE
      -- Reset password & confirm
      UPDATE auth.users SET
        encrypted_password = crypt('Poogalampa97', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
      WHERE id = _uid;
    END IF;

    INSERT INTO public.profiles (id, nama_lengkap, verification_status, requested_role, verified_at)
    VALUES (_uid, names[i], 'verified', roles[i]::public.app_role, now())
    ON CONFLICT (id) DO UPDATE SET
      nama_lengkap = EXCLUDED.nama_lengkap,
      verification_status = 'verified',
      verified_at = now(),
      requested_role = EXCLUDED.requested_role;

    IF roles[i] = 'asn' AND _opd_any IS NOT NULL THEN
      UPDATE public.profiles SET opd_id = _opd_any, asn_type = 'pns', nip = '199001012020011001' WHERE id = _uid;
    ELSIF roles[i] IN ('admin_desa','warga') THEN
      UPDATE public.profiles SET desa = 'Desa Contoh' WHERE id = _uid;
    END IF;

    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, roles[i]::public.app_role)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
