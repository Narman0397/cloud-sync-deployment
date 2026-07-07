import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { dcListCertificates, dcRotateCertificate } from "@/lib/dsig-p2.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute(
  "/_authenticated/admin/document-center/signature/certificates",
)({
  head: () => ({ meta: [{ title: "Sertifikat & Rotasi — Document Center" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(dcListCertificates);
  const rotateFn = useServerFn(dcRotateCertificate);
  const q = useQuery({ queryKey: ["dc", "certs"], queryFn: () => listFn() });

  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [expiredAt, setExpiredAt] = useState("");

  const rotateM = useMutation({
    mutationFn: () =>
      rotateFn({
        data: {
          certificate_id: target!.id,
          reason,
          expired_at: expiredAt ? new Date(expiredAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Sertifikat berhasil dirotasi");
      setTarget(null);
      setReason("");
      setExpiredAt("");
      qc.invalidateQueries({ queryKey: ["dc", "certs"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Document Center"
        title="Sertifikat Penandatangan"
        description="Kelola sertifikat aktif dan rotasikan bila kompromi, kadaluarsa, atau berdasarkan kebijakan berkala."
      />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Sertifikat</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pemilik</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Diterbitkan</TableHead>
                <TableHead>Kadaluarsa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rotasi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.rows ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.nip ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{c.position ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(c.issued_at as string).toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.expired_at
                      ? new Date(c.expired_at as string).toLocaleDateString("id-ID")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {c.revoked_at ? (
                      <StatusPill tone="danger">Dicabut</StatusPill>
                    ) : c.is_active ? (
                      <StatusPill tone="success">Aktif</StatusPill>
                    ) : (
                      <StatusPill tone="muted">Nonaktif</StatusPill>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.rotated_from ? `Rotasi dari ${String(c.rotated_from).slice(0, 8)}…` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.is_active && !c.revoked_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTarget({ id: c.id, name: c.full_name })}
                      >
                        Rotasi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(q.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Belum ada sertifikat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotasi Sertifikat — {target?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Alasan Rotasi</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mis. rotasi berkala tahunan / kunci lama kompromi / pergantian jabatan"
                rows={3}
              />
            </div>
            <div>
              <Label>Kadaluarsa Baru (opsional)</Label>
              <Input
                type="date"
                value={expiredAt}
                onChange={(e) => setExpiredAt(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sertifikat lama akan ditandai dicabut, dan sertifikat baru diterbitkan dengan
              referensi rotasi.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button
              onClick={() => rotateM.mutate()}
              disabled={reason.length < 3 || rotateM.isPending}
            >
              Rotasi Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
