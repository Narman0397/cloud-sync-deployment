import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashHealth } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/monitoring/health")({
  component: Page,
});

function Page() {
  const fn = useServerFn(dashHealth);
  const q = useQuery({
    queryKey: ["dash", "health"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    retry: false,
  });
  if (q.isError) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          Akses ditolak. Hanya Super Admin / Admin Pemda yang dapat melihat System Health.
        </CardContent>
      </Card>
    );
  }
  const h = q.data?.health;
  const alerts = q.data?.alerts ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stuck Workflow" value={h?.workflowRuntime.stuckSubmissions ?? 0} />
        <Stat label="Failed Documents" value={h?.documentRuntime.failedGen ?? 0} />
        <Stat label="Failed Signatures" value={h?.signatureRuntime.failed ?? 0} />
        <Stat label="Webhook Errors" value={h?.signatureRuntime.webhookErrors ?? 0} />
        <Stat label="Failed Jobs" value={h?.failedJobs ?? 0} />
        <Stat label="Dead Letter" value={h?.deadLetter ?? 0} />
        <Stat label="Retry Queue" value={h?.retryQueue ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(h?.providers ?? []).map((p) => (
              <Badge key={p.code} variant={p.active ? "default" : "outline"}>
                {p.name} {p.active ? "• aktif" : "• nonaktif"}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert Center</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada alert aktif.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.kind}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>
                    <Badge
                      variant={a.severity === "critical" ? "destructive" : "outline"}
                      className="mr-2"
                    >
                      {a.severity}
                    </Badge>
                    {a.message}
                  </span>
                  <span className="font-mono">{a.count}</span>
                </li>
              ))}
            </ul>
          )}
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
