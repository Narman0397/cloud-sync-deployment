
CREATE TABLE IF NOT EXISTS public.permohonan_riwayat (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "permohonan_id" uuid NOT NULL,
  "oleh" uuid,
  "aksi" text NOT NULL,
  "catatan" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.profiles (
  "id" uuid NOT NULL,
  "nama_lengkap" text DEFAULT ''::text NOT NULL,
  "nik" text,
  "no_hp" text,
  "opd_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "desa" text,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "nip" text,
  "jabatan" text,
  "username" text,
  "asn_type" text,
  "system_position" text,
  "pangkat" text,
  "golongan" text,
  "foto_url" text
);
CREATE TABLE IF NOT EXISTS public.push_subscription (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rate_limit (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "bucket" text NOT NULL,
  "window_start" timestamp with time zone DEFAULT now() NOT NULL,
  "count" integer DEFAULT 1 NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "subject" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "last_hit_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.rbac_audit (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid,
  "target_user_id" uuid,
  "action" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.retention_policies (
  "entity" text NOT NULL,
  "retention_days" integer DEFAULT 365 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "last_run_at" timestamp with time zone,
  "last_deleted_count" integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS public.retry_queue (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_name" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "next_run_at" timestamp with time zone,
  "last_error" text,
  "request_id" text,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "completed_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.signed_documents (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "document_hash" text NOT NULL,
  "verification_token" text NOT NULL,
  "signed_by" uuid NOT NULL,
  "signed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" text DEFAULT 'signed'::text NOT NULL,
  "signed_file_path" text NOT NULL,
  "verification_count" integer DEFAULT 0 NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoke_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.signing_certificates (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "nip" text,
  "full_name" text NOT NULL,
  "position" text,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expired_at" timestamp with time zone,
  "public_key" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.submission_dispositions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "permohonan_id" uuid NOT NULL,
  "from_user" uuid NOT NULL,
  "to_user" uuid NOT NULL,
  "level" text NOT NULL,
  "note" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "acted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.submission_sla_events (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "permohonan_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "duration_seconds" integer,
  "reason" text,
  "actor" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.uat_results (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scenario_id" uuid NOT NULL,
  "status" text NOT NULL,
  "catatan" text,
  "run_at" timestamp with time zone DEFAULT now() NOT NULL,
  "run_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.uat_scenarios (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role" text NOT NULL,
  "modul" text NOT NULL,
  "description" text NOT NULL,
  "steps" text[] DEFAULT '{}'::text[],
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "code" text,
  "judul" text,
  "expected" text
);
CREATE TABLE IF NOT EXISTS public.user_permissions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "permission_code" text NOT NULL,
  "granted" boolean DEFAULT true NOT NULL,
  "expires_at" timestamp with time zone,
  "reason" text,
  "granted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" app_role NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.verification_logs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "actor_id" uuid,
  "action" text NOT NULL,
  "catatan" text,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.verification_token (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  "used_at" timestamp with time zone,
  "used_by" uuid
);
CREATE TABLE IF NOT EXISTS public.work_schedule (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nama" text NOT NULL,
  "opd_id" uuid,
  "hari_kerja" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
  "jam_masuk" time without time zone NOT NULL,
  "jam_pulang" time without time zone NOT NULL,
  "toleransi_menit" integer DEFAULT 15 NOT NULL,
  "aktif" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.work_schedule_assignment (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "schedule_id" uuid NOT NULL,
  "berlaku_dari" date DEFAULT CURRENT_DATE NOT NULL,
  "berlaku_sampai" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- PK/unique/FK (aman jika target belum ada)
DO $$ BEGIN ALTER TABLE public.permohonan_riwayat ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username)); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscription ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.push_subscription ADD CONSTRAINT push_subscription_endpoint_key UNIQUE (endpoint); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.rate_limit ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.rate_limit_hits ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.rbac_audit ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.retention_policies ADD PRIMARY KEY (entity); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.retry_queue ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.signed_documents ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.signing_certificates ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.submission_dispositions ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.submission_sla_events ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.uat_results ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.uat_scenarios ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_permissions ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_uk UNIQUE (user_id, permission_code); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_role_key UNIQUE (user_id, role); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.verification_logs ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.verification_token ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.verification_token ADD CONSTRAINT verification_token_token_key UNIQUE (token); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.work_schedule ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.work_schedule_assignment ADD PRIMARY KEY (id); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- FKs to opd/aset/profiles
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_opd_id_fkey FOREIGN KEY (opd_id) REFERENCES public.opd(id) ON DELETE SET NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.permohonan_riwayat ADD CONSTRAINT permohonan_riwayat_permohonan_id_fkey FOREIGN KEY (permohonan_id) REFERENCES public.permohonan(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.work_schedule_assignment ADD CONSTRAINT wsa_schedule_fkey FOREIGN KEY (schedule_id) REFERENCES public.work_schedule(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Grants + RLS + policies
DO $g$ DECLARE t text; tables text[] := ARRAY['permohonan_riwayat','profiles','push_subscription','rate_limit','rate_limit_hits','rbac_audit','retention_policies','retry_queue','signed_documents','signing_certificates','submission_dispositions','submission_sla_events','uat_results','uat_scenarios','user_permissions','user_roles','verification_logs','verification_token','work_schedule','work_schedule_assignment'];
BEGIN FOREACH t IN ARRAY tables LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS "auth_all_%s" ON public.%I', t, t);
  EXECUTE format('CREATE POLICY "auth_all_%s" ON public.%I TO authenticated USING (public.has_role(auth.uid(),''super_admin'') OR public.has_role(auth.uid(),''admin_opd'')) WITH CHECK (public.has_role(auth.uid(),''super_admin''))', t, t);
END LOOP; END $g$;

-- Profiles: user membaca/menulis dirinya sendiri
DROP POLICY IF EXISTS "profile_self_select" ON public.profiles;
CREATE POLICY "profile_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profile_self_update" ON public.profiles;
CREATE POLICY "profile_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profile_self_insert" ON public.profiles;
CREATE POLICY "profile_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles: user membaca role sendiri
DROP POLICY IF EXISTS "user_roles_self_select" ON public.user_roles;
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
