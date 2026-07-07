
-- ============================================================
-- STORAGE RLS POLICIES (6 buckets)
-- ============================================================
DROP POLICY IF EXISTS "berkas_permohonan_select" ON storage.objects;
DROP POLICY IF EXISTS "berkas_permohonan_insert" ON storage.objects;
DROP POLICY IF EXISTS "berkas_permohonan_delete" ON storage.objects;
CREATE POLICY "berkas_permohonan_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'berkas-permohonan');
CREATE POLICY "berkas_permohonan_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'berkas-permohonan');
CREATE POLICY "berkas_permohonan_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'berkas-permohonan' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin_opd') OR public.has_role(auth.uid(),'super_admin')));

DROP POLICY IF EXISTS "signed_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "signed_documents_insert" ON storage.objects;
CREATE POLICY "signed_documents_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signed-documents');
CREATE POLICY "signed_documents_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signed-documents');

DROP POLICY IF EXISTS "aset_foto_select" ON storage.objects;
DROP POLICY IF EXISTS "aset_foto_write" ON storage.objects;
CREATE POLICY "aset_foto_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'aset-foto');
CREATE POLICY "aset_foto_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'aset-foto');

DROP POLICY IF EXISTS "share_files_select" ON storage.objects;
DROP POLICY IF EXISTS "share_files_write" ON storage.objects;
CREATE POLICY "share_files_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'share-files');
CREATE POLICY "share_files_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'share-files');

DROP POLICY IF EXISTS "branding_select" ON storage.objects;
DROP POLICY IF EXISTS "branding_write" ON storage.objects;
CREATE POLICY "branding_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'branding');
CREATE POLICY "branding_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda')));

DROP POLICY IF EXISTS "pejabat_foto_select" ON storage.objects;
DROP POLICY IF EXISTS "pejabat_foto_write" ON storage.objects;
CREATE POLICY "pejabat_foto_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pejabat-foto');
CREATE POLICY "pejabat_foto_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pejabat-foto' AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_pemda') OR public.has_role(auth.uid(),'admin_opd')));

