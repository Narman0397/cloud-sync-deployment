REVOKE EXECUTE ON FUNCTION public.fn_generate_laporan_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_laporan_before_insert() FROM PUBLIC, anon, authenticated;