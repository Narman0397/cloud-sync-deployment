import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/document-center/workflows")({
  head: () => ({ meta: [{ title: "Alur Kerja — Document Center" }] }),
  component: () => (
    <div className="rounded-xl border border-border bg-card p-6 text-sm">
      <h3 className="mb-2 font-display text-base font-semibold">Alur Kerja (Workflow)</h3>
      <p className="mb-4 text-muted-foreground">
        Definisi alur kerja untuk review, persetujuan, dan tanda tangan dokumen.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/admin/form-builder/workflows"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Definisi Workflow <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          to="/admin/workflow-instances"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Instances Berjalan <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  ),
});
