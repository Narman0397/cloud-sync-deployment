UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  recovery_token = COALESCE(recovery_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, '')
WHERE confirmation_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR recovery_token IS NULL
   OR reauthentication_token IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL;

-- Reset password untuk 4 akun ke 'Poogalampa97' & pastikan confirmed
UPDATE auth.users
SET encrypted_password = crypt('Poogalampa97', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email IN ('narman208@gmail.com','narman3397@gmail.com','narman33970011@gmail.com','narman33970012@gmail.com');