-- Batch D: Search Path Hardening
-- Set explicit search_path on two trigger functions to prevent search_path hijack.
-- Impact: none (triggers continue to work identically).
ALTER FUNCTION public.tg_pengajuan_izin_set_saldo_flag() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_bump_version_number()           SET search_path = public, pg_temp;