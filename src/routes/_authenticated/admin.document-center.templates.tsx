import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { TemplatesView } from "@/features/documents/views/TemplatesView";

export const Route = createFileRoute("/_authenticated/admin/document-center/templates")({
  head: () => ({ meta: [{ title: "Template — Document Center" }] }),
  component: TemplatesRoute,
});

function TemplatesRoute() {
  const { pathname } = useLocation();

  if (pathname === "/admin/document-center/templates") {
    return <TemplatesView />;
  }

  return <Outlet />;
}
