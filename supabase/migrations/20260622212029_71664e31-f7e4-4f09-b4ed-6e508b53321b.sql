
DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'narman208@gmail.com';
  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
      'narman208@gmail.com', crypt('Poogalampa97', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('nama_lengkap','narman','username','narman'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _uid,
      jsonb_build_object('sub', _uid::text, 'email','narman208@gmail.com','email_verified',true),
      'email', _uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('Poogalampa97', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = _uid;
  END IF;

  INSERT INTO public.profiles (id, nama_lengkap, username, status, verified_at, verification_status)
  VALUES (_uid, 'narman', 'narman', 'active', now(), 'verified')
  ON CONFLICT (id) DO UPDATE
    SET nama_lengkap = EXCLUDED.nama_lengkap,
        username = EXCLUDED.username,
        status = 'active',
        verified_at = now(),
        verification_status = 'verified',
        updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
