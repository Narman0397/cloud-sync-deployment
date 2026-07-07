import { createFileRoute } from "@tanstack/react-router";
import { SignatureQueueView } from "@/features/signature/views/QueueView";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/queue")({
  head: () => ({ meta: [{ title: "Antrian Tanda Tangan — Document Center" }] }),
  component: SignatureQueueView,
});
