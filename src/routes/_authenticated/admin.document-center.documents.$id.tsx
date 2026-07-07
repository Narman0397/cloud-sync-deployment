import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dcDocumentDetail, dcQuickAction } from "@/lib/document-center.functions";
import { DocumentTimeline } from "@/features/document-center/components/DocumentTimeline";
import { LifecycleBadge } from "@/features/document-center/components/LifecycleBadge";
import { mapDocStatus } from "@/features/document-center/lifecycle";
import { Archive, ArchiveRestore, Download, ExternalLink, Copy, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/document-center/documents/$id")({
  head: () => ({ meta: [{ title: "Detail Dokumen — Document Center" }] }),
  component: DocDetailPage,
});

function DocDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetail = useServerFn(dcDocumentDetail);
  const quickAction = useServerFn(dcQuickAction);

  const q = useQuery({
    queryKey: ["dc", "detail", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const archiveM = useMutation({
    mutationFn: (action: "archive" | "unarchive") => quickAction({ data: { id, action } }),
    onSuccess: (_r, action) => {
      toast.success(action === "archive" ? "Dokumen diarsipkan" : "Dokumen dikembalikan");
      qc.invalidateQueries({ queryKey: ["dc", "detail", id] });
      qc.invalidateQueries({ queryKey: ["dc", "list"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Memuat detail…
      </div>
    );
  }

  const doc = q.data;
  if (!doc) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm">
        Dokumen tidak ditemukan atau Anda tidak memiliki akses.
      </div>
    );
  }

  const life = mapDocStatus(doc.status, doc.archived_at, doc.latest_signature_request?.status);
  const isArchived = !!doc.archived_at;

  function copyVerifyLink() {
    const url = doc?.latest_signature_request?.external_request_id
      ? `${window.location.origin}/v/${doc.latest_signature_request.external_request_id}`
      : `${window.location.origin}/admin/document-center/documents/${id}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Tautan disalin"),
      () => toast.error("Gagal menyalin"),
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Header dokumen */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Nomor</div>
              <div className="font-mono text-sm">{doc.doc_number ?? "—"}</div>
              <h2 className="mt-2 font-display text-xl font-bold">{doc.name ?? "(tanpa judul)"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <LifecycleBadge status={life} />
                <span>Dibuat {new Date(doc.generated_at).toLocaleString("id-ID")}</span>
                {doc.archived_at && (
                  <span>· Diarsipkan {new Date(doc.archived_at).toLocaleString("id-ID")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {doc.storage_path && (
              <a
                href={doc.storage_path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> Unduh PDF
              </a>
            )}
            <button
              onClick={copyVerifyLink}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" /> Salin tautan
            </button>
            {doc.latest_signature_request && (
              <Link
                to="/admin/document-center/signature/requests/$id"
                params={{ id: doc.latest_signature_request.id }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Buka request TTE
              </Link>
            )}
            {!isArchived ? (
              <button
                onClick={() => archiveM.mutate("archive")}
                disabled={archiveM.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <Archive className="h-3.5 w-3.5" /> Arsipkan
              </button>
            ) : (
              <button
                onClick={() => archiveM.mutate("unarchive")}
                disabled={archiveM.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Kembalikan
              </button>
            )}
          </div>
        </div>

        {/* Signers */}
        {doc.signers.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-display text-sm font-semibold">Penandatangan</h3>
            <ul className="divide-y divide-border">
              {doc.signers.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.full_name ?? s.email ?? s.user_id ?? "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.email ?? "—"}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="capitalize">{s.status}</div>
                    {s.signed_at && (
                      <div className="text-muted-foreground">
                        {new Date(s.signed_at).toLocaleString("id-ID")}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TTE metadata */}
        {doc.latest_signature_request && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <h3 className="mb-2 font-display text-sm font-semibold">Permintaan TTE</h3>
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{doc.latest_signature_request.status}</dd>
              <dt className="text-muted-foreground">External ID</dt>
              <dd className="font-mono">{doc.latest_signature_request.external_request_id ?? "—"}</dd>
              <dt className="text-muted-foreground">Dikirim</dt>
              <dd>
                {doc.latest_signature_request.sent_at
                  ? new Date(doc.latest_signature_request.sent_at).toLocaleString("id-ID")
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Selesai</dt>
              <dd>
                {doc.latest_signature_request.completed_at
                  ? new Date(doc.latest_signature_request.completed_at).toLocaleString("id-ID")
                  : "—"}
              </dd>
            </dl>
          </div>
        )}
      </div>

      <div id="timeline">
        <DocumentTimeline documentId={id} />
      </div>
    </div>
  );
}
