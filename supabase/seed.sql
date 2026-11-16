-- Datos solo para el Supabase LOCAL (supabase start / supabase db reset).
-- No se aplica al remoto: `supabase db push` no ejecuta el seed.
--
-- Usuario de prueba local:
--   email:      test@bbscloset.test
--   contraseña: bbs-9efa1a46e973
-- El trigger de 0005 crea su fila en profiles.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'test@bbscloset.test',
  crypt('bbs-9efa1a46e973', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'email',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"test@bbscloset.test","email_verified":true}',
  now(), now(), now()
);

-- Segundo usuario de prueba local (para comprobar el aislamiento por RLS):
--   email:      test2@bbscloset.test
--   contraseña: bbs-f98dcc7b08ea

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated',
  'test2@bbscloset.test',
  crypt('bbs-f98dcc7b08ea', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'email',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"test2@bbscloset.test","email_verified":true}',
  now(), now(), now()
);
