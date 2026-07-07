import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigListProviders } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui-kit/StatusPill";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/providers")({
  component: Page,
});

function Page() {
  const list = useServerFn(sigListProviders);
  const q = useQuery({ queryKey: ["sig", "providers", "page"], queryFn: () => list() });
  const providers = (q.data?.providers ?? []).filter((p) => p.kind === "internal");
  const internal = providers[0];

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4" /> Provider Tanda Tangan Tetap: Internal Sistem
        </div>
        <p className="text-xs">
          Sistem ini menggunakan satu provider tunggal — Internal Sistem — yang
          memakai TTD spesimen internal, hash SHA-256, dan QR verifikasi. Tidak
          ada integrasi pihak ketiga (BSrE/eSign) maupun mode pengujian (mock).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Status Provider</CardTitle>
        </CardHeader>
        <CardContent>
          {!internal ? (
            <p className="text-sm text-muted-foreground">
              Provider internal belum terdaftar. Hubungi administrator sistem.
            </p>
          ) : (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Row label="Nama">{internal.name}</Row>
              <Row label="Kode">
                <code className="font-mono text-xs">{internal.code}</code>
              </Row>
              <Row label="Jenis">Internal Sistem</Row>
              <Row label="Status">
                <StatusPill tone={internal.status === "active" ? "success" : "muted"}>
                  {internal.status === "active" ? "Aktif" : "Nonaktif"}
                </StatusPill>
              </Row>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}