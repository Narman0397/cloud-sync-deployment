// Spesimen & Sertifikat view — dipakai di legacy /admin/digital-signature/signatures
// dan di /admin/document-center/signature/specimens.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import {
  uploadSignatureSpecimen,
  listMySignatures,
  revokeSignature,
  listCertificates,
  issueCertificate,
  revokeCertificate,
} from "@/features/digital-signature";
import { SignatureCanvasPad } from "@/features/digital-signature/components/SignatureCanvasPad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import { StatusPill } from "@/components/ui-kit/StatusPill";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { PenLine, BadgeCheck } from "lucide-react";

export function SpecimensView() {
  const qc = useQueryClient();
  const upload = useServerFn(uploadSignatureSpecimen);
  const list = useServerFn(listMySignatures);
  const revoke = useServerFn(revokeSignature);
  const sigsQ = useQuery({ queryKey: ["dsig", "my-sigs"], queryFn: () => list() });

  const uploadM = useMutation({
    mutationFn: (pngBase64: string) => upload({ data: { pngBase64 } }),
    onSuccess: () => {
      toast.success("Spesimen disimpan");
      qc.invalidateQueries({ queryKey: ["dsig", "my-sigs"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeM = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Spesimen dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["dsig", "my-sigs"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identitas tanda tangan"
        title="Spesimen & Sertifikat"
        description="Spesimen adalah gambar tanda tangan Anda yang ditempelkan pada dokumen. Sertifikat internal merekam identitas penandatangan."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            Buat Spesimen Tanda Tangan
            <HelpHint title="Apa itu spesimen?">
              Gambar tanda tangan Anda yang akan ditempelkan ke setiap dokumen. Gambar lama yang dinonaktifkan tidak terhapus seketika — disimpan sesuai kebijakan retensi.
            </HelpHint>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignatureCanvasPad
            onSave={async (b64) => {
              await uploadM.mutateAsync(b64);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Spesimen Saya</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sigsQ.data?.signatures ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.signature_path}</TableCell>
                  <TableCell>
                    <StatusPill tone={s.is_active ? "success" : "muted"}>
                      {s.is_active ? "Aktif" : "Nonaktif"}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(s.created_at).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>
                    {s.is_active && (
                      <ConfirmDialog
                        title="Nonaktifkan spesimen?"
                        description="Spesimen tidak akan dipakai lagi untuk menandatangani dokumen baru. Buat spesimen baru sebelum menandatangani dokumen berikutnya."
                        confirmLabel="Nonaktifkan"
                        onConfirm={() => revokeM.mutate(s.id)}
                        trigger={<Button size="sm" variant="outline">Nonaktifkan</Button>}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(sigsQ.data?.signatures.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    <EmptyState
                      icon={<PenLine className="h-5 w-5" />}
                      title="Belum ada spesimen"
                      description="Buat tanda tangan di kanvas atas, lalu simpan."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CertificatePanel />
    </div>
  );
}

function CertificatePanel() {
  const qc = useQueryClient();
  const list = useServerFn(listCertificates);
  const issue = useServerFn(issueCertificate);
  const revoke = useServerFn(revokeCertificate);
  const certsQ = useQuery({ queryKey: ["dsig", "certs"], queryFn: () => list() });
  const [form, setForm] = useState({
    user_id: "",
    full_name: "",
    nip: "",
    position: "",
    expired_at: "",
  });

  const issueM = useMutation({
    mutationFn: () =>
      issue({
        data: {
          user_id: form.user_id,
          full_name: form.full_name,
          nip: form.nip || null,
          position: form.position || null,
          expired_at: form.expired_at ? new Date(form.expired_at).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Sertifikat diterbitkan");
      qc.invalidateQueries({ queryKey: ["dsig", "certs"] });
      setForm({ user_id: "", full_name: "", nip: "", position: "", expired_at: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeM = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Sertifikat dicabut");
      qc.invalidateQueries({ queryKey: ["dsig", "certs"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          Sertifikat Internal
          <HelpHint title="Apa itu sertifikat internal?">
            Identitas penandatangan (nama, NIP, jabatan, masa berlaku) yang dilampirkan ke dokumen TTD. Berbeda dengan sertifikat BSrE — ini untuk TTD internal.
          </HelpHint>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>User ID</Label>
            <Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="UUID user" />
          </div>
          <div>
            <Label>Nama Lengkap</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>NIP</Label>
            <Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
          </div>
          <div>
            <Label>Jabatan</Label>
            <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
          <div>
            <Label>Berlaku Sampai</Label>
            <Input type="date" value={form.expired_at} onChange={(e) => setForm({ ...form, expired_at: e.target.value })} />
          </div>
        </div>
        <Button onClick={() => issueM.mutate()} disabled={!form.user_id || !form.full_name || issueM.isPending}>
          Terbitkan
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>NIP</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(certsQ.data?.certificates ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.full_name}</TableCell>
                <TableCell>{c.nip ?? "-"}</TableCell>
                <TableCell>{c.position ?? "-"}</TableCell>
                <TableCell>
                  <StatusPill tone={c.is_active ? "success" : "muted"}>
                    {c.is_active ? "Aktif" : "Nonaktif"}
                  </StatusPill>
                </TableCell>
                <TableCell>
                  {c.is_active && (
                    <ConfirmDialog
                      title="Cabut sertifikat?"
                      description="Setelah dicabut, sertifikat tidak bisa dipakai lagi untuk menandatangani dokumen baru."
                      confirmLabel="Cabut"
                      onConfirm={() => revokeM.mutate(c.id)}
                      trigger={<Button size="sm" variant="outline">Cabut</Button>}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(certsQ.data?.certificates.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  <EmptyState
                    icon={<BadgeCheck className="h-5 w-5" />}
                    title="Belum ada sertifikat"
                    description="Terbitkan sertifikat internal untuk penandatangan."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  trigger,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  trigger: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
