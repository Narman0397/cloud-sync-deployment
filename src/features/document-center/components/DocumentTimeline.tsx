// Timeline gabungan aktivitas dokumen — document_audit + document_history + signature_events.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dcTimeline } from "@/lib/document-center.functions";
import { FileText, PenLine, Clock } from "lucide-react";

export function DocumentTimeline({ documentId }: { documentId: string }) {
  const fn = useServerFn(dcTimeline);
  const q = useQuery({
    queryKey: ["dc", "timeline", documentId],
    queryFn: () => fn({ data: { documentId } }),
  });
  const events = q.data ?? [];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold">Riwayat Aktivitas</h3>
      {q.isLoading ? (
        <div className="py-4 text-center text-xs text-muted-foreground">Memuat…</div>
      ) : events.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">Belum ada aktivitas.</div>
      ) : (
        <ol className="relative border-l border-border pl-4">
          {events.map((e) => {
            const Icon = e.kind === "signature" ? PenLine : e.kind === "audit" ? FileText : Clock;
            return (
              <li key={e.id} className="mb-3 last:mb-0">
                <span className="absolute -left-[7px] mt-1 grid h-3 w-3 place-items-center rounded-full border border-border bg-background">
                  <Icon className="h-2 w-2 text-muted-foreground" />
                </span>
                <div className="text-sm font-medium capitalize">
                  {e.action.replaceAll("_", " ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.when).toLocaleString("id-ID")}
                  {e.actor ? ` • oleh ${e.actor.slice(0, 8)}` : ""}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
