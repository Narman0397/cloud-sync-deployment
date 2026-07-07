// Sprint D: Inbox review submission dataset (admin OPD + super admin).
// Tampilan data dirender sebagai key-value yang mudah dibaca + dialog catatan
// menggantikan window.prompt() agar konsisten dengan modul review lainnya.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { listPendingReviews, reviewSubmission } from "@/lib/dataset-review.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/dataset/review")({
  head: () => ({
    meta: [{ title: "Review Dataset — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Admin" }, { label: "Review Dataset" }]}>
        <Page />
      </AdminShell>
    </AdminGuard>
  ),
});

type Row = {
  id: string;
  template_id: string;
  oleh_user_id: string;
  opd_id: string | null;
  data: Record<string, unknown>;
  review_status: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

type Action = "approve" | "reject" | "request_revision";

function Page() {
  const fnList = useServerFn(listPendingReviews);
  const fnReview = useServerFn(reviewSubmission);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "revision">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Row | null>(null);
  const [confirmAct, setConfirmAct] = useState<{ row: Row; aksi: Action } | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = (await fnList({ data: { status, page: 0, pageSize: 50 } })) as {
        rows: Row[];
        total: number;
      };
      setRows(r.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [status]);

  function openAction(row: Row, aksi: Action) {
    setConfirmAct({ row, aksi });
    setNote("");
  }

  async function submitAction() {
    if (!confirmAct) return;
    const { row, aksi } = confirmAct;
    if (aksi !== "approve" && note.trim().length < 3) {
      toast.error("Catatan wajib minimal 3 karakter");
      return;
    }
    setBusy(true);
    try {
      await fnReview({
        data: {
          submissionId: row.id,
          aksi,
          catatan: note.trim() || undefined,
        },
      });
      toast.success("Review tersimpan");
      setConfirmAct(null);
      setDetail(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Review Submission Dataset</h2>
        <p className="text-sm text-muted-foreground">
          Approve / reject / minta revisi atas submission ASN.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["pending", "revision", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-1.5 text-xs uppercase ${
              status === s ? "bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Dikirim</th>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Ringkasan Data</th>
                <th className="px-3 py-2 text-left">Catatan</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Memuat…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Tidak ada submission.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const keys = Object.keys(r.data ?? {}).slice(0, 2);
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {new Date(r.submitted_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{r.template_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 text-xs">
                      {keys.length === 0 ? (
                        <span className="text-muted-foreground italic">(tidak ada data)</span>
                      ) : (
                        <div className="space-y-0.5">
                          {keys.map((k) => (
                            <div key={k} className="truncate max-w-xs">
                              <span className="font-medium text-muted-foreground">{k}:</span>{" "}
                              {formatVal(r.data[k])}
                            </div>
                          ))}
                          {Object.keys(r.data ?? {}).length > 2 && (
                            <div className="text-[10px] text-muted-foreground">
                              +{Object.keys(r.data).length - 2} field lain
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[12rem] truncate">
                      {r.review_note ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                          <Eye className="mr-1 h-3 w-3" /> Detail
                        </Button>
                        {(status === "pending" || status === "revision") && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={busy}
                              onClick={() => openAction(r, "approve")}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => openAction(r, "request_revision")}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" /> Revisi
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => openAction(r, "reject")}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      {detail && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">Detail Submission</h3>
                <div className="text-xs text-muted-foreground">
                  Dikirim {new Date(detail.submitted_at).toLocaleString("id-ID")} · Status{" "}
                  <span className="font-semibold uppercase">{detail.review_status}</span>
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <dl className="divide-y divide-border rounded-md border border-border bg-background">
              {Object.entries(detail.data ?? {}).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm">
                  <dt className="font-medium text-muted-foreground">{k}</dt>
                  <dd className="col-span-2 break-words">{formatVal(v)}</dd>
                </div>
              ))}
              {Object.keys(detail.data ?? {}).length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground italic">
                  (tidak ada data)
                </div>
              )}
            </dl>
            {detail.review_note && (
              <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <div className="font-medium text-muted-foreground">Catatan reviewer:</div>
                <div className="mt-1">{detail.review_note}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Konfirmasi aksi */}
      {confirmAct && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-elevated">
            <h3 className="mb-1 font-display text-lg font-bold">
              {confirmAct.aksi === "approve"
                ? "Setujui submission?"
                : confirmAct.aksi === "reject"
                  ? "Tolak submission?"
                  : "Minta revisi?"}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {confirmAct.aksi === "approve"
                ? "Catatan opsional, akan terlihat oleh pengirim."
                : "Catatan wajib (min 3 karakter) — jelaskan alasannya."}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder={
                confirmAct.aksi === "approve"
                  ? "Catatan (opsional)"
                  : "Tuliskan alasan / instruksi revisi…"
              }
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmAct(null)} disabled={busy}>
                Batal
              </Button>
              <Button
                variant={confirmAct.aksi === "reject" ? "destructive" : "default"}
                onClick={submitAction}
                disabled={busy}
              >
                {busy ? "Menyimpan…" : "Konfirmasi"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
