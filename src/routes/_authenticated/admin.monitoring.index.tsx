import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashOverview, dashExport } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCsv, downloadJson } from "@/features/dashboard/export-utils";

export const Route = createFileRoute("/_authenticated/admin/monitoring/")({
  component: OverviewPage,
});

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value.toLocaleString("id-ID")}</div>
      </CardContent>
    </Card>
  );
}

function OverviewPage() {
  const fn = useServerFn(dashOverview);
  const exp = useServerFn(dashExport);
  const q = useQuery({
    queryKey: ["dash", "overview"],
    queryFn: () => fn(),
    refetchInterval: 45_000,
  });
  const d = q.data;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const r = await exp({ data: { module: "overview" } });
            downloadJson(`overview-${Date.now()}.json`, r);
            downloadCsv(
              `overview-${Date.now()}.csv`,
              Object.entries(r.payload).map(([k, v]) => ({ metric: k, value: v as number })),
            );
          }}
        >
          Export
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Submission" value={d?.totalSubmission ?? 0} />
        <StatCard label="Submission Hari Ini" value={d?.submissionToday ?? 0} />
        <StatCard label="Pending Workflow" value={d?.pendingWorkflow ?? 0} />
        <StatCard label="Completed Workflow" value={d?.completedWorkflow ?? 0} />
        <StatCard label="Overdue Workflow" value={d?.overdueWorkflow ?? 0} />
        <StatCard label="Escalated Tasks" value={d?.escalatedTasks ?? 0} />
        <StatCard label="Pending Signature" value={d?.pendingSignature ?? 0} />
        <StatCard label="Signed Documents" value={d?.signedDocuments ?? 0} />
        <StatCard label="Generated Documents" value={d?.generatedDocuments ?? 0} />
      </div>
    </div>
  );
}
