import { createFileRoute } from "@tanstack/react-router";
import { LifecycleKanban } from "@/features/document-center/components/LifecycleKanban";

export const Route = createFileRoute("/_authenticated/admin/document-center/lifecycle")({
  head: () => ({ meta: [{ title: "Siklus Hidup Dokumen — Document Center" }] }),
  component: () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Papan siklus hidup: Draft → Review → Approval → Tanda Tangan → Distribusi → Arsip.
      </p>
      <LifecycleKanban />
    </div>
  ),
});
