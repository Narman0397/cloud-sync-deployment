// Antrian TTE view — dipakai di rute legacy /admin/signature/queue
// dan di /admin/document-center/signature/queue.
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { sigListQueue, sigRetry, sigCancel, sigRunQueue } from "@/lib/signature.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  StatusPill,
  signatureStatusLabel,
  signatureStatusTone,
} from "@/components/ui-kit/StatusPill";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES = ["pending", "sent", "signed", "rejected", "expired", "cancelled", "failed"];

export function SignatureQueueView() {
  const qc = useQueryClient();
  const listFn = useServerFn(sigListQueue);
  const retryFn = useServerFn(sigRetry);
  const cancelFn = useServerFn(sigCancel);
  const [filters, setFilters] = useState<{
    status: string;
    providerCode: string;
    from: string;
    to: string;
  }>({ status: "all", providerCode: "all", from: "", to: "" });
  const q = useQuery({
    queryKey: ["sig", "queue", filters],
    queryFn: () =>
      listFn({
        data: {
          filters: {
            status: filters.status === "all" ? null : filters.status,
            providerCode: filters.providerCode === "all" ? null : filters.providerCode,
            from: filters.from || null,
            to: filters.to || null,
          },
        },
      }),
  });

  const retryM = useMutation({
    mutationFn: (id: string) => retryFn({ data: { requestId: id } }),
    onSuccess: () => {
      toast.success("Retry diproses");
      qc.invalidateQueries({ queryKey: ["sig", "queue"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const cancelM = useMutation({
    mutationFn: (id: string) =>
      cancelFn({ data: { requestId: id, reason: "Dibatalkan administrator" } }),
    onSuccess: () => {
      toast.success("Dibatalkan");
      qc.invalidateQueries({ queryKey: ["sig", "queue"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const runQueueFn = useServerFn(sigRunQueue);
  const runM = useMutation({
    mutationFn: () => runQueueFn({ data: {} } as never),
    onSuccess: (r) => {
      toast.success(`Antrian diproses: ${r.signed} ditandatangani, ${r.failed} gagal`);
      qc.invalidateQueries({ queryKey: ["sig", "queue"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold">Antrian Permintaan TTE</h2>
        <HelpHint title="Antrian TTE">
          Daftar semua permintaan TTE. Gunakan filter untuk fokus pada status atau provider tertentu. Klik <strong>Detail</strong> untuk melihat penandatangan, jejak audit, dan tautan verifikasi publik.
        </HelpHint>
        <div className="ml-auto">
          <Button size="sm" onClick={() => runM.mutate()} disabled={runM.isPending}>
            {runM.isPending ? "Memproses…" : "Proses Antrian Internal"}
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue placeholder="Semua status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{signatureStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.providerCode} onValueChange={(v) => setFilters((f) => ({ ...f, providerCode: v }))}>
              <SelectTrigger><SelectValue placeholder="Semua provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua provider</SelectItem>
                <SelectItem value="internal">Internal Sistem</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor dokumen</TableHead>
                <TableHead>Nama dokumen</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Penandatangan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dikirim</TableHead>
                <TableHead>Selesai</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.doc_number ?? "—"}</TableCell>
                  <TableCell>{r.doc_name ?? "—"}</TableCell>
                  <TableCell>{r.provider_name}</TableCell>
                  <TableCell className="text-xs">{r.signer_names.join(", ")}</TableCell>
                  <TableCell>
                    <StatusPill tone={signatureStatusTone(r.status)}>{signatureStatusLabel(r.status)}</StatusPill>
                  </TableCell>
                  <TableCell className="text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString("id-ID") : "—"}</TableCell>
                  <TableCell className="text-xs">{r.completed_at ? new Date(r.completed_at).toLocaleString("id-ID") : "—"}</TableCell>
                  <TableCell className="flex gap-2">
                    <Link to="/admin/document-center/signature/requests/$id" params={{ id: r.id }} className="text-xs text-primary underline">Detail</Link>
                    {r.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => retryM.mutate(r.id)}>Coba lagi</Button>
                    )}
                    {["pending", "sent"].includes(r.status) && (
                      <Button size="sm" variant="ghost" onClick={() => cancelM.mutate(r.id)}>Batalkan</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(q.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Belum ada permintaan TTE pada filter saat ini.
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
