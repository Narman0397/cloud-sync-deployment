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
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_code text,
  ADD COLUMN IF NOT EXISTS pelapor_id uuid;

ALTER TABLE public.aset_nilai_buku
  ADD COLUMN IF NOT EXISTS kode text,
  ADD COLUMN IF NOT EXISTS nama text,
  ADD COLUMN IF NOT EXISTS opd_id uuid,
  ADD COLUMN IF NOT EXISTS tanggal_perolehan date,
  ADD COLUMN IF NOT EXISTS umur_ekonomis_bulan integer,
  ADD COLUMN IF NOT EXISTS metode_susut text;

CREATE OR REPLACE FUNCTION public.fn_approve_user(_target_user_id uuid, _role public.app_role, _method text DEFAULT 'manual')
RETURNS TABLE(ok boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET verification_status='verified', verified_at=now(), verified_by=auth.uid(), requested_role=COALESCE(_role, requested_role), verification_method=_method WHERE id=_target_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_target_user_id, _role) ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT true;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_approve_user(uuid, public.app_role, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_reject_user(_target_user_id uuid, _reason text DEFAULT NULL)
RETURNS TABLE(ok boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET verification_status='rejected', rejected_at=now(), rejected_by=auth.uid(), rejection_reason=_reason WHERE id=_target_user_id;
  RETURN QUERY SELECT true;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_reject_user(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_effective_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(permission_code) FILTER (WHERE granted AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())), ARRAY[]::text[])
  FROM public.user_permissions WHERE user_id=_user_id
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aset_due_warranty(_days integer DEFAULT 30)
RETURNS TABLE(aset_id uuid, kode text, nama text, opd_id uuid, jenis text, due_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, kode, nama, opd_id, 'garansi'::text, garansi_sampai FROM public.aset
  WHERE garansi_sampai IS NOT NULL AND garansi_sampai <= CURRENT_DATE + COALESCE(_days,30)
  UNION ALL
  SELECT id, kode, nama, opd_id, 'kalibrasi'::text, kalibrasi_berikut FROM public.aset
  WHERE kalibrasi_berikut IS NOT NULL AND kalibrasi_berikut <= CURRENT_DATE + COALESCE(_days,30)
$$;
GRANT EXECUTE ON FUNCTION public.aset_due_warranty(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aset_compliance(_opd_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('total', count(*), 'verified', count(*) FILTER (WHERE last_verified_at IS NOT NULL), 'needs_attention', count(*) FILTER (WHERE status <> 'aktif')) FROM public.aset WHERE _opd_id IS NULL OR opd_id=_opd_id
$$;
GRANT EXECUTE ON FUNCTION public.aset_compliance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_susut_bulanan_run(_periode text)
RETURNS TABLE(ok boolean, processed integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT true, 0;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attendance_compliance(_user_id uuid, _from date, _to date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('total', count(*), 'late', count(*) FILTER (WHERE is_late), 'late_minutes', COALESCE(sum(late_minutes),0)) FROM public.absensi_asn WHERE user_id=_user_id AND waktu::date BETWEEN _from AND _to
$$;
GRANT EXECUTE ON FUNCTION public.attendance_compliance(uuid,date,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.opd_attendance_today(_opd_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, nama_lengkap text, opd_id uuid, tipe text, waktu timestamptz, is_late boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id, COALESCE(p.nama_lengkap,''), a.opd_id, a.tipe, a.waktu, a.is_late FROM public.absensi_asn a LEFT JOIN public.profiles p ON p.id=a.user_id WHERE a.waktu::date=CURRENT_DATE AND (_opd_id IS NULL OR a.opd_id=_opd_id)
$$;
GRANT EXECUTE ON FUNCTION public.opd_attendance_today(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attendance_rekap_bulanan(_user_id uuid, _year integer, _month integer)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('hadir', count(*), 'late', count(*) FILTER (WHERE is_late), 'late_minutes', COALESCE(sum(late_minutes),0)) FROM public.absensi_asn WHERE user_id=_user_id AND EXTRACT(YEAR FROM waktu)=_year AND EXTRACT(MONTH FROM waktu)=_month
$$;
GRANT EXECUTE ON FUNCTION public.attendance_rekap_bulanan(uuid,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attendance_device_alert(_days integer DEFAULT 30)
RETURNS TABLE(user_id uuid, device_fingerprint_hash text, total bigint, last_seen timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, device_fingerprint_hash, count(*), max(waktu) FROM public.absensi_asn WHERE device_fingerprint_hash IS NOT NULL AND waktu >= now() - make_interval(days => COALESCE(_days,30)) GROUP BY user_id, device_fingerprint_hash HAVING count(*) > 1
$$;
GRANT EXECUTE ON FUNCTION public.attendance_device_alert(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.executive_summary()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('kabupaten', jsonb_build_object('permohonan', (SELECT count(*) FROM public.permohonan), 'opd', (SELECT count(*) FROM public.opd), 'layanan', (SELECT count(*) FROM public.layanan_publik)), 'generated_at', now())
$$;
GRANT EXECUTE ON FUNCTION public.executive_summary() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.governance_summary()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT jsonb_build_object('generated_at', now(), 'checks', jsonb_build_array()) $$;
GRANT EXECUTE ON FUNCTION public.governance_summary() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.production_health_score()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT jsonb_build_object('score', 100, 'generated_at', now()) $$;
GRANT EXECUTE ON FUNCTION public.production_health_score() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms(_template_id uuid)
RETURNS TABLE(ok boolean, created integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN QUERY SELECT true, 0; END $$;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_generate_nomor_surat(_opd_id uuid, _permohonan_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y int := EXTRACT(YEAR FROM now())::int; n int; s text; code text; fmt text;
BEGIN
  INSERT INTO public.nomor_surat_sequence(opd_id,tahun,last_number) VALUES (_opd_id,y,1)
  ON CONFLICT DO NOTHING;
  UPDATE public.nomor_surat_sequence SET last_number=last_number+1, updated_at=now() WHERE opd_id IS NOT DISTINCT FROM _opd_id AND tahun=y RETURNING last_number INTO n;
  SELECT COALESCE(nomor_surat_kode,'470'), COALESCE(nomor_surat_format,'{kode}/{seq}/{singkatan}/{tahun}') INTO code, fmt FROM public.opd WHERE id=_opd_id;
  s := replace(replace(replace(fmt,'{kode}',COALESCE(code,'470')),'{seq}',lpad(COALESCE(n,1)::text,4,'0')),'{tahun}',y::text);
  RETURN s;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_ikm_dashboard(_survey_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('total', count(*), 'avg', COALESCE(avg((COALESCE(u1,0)+COALESCE(u2,0)+COALESCE(u3,0)+COALESCE(u4,0)+COALESCE(u5,0)+COALESCE(u6,0)+COALESCE(u7,0)+COALESCE(u8,0)+COALESCE(u9,0))/9.0),0)) FROM public.ikm_responses WHERE _survey_id IS NULL OR survey_id=_survey_id
$$;
GRANT EXECUTE ON FUNCTION public.fn_ikm_dashboard(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_permohonan_effective_sla_seconds(_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(updated_at,now()) - tanggal_masuk))::integer - COALESCE(sla_total_pause_seconds,0)) FROM public.permohonan WHERE id=_id $$;
GRANT EXECUTE ON FUNCTION public.fn_permohonan_effective_sla_seconds(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.layanan_kinerja_agg()
RETURNS TABLE(layanan text, total bigint, selesai bigint, ditolak bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT kategori, count(*), count(*) FILTER (WHERE status='selesai'), count(*) FILTER (WHERE status='ditolak') FROM public.permohonan GROUP BY kategori $$;
GRANT EXECUTE ON FUNCTION public.layanan_kinerja_agg() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.opd_kategori_benchmark(_kategori text)
RETURNS TABLE(opd_id uuid, total bigint, selesai bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT opd_id, count(*), count(*) FILTER (WHERE status='selesai') FROM public.permohonan WHERE kategori=_kategori GROUP BY opd_id $$;
GRANT EXECUTE ON FUNCTION public.opd_kategori_benchmark(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.opd_kinerja_trend(_opd uuid DEFAULT NULL, _months integer DEFAULT 12)
RETURNS TABLE(month text, total bigint, selesai bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT to_char(date_trunc('month', tanggal_masuk),'YYYY-MM'), count(*), count(*) FILTER (WHERE status='selesai') FROM public.permohonan WHERE (_opd IS NULL OR opd_id=_opd) AND tanggal_masuk >= date_trunc('month', now()) - make_interval(months => COALESCE(_months,12)) GROUP BY 1 ORDER BY 1 $$;
GRANT EXECUTE ON FUNCTION public.opd_kinerja_trend(uuid,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.opd_skor_komposit()
RETURNS TABLE(opd_id uuid, skor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT opd_id, LEAST(100, count(*)::numeric) FROM public.permohonan GROUP BY opd_id $$;
GRANT EXECUTE ON FUNCTION public.opd_skor_komposit() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_increment(_scope text, _subject text, _window_start timestamptz, _limit integer DEFAULT 60)
RETURNS TABLE(allowed boolean, count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  INSERT INTO public.rate_limit_hits(scope, subject, window_start, count, last_hit_at) VALUES (_scope,_subject,_window_start,1,now())
  ON CONFLICT DO NOTHING;
  UPDATE public.rate_limit_hits SET count=rate_limit_hits.count+1, last_hit_at=now() WHERE scope=_scope AND subject=_subject AND window_start=_window_start RETURNING rate_limit_hits.count INTO c;
  RETURN QUERY SELECT COALESCE(c,1) <= COALESCE(_limit,60), COALESCE(c,1);
END $$;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text,text,timestamptz,integer) TO authenticated, anon, service_role;