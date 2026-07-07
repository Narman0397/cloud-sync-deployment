
CREATE OR REPLACE VIEW public.unified_documents
WITH (security_invoker = on) AS
  SELECT 'generated'::text AS source, gd.id, gd.doc_number AS nomor, gd.name AS judul,
         gd.status, gd.generated_at AS created_at, gd.created_by AS owner_id, gd.opd_id
  FROM public.generated_documents gd
  UNION ALL
  SELECT 'ttd'::text AS source, d.id, NULL::text AS nomor, d.title AS judul,
         'final'::text AS status, d.created_at, d.created_by AS owner_id, d.opd_id
  FROM public.documents d;

GRANT SELECT ON public.unified_documents TO authenticated, service_role;

CREATE OR REPLACE VIEW public.unified_document_history
WITH (security_invoker = on) AS
  SELECT 'document_audit'::text AS source, da.document_id::text AS ref_id, da.action AS aksi,
         da.actor AS actor_id, da.created_at, da.metadata AS payload
  FROM public.document_audit da
  UNION ALL
  SELECT 'document_history'::text AS source, dh.document_id::text AS ref_id, dh.action AS aksi,
         COALESCE(dh.actor_id, dh.actor) AS actor_id, dh.created_at, dh.metadata AS payload
  FROM public.document_history dh
  UNION ALL
  SELECT 'signature_event'::text AS source, se.request_id::text AS ref_id, se.event AS aksi,
         se.actor AS actor_id, se.created_at, se.payload
  FROM public.signature_events se;

GRANT SELECT ON public.unified_document_history TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_signature_event_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _req record; _judul text; _body text;
BEGIN
  IF NEW.event NOT IN ('signed','rejected','expired','cancelled','failed') THEN RETURN NEW; END IF;
  SELECT sr.created_by, gd.name AS doc_name, gd.doc_number
    INTO _req
  FROM public.signature_requests sr
  LEFT JOIN public.generated_documents gd ON gd.id = sr.document_id
  WHERE sr.id = NEW.request_id;
  IF _req.created_by IS NULL THEN RETURN NEW; END IF;
  _judul := CASE NEW.event
              WHEN 'signed' THEN 'Dokumen telah ditandatangani'
              WHEN 'rejected' THEN 'Permintaan TTE ditolak'
              WHEN 'expired' THEN 'Permintaan TTE kedaluwarsa'
              WHEN 'cancelled' THEN 'Permintaan TTE dibatalkan'
              ELSE 'Permintaan TTE gagal' END;
  _body := COALESCE(_req.doc_number,'') || ' ' || COALESCE(_req.doc_name,'Dokumen');
  BEGIN
    INSERT INTO public.notifications (user_id, tipe, judul, body, link, meta)
    VALUES (_req.created_by, 'tte', _judul, _body,
            '/admin/signature/requests/' || NEW.request_id::text,
            jsonb_build_object('event', NEW.event, 'request_id', NEW.request_id));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_signature_event_notify ON public.signature_events;
CREATE TRIGGER trg_signature_event_notify
AFTER INSERT ON public.signature_events
FOR EACH ROW EXECUTE FUNCTION public.tg_signature_event_notify();

CREATE OR REPLACE FUNCTION public.fn_expire_signed_document_tokens()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n int := 0;
BEGIN
  UPDATE public.signed_documents
     SET status = 'expired'
   WHERE status = 'signed'
     AND expires_at IS NOT NULL
     AND expires_at < now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN jsonb_build_object('expired', _n, 'at', now());
END $$;
