-- Batch B: High-Risk Function Privilege Hardening
-- D1: retention cleanup — only cron (supabaseAdmin)
REVOKE EXECUTE ON FUNCTION public.fn_retention_cleanup()         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_retention_cleanup()         TO service_role;

-- D2: susut bulanan — admin & cron via supabaseAdmin
REVOKE EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text)     FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text)     TO service_role;

-- D3: migrasi dataset — admin via server fn (supabaseAdmin), keep authenticated for safety
REVOKE EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO authenticated, service_role;

-- D4: nomor surat — admin OPD via user JWT
REVOKE EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) TO authenticated, service_role;

-- D5: rate-limit increment — server-only
REVOKE EXECUTE ON FUNCTION public.rate_limit_increment(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rate_limit_increment(text, text, timestamptz) TO service_role;