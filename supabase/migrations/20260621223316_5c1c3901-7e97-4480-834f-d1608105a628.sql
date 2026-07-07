SET search_path = public;

ALTER TABLE public.document_numbering_rules
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS padding integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reset_period text DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS submission_id uuid;

-- migrasi_dataset_ke_forms with _template_id param
DROP FUNCTION IF EXISTS public.migrasi_dataset_ke_forms();
CREATE OR REPLACE FUNCTION public.migrasi_dataset_ke_forms(_template_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
REVOKE EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO authenticated, service_role;

-- attendance_compliance accepting _user_id too (overload via DEFAULT NULL)
DROP FUNCTION IF EXISTS public.attendance_compliance(uuid, date, date, integer);
CREATE OR REPLACE FUNCTION public.attendance_compliance(
  _opd_id uuid DEFAULT NULL, _from date DEFAULT NULL, _to date DEFAULT NULL,
  _days integer DEFAULT NULL, _user_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
REVOKE EXECUTE ON FUNCTION public.attendance_compliance(uuid, date, date, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_compliance(uuid, date, date, integer, uuid) TO authenticated, service_role;

-- aset_due_warranty: accept _opd too (alias)
DROP FUNCTION IF EXISTS public.aset_due_warranty(uuid, integer);
CREATE OR REPLACE FUNCTION public.aset_due_warranty(_opd_id uuid DEFAULT NULL, _days integer DEFAULT 30, _opd uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT '[]'::jsonb $$;
REVOKE EXECUTE ON FUNCTION public.aset_due_warranty(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aset_due_warranty(uuid, integer, uuid) TO authenticated, service_role;