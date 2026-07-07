import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/digital-signature/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/document-center/signature" });
  },
});
