// Layout Document Center — sidebar tab + breadcrumb.
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { CommandPalette } from "@/features/document-center/global-search/CommandPalette";
import {
  LayoutDashboard,
  Inbox,
  Activity,
  FileText,
  PenLine,
  ShieldCheck,
  Boxes,
  Archive,
  Hash,
  History,
  Keyboard,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/document-center")({
  head: () => ({ meta: [{ title: "Document Center — Admin" }] }),
  component: DocumentCenterLayout,
});

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const TABS: Tab[] = [
  { to: "/admin/document-center", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/document-center/inbox", label: "Kotak Tugas", icon: Inbox },
  { to: "/admin/document-center/lifecycle", label: "Siklus Hidup", icon: Activity },
  { to: "/admin/document-center/documents", label: "Dokumen", icon: FileText },
  { to: "/admin/document-center/signature", label: "Tanda Tangan", icon: PenLine },
  { to: "/admin/document-center/workflows", label: "Alur Kerja", icon: Boxes },
  { to: "/admin/document-center/templates", label: "Template", icon: FileText },
  { to: "/admin/document-center/numbering", label: "Penomoran", icon: Hash },
  { to: "/admin/document-center/archive", label: "Arsip", icon: Archive },
];

function DocumentCenterLayout() {
  const { pathname } = useLocation();
  return (
    <AdminShell breadcrumb={[{ label: "Document Center" }]}>
      <CommandPalette />
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          eyebrow="Dokumen & Tanda Tangan Digital"
          title="Document Center"
          description="Satu tempat untuk seluruh siklus hidup dokumen — draft, review, persetujuan, tanda tangan, distribusi, dan arsip."
        />
        <span className="hidden items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground md:inline-flex">
          <Keyboard className="h-3 w-3" /> Cmd/Ctrl+K
        </span>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm -mb-px ${
                active
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AdminShell>
  );
}
