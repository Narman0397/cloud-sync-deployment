-- Batch A: enforce security_invoker on views (fix 2 ERROR-level lints)
ALTER VIEW public.aset_nilai_buku      SET (security_invoker = true);
ALTER VIEW public.v_permohonan_overdue SET (security_invoker = true);