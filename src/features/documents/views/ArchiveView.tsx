// Archive view — dipakai di legacy /admin/documents/archive
// dan di /admin/document-center/archive.
import { useEffect, useState } from "react";
import { docListDocuments, docDownloadDocument, docGetDocument } from "@/lib/documents.functions";
import { Download, Eye, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { HelpHint } from "@/components/ui-kit/HelpHint";

type Row = {
  id: string;
  doc_number: string | null;
  name: string | null;
  status: string;
  mime: string;
  generated_at: string;
  archived_at: string | null;
};
type HistRow = { id: string; action: string; created_at: string };

export function ArchiveView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const payload: Record<string, unknown> = { archived: true };
      if (q) payload.q = q;
      const r = (await docListDocuments({ data: payload as never })) as unknown as { rows: Row[] };
      if (!cancelled) {
        setRows(r.rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  async function openHist(id: string) {
    setOpenId(id);
    const r = (await docGetDocument({ data: { id } })) as unknown as { history: HistRow[] };
    setHistory(r.history);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Arsip"
        title="Arsip Dokumen"
        description="Dokumen yang sudah selesai diproses dan disimpan untuk pencarian dan audit di kemudian hari."
        actions={
          <div className="flex items-center gap-2">
            <HelpHint title="Kapan dokumen masuk arsip?">
              Dokumen yang sudah ditandatangani dan diserahkan biasanya diarsipkan agar tidak mengganggu daftar aktif, namun tetap bisa dicari dan diunduh.
            </HelpHint>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari arsip…" className="h-9 rounded-md border bg-background px-2 text-sm" />
          </div>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nomor</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Diarsipkan</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Arsip kosong.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.doc_number ?? "—"}</td>
                <td className="px-3 py-2">{r.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.archived_at ? new Date(r.archived_at).toLocaleString("id-ID") : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        const x = (await docDownloadDocument({ data: { id: r.id } })) as { url: string };
                        window.open(x.url, "_blank");
                      }}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Download className="h-3 w-3" /> Unduh
                    </button>
                    <button
                      onClick={() => openHist(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Eye className="h-3 w-3" /> Riwayat
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-elevated">
            <h3 className="mb-3 font-display text-lg font-bold">Riwayat Dokumen</h3>
            <ul className="space-y-1 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2 border-b border-border py-1">
                  <span className="font-mono text-xs">{h.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("id-ID")}
                  </span>
                </li>
              ))}
              {history.length === 0 && (
                <li className="text-xs text-muted-foreground">Tidak ada riwayat.</li>
              )}
            </ul>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setOpenId(null)} className="rounded-md border px-3 py-1.5 text-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
