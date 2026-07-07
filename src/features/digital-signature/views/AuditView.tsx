// Audit view — dipakai di legacy /admin/digital-signature/audit
// dan di /admin/document-center/signature/audit.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listDocumentAudit } from "@/features/digital-signature";
import { DocumentAuditTable } from "@/features/digital-signature/components/DocumentAuditTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { HelpHint } from "@/components/ui-kit/HelpHint";

export function DigitalSignatureAuditView() {
  const fetchAudit = useServerFn(listDocumentAudit);
  const q = useQuery({ queryKey: ["dsig", "audit"], queryFn: () => fetchAudit({ data: {} }) });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Jejak audit"
        title="Audit Trail Dokumen"
        description="Semua aktivitas tanda tangan dokumen tercatat di sini untuk kebutuhan audit dan pembuktian."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            Aktivitas terbaru
            <HelpHint title="Apa itu audit trail?">
              Rekam jejak siapa, kapan, dan tindakan apa yang dilakukan pada sebuah dokumen — dipakai untuk verifikasi dan pertanggungjawaban.
            </HelpHint>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentAuditTable rows={q.data?.audit ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
