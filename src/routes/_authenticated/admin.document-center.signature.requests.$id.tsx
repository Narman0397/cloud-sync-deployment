import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigGetStatus } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StatusPill,
  signatureStatusLabel,
  signatureStatusTone,
} from "@/components/ui-kit/StatusPill";
import { PageHeader } from "@/components/ui-kit/PageHeader";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/requests/$id")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const fn = useServerFn(sigGetStatus);
  const q = useQuery({ queryKey: ["sig", "req", id], queryFn: () => fn({ data: { requestId: id } }) });
  if (q.isLoading) return <div>Memuat…</div>;
  const r = q.data?.request as
    | {
        id: string;
        status: string;
        mode: string;
        external_request_id: string | null;
        file_hash: string | null;
        sent_at: string | null;
        completed_at: string | null;
        error: string | null;
        provider: { code: string; name: string } | null;
        document: { id: string; doc_number: string | null; name: string | null; status: string };
        signers: Array<{
          id: string;
          order_index: number;
          signer_type: string;
          user_id: string | null;
          role: string | null;
          position: string | null;
          status: string;
          signed_at: string | null;
          rejected_at: string | null;
          reject_reason: string | null;
        }>;
      }
    | undefined;
  if (!r) return <div>Request tidak ditemukan.</div>;
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Detail permintaan TTE"
        title={r.document?.name ?? r.document?.doc_number ?? "Permintaan TTE"}
        description={
          r.document?.doc_number
            ? `Nomor dokumen ${r.document.doc_number} · Provider ${r.provider?.name ?? "—"}`
            : `Provider ${r.provider?.name ?? "—"}`
        }
        actions={
          <StatusPill tone={signatureStatusTone(r.status)}>
            {signatureStatusLabel(r.status)}
          </StatusPill>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Ringkasan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <strong>Provider:</strong> {r.provider?.name ?? "—"} ({r.provider?.code ?? "—"})
          </div>
          <div>
            <strong>Mode:</strong>{" "}
            {r.mode === "parallel" ? "Paralel (bersamaan)" : "Berurutan"}
          </div>
          <div>
            <strong>Dokumen:</strong> {r.document?.doc_number ?? "—"} — {r.document?.name ?? "—"}
          </div>
          <div>
            <strong>ID provider:</strong> {r.external_request_id ?? "—"}
          </div>
          <div className="break-all">
            <strong>Hash berkas:</strong>{" "}
            <span className="font-mono text-xs">{r.file_hash ?? "—"}</span>
          </div>
          <div>
            <strong>Dikirim:</strong>{" "}
            {r.sent_at ? new Date(r.sent_at).toLocaleString("id-ID") : "—"}
          </div>
          <div>
            <strong>Selesai:</strong>{" "}
            {r.completed_at ? new Date(r.completed_at).toLocaleString("id-ID") : "—"}
          </div>
          {r.error && (
            <div className="md:col-span-2 text-destructive">
              <strong>Galat:</strong> {r.error}
            </div>
          )}
          <div className="md:col-span-2">
            <Link
              to="/verify-doc/$token"
              params={{ token: r.id }}
              target="_blank"
              className="text-xs text-primary underline"
            >
              Buka halaman verifikasi publik →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Penandatangan</CardTitle>
        </CardHeader>
        <CardContent>
          <SignersProgress signers={r.signers} mode={r.mode} />
          <ol className="mt-4 space-y-2">
            {r.signers
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((s, i, arr) => {
                const isSigned = s.status === "signed";
                const isRejected = s.status === "rejected";
                const priorAllDone = arr
                  .slice(0, i)
                  .every((p) => p.status === "signed" || p.status === "rejected");
                const isCurrentTurn =
                  r.mode !== "parallel" && !isSigned && !isRejected && priorAllDone;
                return (
                  <li
                    key={s.id}
                    className={`rounded border p-2 text-sm ${
                      isCurrentTurn ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="mr-1 inline-block min-w-6 rounded bg-muted px-1.5 text-center text-xs font-semibold">
                          #{s.order_index + 1}
                        </span>
                        {s.signer_type} • {s.role ?? s.position ?? s.user_id ?? "—"}
                        {isCurrentTurn && (
                          <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Giliran sekarang
                          </span>
                        )}
                      </div>
                      <StatusPill tone={signatureStatusTone(s.status)}>
                        {signatureStatusLabel(s.status)}
                      </StatusPill>
                    </div>
                    {s.signed_at && (
                      <div className="text-xs text-muted-foreground">
                        Ditandatangani: {new Date(s.signed_at).toLocaleString("id-ID")}
                      </div>
                    )}
                    {s.reject_reason && (
                      <div className="text-xs text-destructive">Alasan: {s.reject_reason}</div>
                    )}
                  </li>
                );
              })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Riwayat / Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(q.data?.events ?? []).map((e) => {
              const ev = e as {
                id: string;
                event: string;
                created_at: string;
                payload: Record<string, unknown>;
              };
              return (
                <li key={ev.id} className="rounded border p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ev.event}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {Object.keys(ev.payload ?? {}).length > 0 && (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-1 text-xs">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SignersProgress({
  signers,
  mode,
}: {
  signers: Array<{ status: string; order_index: number }>;
  mode: string;
}) {
  const total = signers.length;
  if (total === 0) return null;
  const signed = signers.filter((s) => s.status === "signed").length;
  const rejected = signers.filter((s) => s.status === "rejected").length;
  const pct = Math.round(((signed + rejected) / total) * 100);
  const label = mode === "parallel" ? "Paralel" : "Berurutan";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold">
          Progres {label}: {signed} / {total} ditandatangani
          {rejected > 0 ? ` · ${rejected} ditolak` : ""}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-background"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progres tanda tangan ${pct}%`}
      >
        <div
          className={rejected > 0 ? "h-full bg-amber-500" : "h-full bg-primary"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
