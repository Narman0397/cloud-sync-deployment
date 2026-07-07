-- ============================================================
-- Migrasi 9-Item: GRANT RPC, FK kantor_qr, seed permissions,
-- helper disposisi, RLS audit & GRANTs hygiene.
-- ============================================================

-- 1) RPC GRANT (item 7) — pastikan authenticated bisa eksekusi nomor surat & disposisi.
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_doc_next_number(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_opd(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_desa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_pemda(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pimpinan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_bupati(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_executive(uuid) TO authenticated;

-- 2) FK kantor_qr ↔ opd (item 5).
ALTER TABLE public.kantor_qr
  DROP CONSTRAINT IF EXISTS kantor_qr_opd_id_fkey;
ALTER TABLE public.kantor_qr
  ADD CONSTRAINT kantor_qr_opd_id_fkey
  FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE CASCADE;

-- Sweep tabel terkait lainnya yang sering dipakai dgn relasi opd:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.master_jabatan'::regclass AND conname='master_jabatan_opd_id_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='master_jabatan' AND column_name='opd_id'
  ) THEN
    ALTER TABLE public.master_jabatan
      ADD CONSTRAINT master_jabatan_opd_id_fkey
      FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Permissions catalog seed (item 3 RBAC).
INSERT INTO public.permissions (code, label, kategori, description) VALUES
  ('can_create_form','Membuat formulir','form','Membuat form baru'),
  ('can_edit_form','Mengedit formulir','form','Mengubah form existing'),
  ('can_publish_form','Mempublikasi formulir','form','Mengubah status form menjadi published'),
  ('can_assign_form','Menugaskan formulir','form','Memberikan target form ke role/unit'),
  ('can_verify_submission','Memverifikasi submission','submission','Verifikasi data submission warga/ASN'),
  ('can_approve_submission','Menyetujui submission','submission','Approve final submission'),
  ('can_reject_submission','Menolak submission','submission','Menolak submission dengan alasan'),
  ('can_request_revision','Meminta revisi','submission','Mengembalikan submission untuk diperbaiki'),
  ('can_view_sensitive_document','Lihat dokumen sensitif','document','Akses dokumen kategori sensitif'),
  ('can_download_document','Unduh dokumen','document','Unduh berkas asli'),
  ('can_share_document','Bagikan dokumen','document','Membuat tautan share dokumen'),
  ('can_request_document','Permohonan dokumen','document','Mengajukan permintaan dokumen'),
  ('can_manage_users','Kelola pengguna','admin','Manajemen profil & status user'),
  ('can_manage_opd','Kelola OPD','admin','Manajemen daftar OPD'),
  ('can_view_audit_logs','Lihat audit log','admin','Akses penuh log audit'),
  ('can_export_data','Ekspor data','admin','Ekspor data ke CSV/XLSX'),
  ('can_manage_roles','Kelola role','admin','Memberikan/mencabut role'),
  ('can_manage_forms','Kelola semua form','form','Akses penuh manajemen form'),
  ('can_request_data','Permohonan data','data','Mengajukan permohonan dataset'),
  ('can_approve_data_request','Setujui permohonan data','data','Menyetujui/menolak permohonan data'),
  ('can_approve_registration','Setujui registrasi','admin','Approve akun baru'),
  ('view_all_opd','Lihat semua OPD','pemda','Akses lintas OPD'),
  ('view_all_submissions','Lihat semua submission','pemda','Akses lintas OPD untuk submission'),
  ('view_all_attendance','Lihat semua absensi','pemda','Akses absensi lintas OPD'),
  ('view_all_assets','Lihat semua aset','pemda','Akses aset lintas OPD'),
  ('view_all_datasets','Lihat semua dataset','pemda','Akses dataset lintas OPD'),
  ('view_all_reports','Lihat semua laporan','pemda','Akses laporan lintas OPD'),
  ('view_all_performance','Lihat performa OPD','pemda','Dashboard kinerja lintas OPD'),
  ('view_all_surveys','Lihat semua survei','pemda','Akses hasil survei IKM'),
  ('view_kabupaten_dashboard','Dashboard Kabupaten','executive','Akses dashboard tingkat kabupaten'),
  ('view_executive_dashboard','Dashboard eksekutif','executive','Akses dashboard pimpinan'),
  ('view_cross_opd_analytics','Analitik lintas OPD','executive','Analitik kinerja lintas OPD'),
  ('pemda.view','Pemda — Lihat','pemda','Akses menu Pemda'),
  ('pemda.manage','Pemda — Kelola','pemda','Kelola data tingkat Pemda'),
  ('pemda.monitor','Pemda — Monitoring','pemda','Monitoring lintas OPD'),
  ('executive.view','Eksekutif — Lihat','executive','Akses dashboard eksekutif'),
  ('executive.approve','Eksekutif — Setujui','executive','Approval eksekutif (Bupati)'),
  ('executive.sign','Eksekutif — TTD','executive','Tandatangan dokumen eksekutif (Bupati)'),
  ('executive.disposition','Eksekutif — Disposisi','executive','Buat disposisi eksekutif (Bupati)')
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  kategori = EXCLUDED.kategori,
  description = EXCLUDED.description;

-- 4) Helper RPC disposisi (item 7 end-to-end).
CREATE OR REPLACE FUNCTION public.fn_create_disposition(
  _permohonan_id uuid,
  _to_user uuid,
  _note text DEFAULT NULL,
  _level text DEFAULT 'staff'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _opd_caller uuid;
  _opd_target uuid;
  _opd_perm uuid;
  _id uuid;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Tidak terautentikasi'; END IF;
  -- Validasi: caller harus super_admin / admin_opd OPD pemilik / admin_pemda
  SELECT opd_id INTO _opd_perm FROM public.permohonan WHERE id = _permohonan_id;
  IF _opd_perm IS NULL THEN RAISE EXCEPTION 'Permohonan tidak ditemukan'; END IF;
  SELECT opd_id INTO _opd_caller FROM public.profiles WHERE id = _caller;
  SELECT opd_id INTO _opd_target FROM public.profiles WHERE id = _to_user;

  IF NOT (
    public.has_role(_caller,'super_admin'::app_role)
    OR public.has_role(_caller,'admin_pemda'::app_role)
    OR (public.has_role(_caller,'admin_opd'::app_role) AND _opd_caller = _opd_perm)
  ) THEN
    RAISE EXCEPTION 'Anda tidak berwenang mendisposisikan permohonan ini';
  END IF;

  IF _opd_target IS DISTINCT FROM _opd_perm AND NOT public.has_role(_caller,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Penerima disposisi harus dari OPD yang sama';
  END IF;

  INSERT INTO public.submission_dispositions(permohonan_id, from_user, to_user, level, note, status)
  VALUES (_permohonan_id, _caller, _to_user, COALESCE(_level,'staff'), _note, 'open')
  RETURNING id INTO _id;

  -- Audit log
  INSERT INTO public.audit_log(user_id, aksi, entitas, entitas_id, data_sesudah)
  VALUES (_caller, 'permohonan.disposition.created', 'permohonan', _permohonan_id::text,
    jsonb_build_object('to_user', _to_user, 'level', _level, 'note', _note));

  -- Notifikasi (best-effort)
  BEGIN
    INSERT INTO public.notifications(user_id, tipe, judul, body, link, meta)
    VALUES (_to_user, 'disposisi', 'Disposisi permohonan baru',
      'Anda menerima disposisi permohonan',
      '/admin/permohonan/' || _permohonan_id::text,
      jsonb_build_object('permohonan_id', _permohonan_id, 'disposition_id', _id));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_create_disposition(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_complete_disposition(_disposition_id uuid, _note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _caller uuid := auth.uid(); _row record;
BEGIN
  IF _caller IS NULL THEN RAISE EXCEPTION 'Tidak terautentikasi'; END IF;
  SELECT * INTO _row FROM public.submission_dispositions WHERE id = _disposition_id;
  IF _row IS NULL THEN RAISE EXCEPTION 'Disposisi tidak ditemukan'; END IF;
  IF NOT (
    _row.to_user = _caller
    OR _row.from_user = _caller
    OR public.has_role(_caller,'super_admin'::app_role)
    OR public.has_role(_caller,'admin_pemda'::app_role)
  ) THEN
    RAISE EXCEPTION 'Tidak berwenang menyelesaikan disposisi';
  END IF;
  UPDATE public.submission_dispositions
    SET status = 'done', acted_at = now(), note = COALESCE(_note, note)
    WHERE id = _disposition_id;
  INSERT INTO public.audit_log(user_id, aksi, entitas, entitas_id, data_sesudah)
  VALUES (_caller, 'permohonan.disposition.completed', 'permohonan', _row.permohonan_id::text,
    jsonb_build_object('disposition_id', _disposition_id, 'note', _note));
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_complete_disposition(uuid, text) TO authenticated;

-- RLS submission_dispositions: pastikan SELECT untuk from/to/admin OPD/super.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.submission_dispositions'::regclass AND polname='select_disposition_participants') THEN
    EXECUTE 'CREATE POLICY select_disposition_participants ON public.submission_dispositions
      FOR SELECT TO authenticated USING (
        from_user = auth.uid() OR to_user = auth.uid()
        OR public.has_role(auth.uid(),''super_admin''::app_role)
        OR public.has_role(auth.uid(),''admin_pemda''::app_role)
        OR EXISTS (SELECT 1 FROM public.permohonan p WHERE p.id = permohonan_id AND p.opd_id = public.get_user_opd(auth.uid()))
      )';
  END IF;
END $$;

-- 5) Refresh PostgREST schema cache (item 5).
NOTIFY pgrst, 'reload schema';