// Phase 2B — Workflow Runtime types.
// Status & aksi runtime untuk submission_tasks.

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "approved",
  "rejected",
  "revision_requested",
  "delegated",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_ACTIONS = [
  "approve",
  "reject",
  "request_revision",
  "forward",
  "complete",
  "delegate",
] as const;
export type TaskAction = (typeof TASK_ACTIONS)[number];

/** Status submission terkait runtime workflow (subset state-machine). */
export const RUNTIME_SUBMISSION_STATUSES = [
  "submitted",
  "in_review",
  "revision_required",
  "approved",
  "rejected",
  "completed",
  "cancelled",
] as const;
export type RuntimeSubmissionStatus = (typeof RUNTIME_SUBMISSION_STATUSES)[number];
