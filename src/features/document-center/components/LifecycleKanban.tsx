// Kanban Lifecycle read-only — mengelompokkan dokumen per stage.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { dcListDocuments } from "@/lib/document-center.functions";
import { STAGES, mapDocStatus, LIFECYCLE } from "../lifecycle";
import { LifecycleBadge } from "./LifecycleBadge";

export function LifecycleKanban() {
  const fn = useServerFn(dcListDocuments);
  const q = useQuery({
    queryKey: ["dc", "kanban"],
    queryFn: () => fn({ data: { limit: 200 } }),
  });
  const rows = q.data?.rows ?? [];

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {STAGES.map((stage) => {
        const inStage = rows.filter((r) => {
          const life = mapDocStatus(r.status, r.archived_at);
          return LIFECYCLE[life].stage === stage.key;
        });
        return (
          <div key={stage.key} className="flex flex-col rounded-lg border border-border bg-muted/30">
            <div className="border-b border-border p-2">
              <div className="font-display text-xs font-semibold uppercase tracking-wide">
                {stage.label}
              </div>
              <div className="text-[10px] text-muted-foreground">{inStage.length} dokumen</div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: 480 }}>
              {inStage.map((r) => (
                <Link
                  key={r.id}
                  to="/admin/document-center/documents/$id"
                  params={{ id: r.id }}
                  className="block rounded-md border border-border bg-card p-2 text-xs shadow-soft hover:shadow-elevated"
                >
                  <div className="truncate font-medium">{r.name ?? r.doc_number ?? "Dokumen"}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <LifecycleBadge status={mapDocStatus(r.status, r.archived_at)} size="sm" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.generated_at).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                </Link>
              ))}
              {inStage.length === 0 && (
                <div className="py-6 text-center text-[10px] text-muted-foreground">
                  Kosong
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