-- ============================================================
-- SEED: PERMISSIONS CATALOG
-- ============================================================
INSERT INTO public.permissions (code, label, kategori, description) VALUES
  ('can_create_form','Membuat Form','forms','Membuat form/dataset baru'),
  ('can_edit_form','Mengedit Form','forms','Mengubah form yang sudah ada'),
  ('can_publish_form','Publish Form','forms','Mempublikasikan form'),
  ('can_assign_form','Assign Form','forms','Menugaskan form ke pengguna/OPD'),
  ('can_verify_submission','Verifikasi Submission','submissions','Memverifikasi pengajuan'),
  ('can_approve_submission','Approve Submission','submissions','Menyetujui pengajuan'),
  ('can_reject_submission','Reject Submission','submissions','Menolak pengajuan'),
  ('can_request_revision','Minta Revisi','submissions','Meminta revisi pengajuan'),
  ('can_view_sensitive_document','Lihat Dokumen Sensitif','documents','Melihat dokumen rahasia'),
  ('can_download_document','Download Dokumen','documents','Mengunduh dokumen'),
  ('can_share_document','Bagikan Dokumen','documents','Membagikan dokumen'),
  ('can_request_document','Permintaan Dokumen','documents','Meminta dokumen'),
  ('can_manage_users','Kelola Pengguna','users','Manajemen pengguna sistem'),
  ('can_manage_opd','Kelola OPD','admin','Manajemen data OPD'),
  ('can_view_audit_logs','Lihat Audit Log','admin','Melihat log audit'),
  ('can_export_data','Ekspor Data','data','Mengekspor data ke file'),
  ('can_manage_roles','Kelola Peran','users','Manajemen role & permission'),
  ('can_manage_forms','Kelola Forms','forms','Manajemen seluruh form'),
  ('can_request_data','Permintaan Data','data','Meminta data terpadu'),
  ('can_approve_data_request','Approve Permintaan Data','data','Menyetujui permintaan data'),
  ('can_approve_registration','Approve Registrasi','users','Menyetujui registrasi user baru'),
  ('view_all_opd','Lihat Semua OPD','pemda','Akses lintas OPD'),
  ('view_all_submissions','Lihat Semua Submission','pemda','Lintas OPD'),
  ('view_all_attendance','Lihat Semua Absensi','pemda','Lintas OPD'),
  ('view_all_assets','Lihat Semua Aset','pemda','Lintas OPD'),
  ('view_all_datasets','Lihat Semua Dataset','pemda','Lintas OPD'),
  ('view_all_reports','Lihat Semua Laporan','pemda','Lintas OPD'),
  ('view_all_performance','Lihat Semua Kinerja','pemda','Lintas OPD'),
  ('view_all_surveys','Lihat Semua Survei','pemda','Lintas OPD'),
  ('view_kabupaten_dashboard','Dashboard Kabupaten','pemda','Dashboard tingkat kabupaten'),
  ('view_executive_dashboard','Dashboard Eksekutif','executive','Dashboard pimpinan'),
  ('view_cross_opd_analytics','Analitik Lintas OPD','pemda','Analitik gabungan'),
  ('pemda.view','Pemda: Lihat','pemda','View-only pemda'),
  ('pemda.manage','Pemda: Kelola','pemda','Kelola pemda'),
  ('pemda.monitor','Pemda: Monitor','pemda','Monitor pemda'),
  ('executive.view','Eksekutif: Lihat','executive','View eksekutif'),
  ('executive.approve','Eksekutif: Approve','executive','Approve eksekutif (Bupati)'),
  ('executive.sign','Eksekutif: TTD','executive','Tanda tangan eksekutif (Bupati)'),
  ('executive.disposition','Eksekutif: Disposisi','executive','Disposisi eksekutif (Bupati)')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, kategori = EXCLUDED.kategori, description = EXCLUDED.description;

-- ============================================================
-- SEED: KATEGORI LAYANAN
-- ============================================================
INSERT INTO public.kategori_layanan (nama, slug, sla_hari, deskripsi, aktif) VALUES
  ('Administrasi Kependudukan','adminduk',7,'Layanan terkait dokumen kependudukan',true),
  ('Perizinan Usaha','perizinan-usaha',14,'Pengurusan izin usaha & investasi',true),
  ('Pendidikan','pendidikan',10,'Layanan bidang pendidikan',true),
  ('Kesehatan','kesehatan',7,'Layanan kesehatan masyarakat',true),
  ('Sosial','sosial',10,'Bantuan sosial & pemberdayaan',true),
  ('Pertanahan','pertanahan',14,'Layanan pertanahan',true),
  ('Lingkungan','lingkungan',14,'Izin & layanan lingkungan',true),
  ('Lainnya','lainnya',7,'Layanan umum lainnya',true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: HARI LIBUR NASIONAL 2026
-- ============================================================
INSERT INTO public.hari_libur (tanggal, nama, jenis, nasional) VALUES
  ('2026-01-01','Tahun Baru Masehi','nasional',true),
  ('2026-02-17','Tahun Baru Imlek 2577','nasional',true),
  ('2026-03-19','Hari Raya Nyepi','nasional',true),
  ('2026-03-20','Isra Mikraj Nabi Muhammad SAW','nasional',true),
  ('2026-04-03','Wafat Isa Almasih','nasional',true),
  ('2026-04-05','Hari Paskah','nasional',true),
  ('2026-05-01','Hari Buruh Internasional','nasional',true),
  ('2026-05-14','Kenaikan Isa Almasih','nasional',true),
  ('2026-05-21','Hari Raya Idul Fitri 1447 H','nasional',true),
  ('2026-05-22','Hari Raya Idul Fitri 1447 H','nasional',true),
  ('2026-06-01','Hari Lahir Pancasila','nasional',true),
  ('2026-06-01','Hari Raya Waisak','nasional',true),
  ('2026-07-28','Hari Raya Idul Adha 1447 H','nasional',true),
  ('2026-08-17','Hari Kemerdekaan RI','nasional',true),
  ('2026-08-18','Tahun Baru Islam 1448 H','nasional',true),
  ('2026-10-27','Maulid Nabi Muhammad SAW','nasional',true),
  ('2026-12-25','Hari Raya Natal','nasional',true);

-- ============================================================
-- REAL RPC BODIES
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_permohonan_bulan_ini()
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.permohonan
  WHERE tanggal_masuk >= date_trunc('month', now())
    AND tanggal_masuk < date_trunc('month', now()) + interval '1 month'
$$;

CREATE OR REPLACE FUNCTION public.executive_summary()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_permohonan', (SELECT COUNT(*) FROM public.permohonan),
    'permohonan_bulan_ini', public.count_permohonan_bulan_ini(),
    'permohonan_selesai', (SELECT COUNT(*) FROM public.permohonan WHERE status='selesai'),
    'permohonan_diproses', (SELECT COUNT(*) FROM public.permohonan WHERE status='diproses'),
    'permohonan_baru', (SELECT COUNT(*) FROM public.permohonan WHERE status='baru'),
    'total_opd', (SELECT COUNT(*) FROM public.opd),
    'total_layanan', (SELECT COUNT(*) FROM public.layanan_publik WHERE COALESCE(aktif,true)),
    'total_user', (SELECT COUNT(*) FROM public.profiles),
    'avg_rating', COALESCE((SELECT AVG(skor)::numeric(10,2) FROM public.permohonan_rating), 0),
    'generated_at', now()
  )
