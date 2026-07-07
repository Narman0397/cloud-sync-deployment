// Panel reliability: dead_letter_jobs + retry_queue (super_admin).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { SuperAdminOnly } from "@/components/admin/SuperAdminOnly";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/monitoring/reliability")({
  head: () => ({
    meta: [{ title: "Reliability — Monitoring" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <SuperAdminOnly>
        <Page />
      </SuperAdminOnly>
    </AdminGuard>
  ),
});

function Page() {
  const dlq = useQuery({
    queryKey: ["mon", "dlq"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dead_letter_jobs")
        .select("id, job_name, error_message, retry_count, failed_at, resolved_at, request_id")
        .order("failed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
  const rq = useQuery({
    queryKey: ["mon", "retry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retry_queue")
        .select("id, job_name, status, attempts, max_attempts, next_run_at, last_error, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dead Letter Jobs (50 terbaru)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Job</th>
                <th className="p-2">Retry</th>
                <th className="p-2">Failed At</th>
                <th className="p-2">Status</th>
                <th className="p-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {dlq.isLoading && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              )}
              {dlq.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    Tidak ada job gagal.
                  </td>
                </tr>
              )}
              {dlq.data?.map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{j.job_name}</td>
                  <td className="p-2 text-xs">{j.retry_count}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {j.failed_at ? new Date(j.failed_at).toLocaleString("id-ID") : "—"}
                  </td>
                  <td className="p-2">
                    {j.resolved_at ? (
                      <Badge variant="outline">resolved</Badge>
                    ) : (
                      <Badge variant="destructive">open</Badge>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    <pre className="max-w-md truncate text-[10px]">{j.error_message ?? "—"}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retry Queue (50 terbaru)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Job</th>
                <th className="p-2">Status</th>
                <th className="p-2">Attempt</th>
                <th className="p-2">Next Run</th>
                <th className="p-2">Last Error</th>
              </tr>
            </thead>
            <tbody>
              {rq.isLoading && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              )}
              {rq.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    Antrian kosong.
                  </td>
                </tr>
              )}
              {rq.data?.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.job_name}</td>
                  <td className="p-2">
                    <Badge variant={r.status === "failed" ? "destructive" : "outline"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-2 text-xs">
                    {r.attempts}/{r.max_attempts}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {r.next_run_at ? new Date(r.next_run_at).toLocaleString("id-ID") : "—"}
                  </td>
                  <td className="p-2 text-xs">
                    <pre className="max-w-md truncate text-[10px]">{r.last_error ?? "—"}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
