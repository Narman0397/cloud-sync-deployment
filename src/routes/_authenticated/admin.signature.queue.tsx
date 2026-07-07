import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/signature/queue")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/document-center/signature/queue" });
  },
});
