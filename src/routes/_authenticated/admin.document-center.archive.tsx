import { createFileRoute } from "@tanstack/react-router";
import { ArchiveView } from "@/features/documents/views/ArchiveView";

export const Route = createFileRoute("/_authenticated/admin/document-center/archive")({
  head: () => ({ meta: [{ title: "Arsip — Document Center" }] }),
  component: ArchiveView,
});
