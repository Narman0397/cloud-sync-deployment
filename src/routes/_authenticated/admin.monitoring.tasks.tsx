import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashTasks, dashExport } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/features/dashboard/export-utils";

export const Route = createFileRoute("/_authenticated/admin/monitoring/tasks")({
  component: Page,
});

function Page() {
  const fn = useServerFn(dashTasks);
  const exp = useServerFn(dashExport);
  const q = useQuery({
    queryKey: ["dash", "tasks"],
    queryFn: () => fn(),
    refetchInterval: 45_000,
  });
  const s = q.data?.stats;
  const wl = q.data?.workload ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="My Tasks" value={s?.myTasks ?? 0} />
        <Stat label="Pending" value={s?.pending ?? 0} />
        <Stat label="Overdue" value={s?.overdue ?? 0} />
        <Stat label="Delegated" value={s?.delegated ?? 0} />
        <Stat label="Completed Today" value={s?.completedToday ?? 0} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Workload per User</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await exp({ data: { module: "tasks" } });
              downloadCsv(`workload-${Date.now()}.csv`, r.payload as unknown as Array<Record<string, unknown>>);
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
                  <th className="p-2">Nama</th>
                  <th className="p-2">Assigned</th>
                  <th className="p-2">Completed</th>
                </tr>
              </thead>
              <tbody>
                {wl.map((r) => (
                  <tr key={r.user_id} className="border-b">
                    <td className="p-2">{r.nama ?? r.user_id}</td>
                    <td className="p-2">{r.assigned}</td>
                    <td className="p-2">{r.completed}</td>
                  </tr>
                ))}
                {wl.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-muted-foreground">
                      Tidak ada data workload.
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
