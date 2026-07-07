import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { dcKpiDashboard, dcProviderHealth } from "@/lib/dsig-p2.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui-kit/StatusPill";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/kpi")({
  head: () => ({ meta: [{ title: "KPI Tanda Tangan — Document Center" }] }),
  component: Page,
});

function fmtDur(s: number) {
  if (!s || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const d30 = new Date();
  d30.setDate(d30.getDate() - 29);
  const from30 = d30.toISOString().slice(0, 10);
  const [from, setFrom] = useState(from30);
  const [to, setTo] = useState(today);

  const kpiFn = useServerFn(dcKpiDashboard);
  const healthFn = useServerFn(dcProviderHealth);
  const kpi = useQuery({
    queryKey: ["dc", "kpi", from, to],
    queryFn: () => kpiFn({ data: { from, to } }),
  });
  const health = useQuery({ queryKey: ["dc", "health"], queryFn: () => healthFn() });

  const t = kpi.data?.totals ?? {
    pending: 0,
    signed: 0,
    rejected: 0,
    expired: 0,
    failed: 0,
    total: 0,
  };
  const successRate = useMemo(
    () => (t.total > 0 ? Math.round((t.signed / t.total) * 100) : 0),
    [t],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Document Center"
        title="Dashboard KPI Tanda Tangan"
        description="Ringkasan performa modul TTE: volume, turnaround, keberhasilan, dan kesehatan provider."
      />
      <Card>
        <CardHeader>
          <CardTitle>Rentang Waktu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={() => kpi.refetch()} disabled={kpi.isFetching}>
              Terapkan
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total Permintaan" value={t.total} />
        <Kpi label="Berhasil Ditandatangani" value={t.signed} tone="success" />
        <Kpi label="Menunggu" value={t.pending} tone="warning" />
        <Kpi label="Gagal / Kadaluarsa" value={t.failed + t.expired + t.rejected} tone="danger" />
        <Kpi label="Tingkat Keberhasilan" value={`${successRate}%`} />
        <Kpi label="Rata-rata Turnaround" value={fmtDur(kpi.data?.avg_turnaround_seconds ?? 0)} />
        <Kpi label="Ditolak" value={t.rejected} />
        <Kpi label="Kadaluarsa" value={t.expired} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kesehatan Provider (24 jam terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Permintaan 24j</TableHead>
                <TableHead className="text-right">Berhasil 24j</TableHead>
                <TableHead className="text-right">Gagal 24j</TableHead>
                <TableHead className="text-right">Menunggu</TableHead>
                <TableHead>Aktivitas Terakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(health.data?.rows ?? []).map((r) => {
                const failed = Number(r.failed_24h ?? 0);
                const tone = failed > 0 ? "danger" : "success";
                return (
                  <TableRow key={r.provider_code as string}>
                    <TableCell className="font-medium">{r.provider_name as string}</TableCell>
                    <TableCell>
                      <StatusPill tone={tone}>
                        {failed > 0 ? "Perlu Perhatian" : "Sehat"}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right">{Number(r.requests_24h ?? 0)}</TableCell>
                    <TableCell className="text-right">{Number(r.signed_24h ?? 0)}</TableCell>
                    <TableCell className="text-right">{failed}</TableCell>
                    <TableCell className="text-right">{Number(r.pending_now ?? 0)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_activity_at
                        ? new Date(r.last_activity_at as string).toLocaleString("id-ID")
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(health.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Belum ada data provider.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tren Harian</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ditandatangani</TableHead>
                <TableHead className="text-right">Menunggu</TableHead>
                <TableHead className="text-right">Gagal</TableHead>
                <TableHead className="text-right">Turnaround</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(kpi.data?.daily ?? []).map((r, i) => (
                <TableRow key={`${r.day}-${i}`}>
                  <TableCell>{String(r.day)}</TableCell>
                  <TableCell className="text-right">{Number(r.total ?? 0)}</TableCell>
                  <TableCell className="text-right">{Number(r.signed ?? 0)}</TableCell>
                  <TableCell className="text-right">{Number(r.pending ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    {Number(r.failed ?? 0) + Number(r.expired ?? 0) + Number(r.rejected ?? 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtDur(Number(r.avg_turnaround_seconds ?? 0))}
                  </TableCell>
                </TableRow>
              ))}
              {(kpi.data?.daily.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada aktivitas pada rentang ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  tone?: "muted" | "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-rose-700"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
