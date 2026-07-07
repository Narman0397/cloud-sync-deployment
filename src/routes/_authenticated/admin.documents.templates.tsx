import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/documents/templates")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/document-center/templates" });
  },
});
