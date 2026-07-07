// Phase 2A — Default node factories & built-in workflow templates.
import type {
  NodeConfig,
  NodeType,
  WorkflowGraph,
  WorkflowNode,
} from "./types";

export function defaultConfigFor(type: NodeType): NodeConfig {
  const base: NodeConfig = {
    description: "",
    required: true,
    allow_comment: true,
    allow_attachment: false,
    allow_delegation: false,
    notifications: { email: true, in_app: true },
    escalation: { enabled: false },
  };
  switch (type) {
    case "start":
    case "submit":
      return { ...base, actions: ["complete"], required: false };
    case "review":
      return {
        ...base,
        actions: ["approve", "reject", "request_revision"],
        assignment: { type: "role", role: "verifikator_bkpsdm" },
      };
    case "approval":
      return {
        ...base,
        actions: ["approve", "reject"],
        assignment: {
          type: "role",
          role: "kepala_opd",
          same_opd_as_applicant: true,
        },
      };
    case "revision":
      return { ...base, actions: ["complete"], allow_attachment: true };
    case "disposisi":
      return {
        ...base,
        actions: ["forward", "complete"],
        assignment: { type: "role", role: "kepala_opd" },
      };
    case "signature":
      return {
        ...base,
        actions: ["complete"],
        assignment: { type: "role", role: "kepala_opd" },
      };
    case "parallel":
      return { ...base, parallel_mode: "all", actions: [] };
    case "completed":
    case "rejected":
      return { ...base, actions: [], required: false };
  }
}

export function createNode(
  type: NodeType,
  position: { x: number; y: number },
  partial?: Partial<WorkflowNode>,
): WorkflowNode {
  const id =
    partial?.id ??
    `${type}_${Math.random().toString(36).slice(2, 8)}`;
  const labels: Record<NodeType, string> = {
    start: "Start",
    submit: "Submit",
    review: "Review",
    approval: "Approval",
    revision: "Revision",
    disposisi: "Disposisi",
    signature: "Digital Signature",
    parallel: "Parallel",
    completed: "Completed",
    rejected: "Rejected",
  };
  return {
    id,
    type,
    label: partial?.label ?? labels[type],
    position,
    sla_hours: partial?.sla_hours ?? null,
    config: partial?.config ?? defaultConfigFor(type),
  };
}

// ---------------- Built-in templates ----------------
export interface BuiltInTemplate {
  code: string;
  name: string;
  description: string;
  category: string;
  graph: WorkflowGraph;
}

function chain(types: NodeType[]): WorkflowGraph {
  const nodes = types.map((t, i) => createNode(t, { x: 80 + i * 220, y: 160 }));
  const edges = nodes.slice(0, -1).map((n, i) => ({
    id: `e_${n.id}_${nodes[i + 1].id}`,
    from: n.id,
    to: nodes[i + 1].id,
    kind: "approve" as const,
    label: "Lanjut",
  }));
  return { nodes, edges };
}

export const BUILTIN_TEMPLATES: BuiltInTemplate[] = [
  {
    code: "TPL_2L",
    name: "2-Level Approval",
    category: "approval",
    description: "Submit → Review → Approval → Completed",
    graph: chain(["start", "submit", "review", "approval", "completed"]),
  },
  {
    code: "TPL_3L",
    name: "3-Level Approval",
    category: "approval",
    description: "Submit → Review → Approval L1 → Approval L2 → Completed",
    graph: chain([
      "start",
      "submit",
      "review",
      "approval",
      "approval",
      "completed",
    ]),
  },
  {
    code: "TPL_RA",
    name: "Review + Approval",
    category: "approval",
    description: "Alur sederhana review lalu approval.",
    graph: chain(["start", "submit", "review", "approval", "completed"]),
  },
  {
    code: "TPL_RR",
    name: "Review + Revision",
    category: "review",
    description: "Review dengan jalur revisi.",
    graph: chain(["start", "submit", "review", "revision", "completed"]),
  },
  {
    code: "TPL_DISP",
    name: "Disposisi",
    category: "disposisi",
    description: "Alur disposisi pimpinan.",
    graph: chain(["start", "submit", "disposisi", "completed"]),
  },
  {
    code: "TPL_TTE",
    name: "Digital Signature Flow",
    category: "signature",
    description: "Approval + tanda tangan elektronik.",
    graph: chain([
      "start",
      "submit",
      "review",
      "approval",
      "signature",
      "completed",
    ]),
  },
];

export function emptyGraph(): WorkflowGraph {
  return {
    nodes: [
      createNode("start", { x: 80, y: 160 }, { id: "start", label: "Start" }),
    ],
    edges: [],
  };
}
