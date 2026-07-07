import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/documents/archive")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/document-center/archive" });
  },
});
