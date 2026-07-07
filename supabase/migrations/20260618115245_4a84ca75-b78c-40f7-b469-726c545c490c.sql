CREATE INDEX IF NOT EXISTS idx_permohonan_pemohon_status
  ON public.permohonan(pemohon_id, status);

CREATE INDEX IF NOT EXISTS idx_aset_opd_status_active
  ON public.aset(opd_id, status) WHERE status <> 'dihapuskan';