$$;

CREATE OR REPLACE FUNCTION public.governance_summary()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'audit_log_count', (SELECT COUNT(*) FROM public.audit_log),
    'audit_log_24h', (SELECT COUNT(*) FROM public.audit_log WHERE created_at > now() - interval '24 hours'),
    'rbac_audit_count', (SELECT COUNT(*) FROM public.rbac_audit),
    'pending_users', (SELECT COUNT(*) FROM public.profiles WHERE status='pending'),
    'active_users', (SELECT COUNT(*) FROM public.profiles WHERE status='active'),
    'compliance_open', (SELECT COUNT(*) FROM public.compliance_checklist WHERE COALESCE(status,'open')='open')
  )
$$;

CREATE OR REPLACE FUNCTION public.production_health_score()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'score', 85,
    'cron_recent_success', (SELECT COUNT(*) FROM public.cron_history WHERE started_at > now() - interval '24 hours' AND COALESCE(status,'ok')='ok'),
    'cron_recent_fail', (SELECT COUNT(*) FROM public.cron_history WHERE started_at > now() - interval '24 hours' AND status='error'),
    'dead_letter_count', (SELECT COUNT(*) FROM public.dead_letter_jobs WHERE resolved_at IS NULL),
    'retry_queue_count', (SELECT COUNT(*) FROM public.retry_queue WHERE COALESCE(status,'pending')='pending'),
    'generated_at', now()
  )
$$;

CREATE OR REPLACE FUNCTION public.opd_rating_agg()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT o.id AS opd_id, o.nama AS opd_nama, o.singkatan,
      COUNT(r.id)::int AS jumlah_rating,
      COALESCE(AVG(r.skor)::numeric(10,2), 0) AS rata_rata
    FROM public.opd o
    LEFT JOIN public.permohonan p ON p.opd_id = o.id
    LEFT JOIN public.permohonan_rating r ON r.permohonan_id = p.id
    GROUP BY o.id, o.nama, o.singkatan
    ORDER BY rata_rata DESC NULLS LAST
  ) t
$$;

