import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature")({
  head: () => ({ meta: [{ title: "Tanda Tangan — Document Center" }] }),
  component: SigLayout,
});

const SUB = [
  { to: "/admin/document-center/signature/queue", label: "Antrian" },
  { to: "/admin/document-center/signature/my-inbox", label: "Kotak Saya" },
  { to: "/admin/document-center/signature/specimens", label: "Spesimen" },
  { to: "/admin/document-center/signature/certificates", label: "Sertifikat" },
  { to: "/admin/document-center/signature/kpi", label: "KPI" },
  { to: "/admin/document-center/signature/monitoring", label: "Monitoring" },
  { to: "/admin/document-center/signature/providers", label: "Provider" },
  { to: "/admin/document-center/signature/audit", label: "Audit" },
] as const;

function SigLayout() {
  const { pathname } = useLocation();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUB.map((s) => {
          const active = pathname.startsWith(s.to);
          return (
            <Link
              key={s.to}
              to={s.to}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
