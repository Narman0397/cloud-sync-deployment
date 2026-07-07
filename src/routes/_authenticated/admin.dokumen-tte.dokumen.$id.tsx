import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/dokumen-tte/dokumen/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/admin/document-center/documents/$id", params: { id: params.id } });
  },
});
