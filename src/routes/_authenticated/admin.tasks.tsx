// Phase 2B — Task Inbox layout (tabs).
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { Inbox, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tasks")({
  head: () => ({
    meta: [{ title: "Tugas Saya — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Tugas Saya" }]}>
        <Layout />
      </AdminShell>
    </AdminGuard>
  ),
});

function Layout() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">Tugas & Workflow</h2>
        <p className="text-sm text-muted-foreground">
          Kelola tugas yang ditujukan untuk Anda dan pantau instance workflow aktif.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        <Tab to="/admin/tasks" label="My Tasks" icon={Inbox} exact />
        <Tab to="/admin/workflow-instances" label="Workflow Instances" icon={ListChecks} />
      </div>
      <Outlet />
    </div>
  );
}

function Tab({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
