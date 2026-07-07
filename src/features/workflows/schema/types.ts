// Phase 2A — Workflow Builder schema types.
// Tipe ini dipakai bersama oleh designer (client) & service (server).

export const NODE_TYPES = [
  "start",
  "submit",
  "review",
  "approval",
  "revision",
  "disposisi",
  "signature",
  "parallel",
  "completed",
  "rejected",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const ASSIGNMENT_TYPES = [
  "specific_user",
  "role",
  "opd",
  "department",
  "current_user_manager",
] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export interface NodeAssignment {
  type: AssignmentType;
  user_id?: string | null;
  role?: string | null;
  opd_id?: string | null;
  department?: string | null;
  /** Saat true: role/opd dievaluasi berdasarkan OPD pemohon (same OPD as applicant). */
  same_opd_as_applicant?: boolean;
}

export interface NodeEscalation {
  enabled: boolean;
  after_hours?: number;
  escalate_to_type?: "manager" | "user" | "role";
  escalate_to_user_id?: string | null;
  escalate_to_role?: string | null;
}

export interface NodeNotifications {
  email: boolean;
  in_app: boolean;
}

export interface NodeConfig {
  description?: string;
  required?: boolean;
  allow_comment?: boolean;
  allow_attachment?: boolean;
  allow_delegation?: boolean;
  assignment?: NodeAssignment;
  /** Untuk parallel: require_all | require_any. */
  parallel_mode?: "all" | "any";
  escalation?: NodeEscalation;
  notifications?: NodeNotifications;
  /** Aksi yang tersedia di node ini (subset dari NODE_ACTIONS). */
  actions?: NodeAction[];
}

export const NODE_ACTIONS = [
  "approve",
  "reject",
  "request_revision",
  "forward",
  "complete",
] as const;
export type NodeAction = (typeof NODE_ACTIONS)[number];

export interface WorkflowNode {
  id: string; // node_key
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  sla_hours?: number | null;
  config: NodeConfig;
}

export type EdgePathKind = "approve" | "reject" | "revision" | "default";

export type EdgeConditionValue =
  | string
  | number
  | boolean
  | null
  | EdgeConditionValue[]
  | { [key: string]: EdgeConditionValue };

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: EdgePathKind;
  condition?: EdgeConditionValue | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  status: "draft" | "active" | "archived";
  opd_pemilik_id: string | null;
  form_id: string | null;
  current_version_id: string | null;
  current_version_number: number | null;
  current_version_status: string | null;
  current_version_locked: boolean;
  current_version_submission_count: number;
  updated_at: string;
}

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  category: string | null;
  scope: "global" | "opd";
  owner_opd_id: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
}
