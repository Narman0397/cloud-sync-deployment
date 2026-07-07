// Phase 2A — Visual preview (read-only) untuk workflow.
import type { WorkflowGraph } from "@/features/workflows/schema/types";

export function WorkflowPreview({ graph }: { graph: WorkflowGraph }) {
  // Sederhana: tampilkan urutan berdasarkan topological sort.
  const order = topoSort(graph);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 font-semibold">Preview Alur</h3>
      <ol className="space-y-1">
        {order.map((n, i) => (
          <li key={n.id} className="flex items-center gap-2 text-sm">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
              {i + 1}
            </span>
            <span className="font-medium">{n.label}</span>
            <span className="text-xs text-muted-foreground">({n.type})</span>
            {n.sla_hours ? (
              <span className="ml-auto text-xs text-muted-foreground">SLA: {n.sla_hours}j</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function topoSort(g: WorkflowGraph) {
  const indeg = new Map<string, number>();
  g.nodes.forEach((n) => indeg.set(n.id, 0));
  g.edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1));
  const queue = g.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const out: typeof g.nodes = [];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    for (const e of g.edges.filter((x) => x.from === n.id)) {
      const d = (indeg.get(e.to) ?? 0) - 1;
      indeg.set(e.to, d);
      if (d === 0) {
        const next = g.nodes.find((x) => x.id === e.to);
        if (next) queue.push(next);
      }
    }
  }
  // sertakan node yang belum terjamah (cyclic)
  for (const n of g.nodes) if (!out.includes(n)) out.push(n);
  return out;
}
