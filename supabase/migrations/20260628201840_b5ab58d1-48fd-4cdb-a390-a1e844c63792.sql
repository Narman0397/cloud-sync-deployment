
ALTER TABLE public.signature_providers DROP CONSTRAINT IF EXISTS signature_providers_kind_check;
ALTER TABLE public.signature_providers ADD CONSTRAINT signature_providers_kind_check CHECK (kind = 'internal');
INSERT INTO public.signature_providers (code, name, kind, status, config)
VALUES ('internal', 'Internal Sistem', 'internal', 'active', '{}'::jsonb)
ON CONFLICT (code) DO UPDATE SET status = 'active', kind = 'internal', name = 'Internal Sistem';
