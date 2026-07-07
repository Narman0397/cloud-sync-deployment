// Feed aktivitas terbaru untuk dashboard Document Center.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dcRecentActivity } from "@/lib/document-center.functions";
import { FileText, PenLine } from "lucide-react";

function formatRel(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function RecentActivityFeed() {
  const fn = useServerFn(dcRecentActivity);
  const q = useQuery({ queryKey: ["dc", "activity"], queryFn: () => fn(), refetchInterval: 60_000 });
  const items = q.data ?? [];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Aktivitas Terbaru</h3>
        <span className="text-xs text-muted-foreground">15 event teratas</span>
      </div>
      {q.isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Belum ada aktivitas.</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const Icon = it.kind === "signature" ? PenLine : FileText;
            return (
              <li key={it.id} className="flex items-start gap-2 py-2 text-sm">
                <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.action.replaceAll("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.kind === "signature" ? "Tanda tangan" : "Dokumen"} • {formatRel(it.when)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
