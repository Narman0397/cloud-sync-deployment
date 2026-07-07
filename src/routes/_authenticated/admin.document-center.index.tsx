import { createFileRoute } from "@tanstack/react-router";
import { WorkQueueCards } from "@/features/document-center/components/WorkQueueCards";
import { RecentActivityFeed } from "@/features/document-center/components/RecentActivityFeed";

export const Route = createFileRoute("/_authenticated/admin/document-center/")({
  component: DocumentCenterHome,
});

function DocumentCenterHome() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <WorkQueueCards />
      </div>
      <div>
        <RecentActivityFeed />
      </div>
    </div>
  );
}
