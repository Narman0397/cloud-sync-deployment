// Monitoring TTE view — dipakai di legacy /admin/signature/monitoring
// dan di /admin/document-center/signature/monitoring.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigListMonitoring } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StatusPill,
  signatureStatusLabel,
  signatureStatusTone,
} from "@/components/ui-kit/StatusPill";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SignatureMonitoringView() {
  const fn = useServerFn(sigListMonitoring);
  const q = useQuery({ queryKey: ["sig", "monitoring", "page"], queryFn: () => fn() });
  const s = q.data?.snapshot;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            Pantauan per Status
            <HelpHint title="Apa arti angka ini?">
              Jumlah permintaan TTE dikelompokkan menurut status terakhirnya. Angka di kartu provider menunjukkan jumlah yang masih berjalan dan yang gagal.
            </HelpHint>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["pending", "sent", "signed", "rejected", "expired", "cancelled", "failed"] as const).map((k) => (
              <div key={k} className="rounded border bg-card p-3">
                <div className="text-xs text-muted-foreground">{signatureStatusLabel(k)}</div>
                <div className="text-2xl font-semibold">{s?.[k] ?? 0}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Kinerja per Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Sedang berjalan</TableHead>
                <TableHead>Gagal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(s?.perProvider ?? []).map((p) => (
                <TableRow key={p.code}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.pending}</TableCell>
                  <TableCell>
                    {p.failed > 0 ? <StatusPill tone={signatureStatusTone("failed")}>{p.failed}</StatusPill> : 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