CREATE OR REPLACE FUNCTION public.opd_kinerja_agg()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT o.id AS opd_id, o.nama AS opd_nama, o.singkatan,
      COUNT(p.id)::int AS total_permohonan,
      COUNT(p.id) FILTER (WHERE p.status='selesai')::int AS selesai,
      COUNT(p.id) FILTER (WHERE p.status='diproses')::int AS diproses,
      COUNT(p.id) FILTER (WHERE p.status='baru')::int AS baru,
      COUNT(p.id) FILTER (WHERE p.status='ditolak')::int AS ditolak
    FROM public.opd o
    LEFT JOIN public.permohonan p ON p.opd_id = o.id
    GROUP BY o.id, o.nama, o.singkatan
    ORDER BY total_permohonan DESC
  ) t
$$;

CREATE OR REPLACE FUNCTION public.opd_attendance_today(_opd_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT o.id AS opd_id, o.nama AS opd_nama,
      COUNT(DISTINCT a.user_id)::int AS hadir,
      COUNT(DISTINCT pr.id)::int AS total_asn
    FROM public.opd o
    LEFT JOIN public.profiles pr ON pr.opd_id = o.id
    LEFT JOIN public.absensi_asn a ON a.user_id = pr.id AND DATE(a.waktu) = CURRENT_DATE
    WHERE (_opd_id IS NULL OR o.id = _opd_id)
    GROUP BY o.id, o.nama
    ORDER BY o.nama
  ) t
$$;

CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg(_opd_id uuid DEFAULT NULL, _opd uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT l.id AS layanan_id, l.judul AS layanan_nama, l.slug,
      COUNT(p.id)::int AS total_permohonan,
      COUNT(p.id) FILTER (WHERE p.status='selesai')::int AS selesai
    FROM public.layanan_publik l
    LEFT JOIN public.permohonan p ON p.kategori = l.slug
    WHERE (COALESCE(_opd_id,_opd) IS NULL OR l.opd_id = COALESCE(_opd_id,_opd))
    GROUP BY l.id, l.judul, l.slug
    ORDER BY total_permohonan DESC
  ) t
$$;

CREATE OR REPLACE FUNCTION public.fn_permohonan_effective_sla_seconds(_id uuid)
 RETURNS integer LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE _start timestamptz; _pause int; _now timestamptz; BEGIN
  SELECT tanggal_masuk, COALESCE(sla_total_pause_seconds,0), now()
    INTO _start, _pause, _now FROM public.permohonan WHERE id = _id;
  IF _start IS NULL THEN RETURN 0; END IF;
  RETURN GREATEST(0, EXTRACT(EPOCH FROM (_now - _start))::int - _pause);
END $$;

CREATE OR REPLACE FUNCTION public.aset_compliance(_opd_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT o.id AS opd_id, o.nama AS opd_nama,
      COUNT(a.id)::int AS total_aset,
      COUNT(a.id) FILTER (WHERE a.lifecycle_status='aktif')::int AS aktif,
      COUNT(a.id) FILTER (WHERE a.qr_token IS NOT NULL)::int AS terverifikasi_qr
    FROM public.opd o
    LEFT JOIN public.aset a ON a.opd_id = o.id
    WHERE (_opd_id IS NULL OR o.id = _opd_id)
    GROUP BY o.id, o.nama
    ORDER BY total_aset DESC
  ) t
$$;

CREATE OR REPLACE FUNCTION public.aset_due_warranty(_opd_id uuid DEFAULT NULL, _days integer DEFAULT 30, _opd uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT a.id, a.nama, a.opd_id, a.garansi_sampai
    FROM public.aset a
    WHERE a.garansi_sampai IS NOT NULL
      AND a.garansi_sampai BETWEEN CURRENT_DATE AND CURRENT_DATE + (COALESCE(_days,30) || ' days')::interval
      AND (COALESCE(_opd_id,_opd) IS NULL OR a.opd_id = COALESCE(_opd_id,_opd))
    ORDER BY a.garansi_sampai ASC
    LIMIT 200
  ) t
$$;
