ALTER TABLE public.layanan_publik
  ADD COLUMN IF NOT EXISTS dasar_hukum text,
  ADD COLUMN IF NOT EXISTS biaya text,
  ADD COLUMN IF NOT EXISTS produk_layanan text,
  ADD COLUMN IF NOT EXISTS jam_pelayanan text,
  ADD COLUMN IF NOT EXISTS sarana_prasarana text,
  ADD COLUMN IF NOT EXISTS kompetensi_pelaksana text,
  ADD COLUMN IF NOT EXISTS jumlah_pelaksana integer,
  ADD COLUMN IF NOT EXISTS jaminan_pelayanan text,
  ADD COLUMN IF NOT EXISTS jaminan_keamanan text,
  ADD COLUMN IF NOT EXISTS mekanisme_pengaduan text,
  ADD COLUMN IF NOT EXISTS evaluasi_kinerja text,
  ADD COLUMN IF NOT EXISTS maklumat_pelayanan text,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.aset_nilai_buku
  ADD COLUMN IF NOT EXISTS kode text,
  ADD COLUMN IF NOT EXISTS nama text,
  ADD COLUMN IF NOT EXISTS opd_id uuid,
  ADD COLUMN IF NOT EXISTS tanggal_perolehan date,
  ADD COLUMN IF NOT EXISTS umur_ekonomis_bulan integer,
  ADD COLUMN IF NOT EXISTS metode_susut text;

UPDATE public.aset_nilai_buku nb
SET
  kode = COALESCE(nb.kode, a.kode),
  nama = COALESCE(nb.nama, a.nama),
  opd_id = COALESCE(nb.opd_id, a.opd_id),
  tanggal_perolehan = COALESCE(nb.tanggal_perolehan, a.tanggal_perolehan),
  umur_ekonomis_bulan = COALESCE(nb.umur_ekonomis_bulan, a.umur_ekonomis_bulan),
  metode_susut = COALESCE(nb.metode_susut, a.metode_susut)
FROM public.aset a
WHERE nb.aset_id = a.id;

CREATE INDEX IF NOT EXISTS idx_aset_nilai_buku_opd_id ON public.aset_nilai_buku(opd_id);
CREATE INDEX IF NOT EXISTS idx_aset_nilai_buku_nilai_buku ON public.aset_nilai_buku(nilai_buku DESC);

ALTER TABLE public.signing_certificates
  ADD COLUMN IF NOT EXISTS rotated_from uuid REFERENCES public.signing_certificates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoke_reason text;

CREATE INDEX IF NOT EXISTS idx_signing_certificates_user_active ON public.signing_certificates(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status_opd_created ON public.signature_requests(status, opd_id, created_at DESC);

CREATE OR REPLACE VIEW public.v_dc_kpi
WITH (security_invoker = true)
AS
SELECT
  date_trunc('day', sr.created_at)::date AS day,
  sr.opd_id,
  count(*) FILTER (WHERE sr.status IN ('pending','sent'))::bigint AS pending,
  count(*) FILTER (WHERE sr.status = 'signed')::bigint AS signed,
  count(*) FILTER (WHERE sr.status = 'rejected')::bigint AS rejected,
  count(*) FILTER (WHERE sr.status = 'expired')::bigint AS expired,
  count(*) FILTER (WHERE sr.status = 'failed')::bigint AS failed,
  count(*)::bigint AS total,
  COALESCE(
    avg(EXTRACT(EPOCH FROM (sr.completed_at - sr.sent_at)))
      FILTER (WHERE sr.status = 'signed' AND sr.sent_at IS NOT NULL AND sr.completed_at IS NOT NULL),
    0
  )::numeric AS avg_turnaround_seconds
FROM public.signature_requests sr
GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.v_dc_provider_health
WITH (security_invoker = true)
AS
SELECT
  COALESCE(sp.code, 'internal') AS provider_code,
  COALESCE(sp.name, 'Internal') AS provider_name,
  COALESCE(sp.status, 'active') AS provider_status,
  count(*) FILTER (WHERE sr.created_at >= now() - interval '24 hours')::bigint AS requests_24h,
  count(*) FILTER (WHERE sr.status = 'signed' AND sr.completed_at >= now() - interval '24 hours')::bigint AS signed_24h,
  count(*) FILTER (WHERE sr.status = 'failed' AND sr.updated_at >= now() - interval '24 hours')::bigint AS failed_24h,
  count(*) FILTER (WHERE sr.status IN ('pending','sent'))::bigint AS pending_now,
  max(sr.updated_at) AS last_activity_at
FROM public.signature_requests sr
LEFT JOIN public.signature_providers sp ON sp.id = sr.provider_id
GROUP BY 1, 2, 3;

GRANT SELECT ON public.v_dc_kpi TO authenticated;
GRANT SELECT ON public.v_dc_kpi TO service_role;
GRANT SELECT ON public.v_dc_provider_health TO authenticated;
GRANT SELECT ON public.v_dc_provider_health TO service_role;

CREATE OR REPLACE FUNCTION public.executive_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_permohonan', (SELECT COUNT(*) FROM public.permohonan),
    'permohonan_bulan_ini', public.count_permohonan_bulan_ini(),
    'permohonan_selesai', (SELECT COUNT(*) FROM public.permohonan WHERE status = 'selesai'),
    'permohonan_diproses', (SELECT COUNT(*) FROM public.permohonan WHERE status = 'diproses'),
    'permohonan_baru', (SELECT COUNT(*) FROM public.permohonan WHERE status = 'baru'),
    'total_opd', (SELECT COUNT(*) FROM public.opd),
    'total_layanan', (SELECT COUNT(*) FROM public.layanan_publik WHERE COALESCE(aktif, true)),
    'total_user', (SELECT COUNT(*) FROM public.profiles),
    'avg_rating', COALESCE((SELECT AVG(skor)::numeric(10,2) FROM public.permohonan_rating), 0),
    'generated_at', now()
  )
$$;

GRANT EXECUTE ON FUNCTION public.executive_summary() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.executive_summary() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms(_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  f_id uuid;
  k jsonb;
  idx integer := 0;
BEGIN
  SELECT * INTO t FROM public.dataset_template WHERE id = _template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template tidak ditemukan';
  END IF;

  INSERT INTO public.forms (judul, deskripsi, opd_pemilik_id, deadline, allow_multiple_submit, status, created_by)
  VALUES (t.judul, t.deskripsi, COALESCE(t.opd_pemilik_id, t.opd_id), t.deadline, COALESCE(t.allow_multiple_submit, false), 'draft', t.created_by)
  RETURNING id INTO f_id;

  FOR k IN SELECT * FROM jsonb_array_elements(COALESCE(t.kolom, '[]'::jsonb)) LOOP
    INSERT INTO public.form_fields (form_id, kode, label, tipe, required, help, help_text, options, urutan)
    VALUES (
      f_id,
      COALESCE(k->>'key', 'field_' || idx),
      COALESCE(k->>'label', k->>'key', 'Field ' || idx),
      COALESCE(k->>'tipe', 'short_text'),
      COALESCE((k->>'required')::boolean, false),
      k->>'help',
      k->>'help',
      COALESCE(k->'options', '[]'::jsonb),
      idx
    );
    idx := idx + 1;
  END LOOP;

  UPDATE public.dataset_template SET aktif = false WHERE id = _template_id;
  RETURN f_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';