// Tabel dokumen dengan filter URL-driven + quick action menu.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { dcListDocuments } from "@/lib/document-center.functions";
import { LifecycleBadge } from "./LifecycleBadge";
import { ALL_STATUSES, LIFECYCLE, mapDocStatus } from "../lifecycle";
import { Search, X, Download, History, ExternalLink, MoreHorizontal } from "lucide-react";

type SearchState = {
  q?: string;
  statuses?: string;
  from?: string;
  to?: string;
};

export function DocumentsTable({ routeId }: { routeId: "/_authenticated/admin/document-center/documents" }) {
  const navigate = useNavigate();
  const search = useSearch({ from: routeId }) as SearchState;
  const [qDraft, setQDraft] = useState(search.q ?? "");

  const statuses = useMemo(
    () => (search.statuses ? search.statuses.split(",").filter(Boolean) : []),
    [search.statuses],
  );

  const fn = useServerFn(dcListDocuments);
  const query = useQuery({
    queryKey: ["dc", "list", search.q ?? "", statuses.join(","), search.from ?? "", search.to ?? ""],
    queryFn: () =>
      fn({
        data: {
          q: search.q,
          statuses: statuses.length > 0 ? mapUiStatusesToDb(statuses) : undefined,
          from: search.from,
          to: search.to,
          limit: 100,
        },
      }),
  });

  function updateSearch(patch: Partial<SearchState>) {
    navigate({
      to: "/admin/document-center/documents",
      search: (prev) => ({ ...(prev as SearchState), ...patch }),
    });
  }

  function toggleStatus(uiStatus: string) {
    const next = new Set(statuses);
    if (next.has(uiStatus)) next.delete(uiStatus);
    else next.add(uiStatus);
    updateSearch({ statuses: next.size > 0 ? Array.from(next).join(",") : undefined });
  }

  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-3">
      {/* Toolbar filter */}
      <div className="rounded-lg border border-border bg-card p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateSearch({ q: qDraft || undefined });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Cari nomor dokumen atau judul…"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-8 text-sm"
            />
            {qDraft && (
              <button
                type="button"
                onClick={() => {
                  setQDraft("");
                  updateSearch({ q: undefined });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input
            type="date"
            value={search.from ?? ""}
            onChange={(e) => updateSearch({ from: e.target.value || undefined })}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            aria-label="Dari tanggal"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={search.to ?? ""}
            onChange={(e) => updateSearch({ to: e.target.value || undefined })}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            aria-label="Sampai tanggal"
          />
        </form>
        {/* Filter chip status */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => {
            const active = statuses.includes(s);
            const meta = LIFECYCLE[s];
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
          {statuses.length > 0 && (
            <button
              onClick={() => updateSearch({ statuses: undefined })}
              className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Nomor</th>
              <th className="px-3 py-2 text-left">Nama Dokumen</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Dibuat</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {query.isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            )}
            {!query.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Tidak ada dokumen sesuai filter.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const life = mapDocStatus(r.status, r.archived_at);
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{r.doc_number ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/document-center/documents/$id"
                      params={{ id: r.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.name ?? "(tanpa judul)"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <LifecycleBadge status={life} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(r.generated_at).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QuickActions doc={r} lifecycle={life} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground">
        Menampilkan {rows.length} dari {query.data?.total ?? 0} dokumen.
      </div>
    </div>
  );
}

function QuickActions({
  doc,
  lifecycle,
}: {
  doc: { id: string; storage_path: string | null };
  lifecycle: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-elevated">
          <Link
            to="/admin/document-center/documents/$id"
            params={{ id: doc.id }}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Buka detail
          </Link>
          <Link
            to="/admin/document-center/documents/$id"
            params={{ id: doc.id }}
            hash="timeline"
            className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
          >
            <History className="h-3.5 w-3.5" /> Lihat riwayat
          </Link>
          {doc.storage_path && (
            <a
              href={doc.storage_path}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> Unduh PDF
            </a>
          )}
          {(lifecycle === "menunggu_ttd" || lifecycle === "gagal") && (
            <Link
              to="/admin/document-center/signature/queue"
              className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
            >
              → Antrian TTD
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Map dari UI display status → beberapa nilai kolom status di DB agar filter tepat.
function mapUiStatusesToDb(ui: string[]): string[] {
  const map: Record<string, string[]> = {
    draft: ["draft", "generated"],
    menunggu_review: ["under_review"],
    perlu_revisi: ["revision_required"],
    disetujui: ["approved"],
    menunggu_ttd: ["awaiting_signature"],
    sedang_ttd: ["signing"],
    ttd_berhasil: ["signed", "completed"],
    gagal: ["failed", "rejected"],
    diarsipkan: ["archived"],
  };
  const out = new Set<string>();
  for (const u of ui) (map[u] ?? [u]).forEach((s) => out.add(s));
  return Array.from(out);
}
