-- Batch E1 — Trigger functions: revoke PUBLIC/anon/authenticated, keep service_role.
-- Verified: zero direct RPC callers across src/.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'aset_set_qr_token()',
    'handle_new_user()',
    'log_permohonan_change()',
    'prevent_unverified_role_insert()',
    'prevent_self_role_change()',
    'set_updated_at()',
    'sync_compliance_aliases()',
    'sync_dataset_submission_aliases()',
    'sync_dataset_review_aliases()',
    'sync_dataset_template_aliases()',
    'sync_feature_flag_aliases()',
    'sync_uat_aliases()',
    'tg_signed_documents_validate_revoke()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', r);
  END LOOP;
END $$;