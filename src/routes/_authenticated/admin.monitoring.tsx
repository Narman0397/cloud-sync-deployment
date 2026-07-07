import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const Route = createFileRoute("/_authenticated/admin/monitoring")({
  head: () => ({ meta: [{ title: "Monitoring Center — Admin" }] }),
  component: () => (
    <AdminGuard>
      <Layout />
    </AdminGuard>
  ),
});

function Layout() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/admin/monitoring", label: "Overview", exact: true },
    { to: "/admin/monitoring/workflow", label: "Workflow" },
    { to: "/admin/monitoring/tasks", label: "Task" },
    { to: "/admin/monitoring/documents", label: "Document" },
    { to: "/admin/monitoring/signature", label: "Signature" },
    { to: "/admin/monitoring/reliability", label: "Reliability" },
    { to: "/admin/monitoring/health", label: "System Health" },
  ];
  return (
    <AdminShell breadcrumb={[{ label: "Monitoring Center" }]}>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AdminShell>
  );
}
