import { createFileRoute } from "@tanstack/react-router";
import { NumberingView } from "@/features/documents/views/NumberingView";

export const Route = createFileRoute("/_authenticated/admin/document-center/numbering")({
  head: () => ({ meta: [{ title: "Penomoran — Document Center" }] }),
  component: NumberingView,
});
