// Phase 2A — Workflow graph validation (pre-publish gate).
import type { WorkflowGraph } from "./types";

export interface ValidationIssue {
  code:
    | "no_start"
    | "no_end"
    | "orphan_node"
    | "circular"
    | "missing_assignment"
    | "broken_transition"
    | "duplicate_key";
  message: string;
  node_id?: string;
  edge_id?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const NEEDS_ASSIGNMENT: ReadonlyArray<string> = [
  "review",
  "approval",
  "revision",
  "disposisi",
  "signature",
];

const END_NODES: ReadonlyArray<string> = ["completed", "rejected"];

export function validateGraph(graph: WorkflowGraph): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { nodes, edges } = graph;

  if (!nodes.some((n) => n.type === "start")) {
    issues.push({ code: "no_start", message: "Workflow harus memiliki node Start." });
  }
  if (!nodes.some((n) => END_NODES.includes(n.type))) {
    issues.push({ code: "no_end", message: "Workflow harus memiliki node Completed atau Rejected." });
  }

  // Duplicate keys
  const keyMap = new Map<string, number>();
  for (const n of nodes) {
    keyMap.set(n.id, (keyMap.get(n.id) ?? 0) + 1);
  }
  for (const [key, count] of keyMap) {
    if (count > 1) issues.push({ code: "duplicate_key", message: `Node key duplikat: ${key}`, node_id: key });
  }

  // Broken edges
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
      issues.push({
        code: "broken_transition",
        message: `Edge ${e.id} merujuk node yang tidak ada.`,
        edge_id: e.id,
      });
    }
  }

  // Orphan nodes (tidak terhubung sama sekali; kecuali start tunggal)
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  for (const n of nodes) {
    if (nodes.length > 1 && !connected.has(n.id)) {
      issues.push({
        code: "orphan_node",
        message: `Node "${n.label}" tidak terhubung ke alur.`,
        node_id: n.id,
      });
    }
  }

  // Missing assignment
  for (const n of nodes) {
    if (NEEDS_ASSIGNMENT.includes(n.type)) {
      const a = n.config?.assignment;
      const valid =
        !!a &&
        ((a.type === "specific_user" && !!a.user_id) ||
          (a.type === "role" && !!a.role) ||
          (a.type === "opd" && (!!a.opd_id || a.same_opd_as_applicant)) ||
          (a.type === "department" && !!a.department) ||
          a.type === "current_user_manager");
      if (!valid) {
        issues.push({
          code: "missing_assignment",
          message: `Node "${n.label}" belum memiliki assignment yang valid.`,
          node_id: n.id,
        });
      }
    }
  }

  // Circular dependency (DFS)
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  nodes.forEach((n) => color.set(n.id, WHITE));
  let cyc = false;
  function dfs(u: string): void {
    color.set(u, GRAY);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) {
        cyc = true;
        return;
      }
      if (c === WHITE) {
        dfs(v);
        if (cyc) return;
      }
    }
    color.set(u, BLACK);
  }
  for (const n of nodes) {
    if (color.get(n.id) === WHITE) {
      dfs(n.id);
      if (cyc) break;
    }
  }
  if (cyc) {
    issues.push({ code: "circular", message: "Workflow mengandung circular dependency." });
  }

  return { ok: issues.length === 0, issues };
}
