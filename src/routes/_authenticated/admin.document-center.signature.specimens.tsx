import { createFileRoute } from "@tanstack/react-router";
import { SpecimensView } from "@/features/digital-signature/views/SpecimensView";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/specimens")({
  head: () => ({ meta: [{ title: "Spesimen & Sertifikat — Document Center" }] }),
  component: SpecimensView,
});
