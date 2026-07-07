CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

INSERT INTO public.opd (nama, singkatan, kategori)
VALUES ('Sekretariat Daerah', 'SETDA', ARRAY['umum','pemerintahan'])
ON CONFLICT DO NOTHING;

INSERT INTO public.app_setting (key, value) VALUES
  ('branding.nama_instansi', '"Pemerintah Daerah"'::jsonb),
  ('branding.nama_singkat', '"PEMDA"'::jsonb),
  ('branding.tagline', '"Pelayanan Publik Terpadu"'::jsonb)
ON CONFLICT (key) DO NOTHING;