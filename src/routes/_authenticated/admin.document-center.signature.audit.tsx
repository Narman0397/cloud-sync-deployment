import { createFileRoute } from "@tanstack/react-router";
import { DigitalSignatureAuditView } from "@/features/digital-signature/views/AuditView";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/audit")({
  head: () => ({ meta: [{ title: "Audit TTE — Document Center" }] }),
  component: DigitalSignatureAuditView,
});
