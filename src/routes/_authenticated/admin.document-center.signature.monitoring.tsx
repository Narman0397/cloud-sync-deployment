import { createFileRoute } from "@tanstack/react-router";
import { SignatureMonitoringView } from "@/features/signature/views/MonitoringView";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/monitoring")({
  head: () => ({ meta: [{ title: "Monitoring TTE — Document Center" }] }),
  component: SignatureMonitoringView,
});
