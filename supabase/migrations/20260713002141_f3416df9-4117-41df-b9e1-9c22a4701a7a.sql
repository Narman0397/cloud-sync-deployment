-- Bersihkan duplikat sebelum menambah unique constraint
DELETE FROM public.nomor_surat_sequence a
USING public.nomor_surat_sequence b
WHERE a.ctid < b.ctid AND a.opd_id IS NOT DISTINCT FROM b.opd_id AND a.tahun = b.tahun;

ALTER TABLE public.nomor_surat_sequence
  ADD CONSTRAINT nomor_surat_sequence_opd_tahun_key UNIQUE (opd_id, tahun);

DELETE FROM public.nomor_surat_issued a
USING public.nomor_surat_issued b
WHERE a.ctid < b.ctid AND a.nomor = b.nomor;

ALTER TABLE public.nomor_surat_issued
  ADD CONSTRAINT nomor_surat_issued_nomor_key UNIQUE (nomor);