import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashWorkflow, dashExport } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/features/dashboard/export-utils";

export const Route = createFileRoute("/_authenticated/admin/monitoring/workflow")({
  component: Page,
});

function Page() {
  const fn = useServerFn(dashWorkflow);
  const exp = useServerFn(dashExport);
  const q = useQuery({
    queryKey: ["dash", "workflow"],
    queryFn: () => fn(),
    refetchInterval: 45_000,
  });
  const s = q.data?.stats;
  const rows = q.data?.rows ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Active" value={s?.active ?? 0} />
        <Stat label="Completed" value={s?.completed ?? 0} />
        <Stat label="Failed" value={s?.failed ?? 0} />
        <Stat label="Revision" value={s?.revisionRequested ?? 0} />
        <Stat label="Escalations" value={s?.escalations ?? 0} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Instances</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await exp({ data: { module: "workflow" } });
              downloadCsv(`workflow-${Date.now()}.csv`, r.payload as unknown as Array<Record<string, unknown>>);
            }}
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Code</th>
                  <th className="p-2">Form</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Node</th>
                  <th className="p-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.submission_id} className="border-b">
                    <td className="p-2 font-mono text-xs">{r.code ?? "—"}</td>
                    <td className="p-2">{r.form_title}</td>
                    <td className="p-2">
                      <Badge variant="outline">{r.status}</Badge>
                    </td>
                    <td className="p-2">{r.current_node ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Tidak ada instance aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString("id-ID")}</div>
      </CardContent>
    </Card>
  );
}
