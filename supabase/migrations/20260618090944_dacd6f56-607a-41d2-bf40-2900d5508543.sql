DO $$
DECLARE
  _uid uuid;
  _email text := 'narman208@gmail.com';
  _username text := 'narman';
  _password text := 'Poogalampa97';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email;

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
      _email, extensions.crypt(_password, extensions.gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('username',_username,'nama_lengkap','Narman','requested_role','super_admin'),
      '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), _uid, _uid,
      jsonb_build_object('sub',_uid::text,'email',_email,'email_verified',true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = _uid;
  END IF;

  INSERT INTO public.profiles (id, username, nama_lengkap, verification_status, verified_at, verification_method, requested_role)
  VALUES (_uid, _username, 'Narman', 'verified', now(), 'superadmin', 'super_admin')
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        nama_lengkap = COALESCE(public.profiles.nama_lengkap, EXCLUDED.nama_lengkap),
        verification_status = 'verified',
        verified_at = COALESCE(public.profiles.verified_at, now()),
        verification_method = COALESCE(public.profiles.verification_method, 'superadmin');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_log (user_id, aksi, entitas, entitas_id, data_sesudah)
  VALUES (NULL, 'user.bootstrap_superadmin', 'profile', _uid::text,
    jsonb_build_object('email', _email, 'username', _username));
END $$;