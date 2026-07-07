// Phase 2A — Properties Panel untuk node terpilih.
import { useMemo } from "react";
import type {
  AssignmentType,
  NodeAction,
  WorkflowGraph,
  WorkflowNode,
} from "@/features/workflows/schema/types";
import { ASSIGNMENT_TYPES, NODE_ACTIONS } from "@/features/workflows/schema/types";
import { KNOWN_ROLES } from "@/features/workflows/services/workflow-assignment.service";

interface Props {
  graph: WorkflowGraph;
  selectedId: string | null;
  disabled?: boolean;
  onChange: (node: WorkflowNode) => void;
  onDelete: (id: string) => void;
}

export function PropertiesPanel({ graph, selectedId, disabled, onChange, onDelete }: Props) {
  const node = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph, selectedId],
  );

  if (!node) {
    return (
      <aside className="w-80 shrink-0 border-l border-border bg-card p-3 overflow-y-auto">
        <p className="text-sm text-muted-foreground">Pilih node untuk mengedit propertinya.</p>
      </aside>
    );
  }

  const update = (patch: Partial<WorkflowNode>) => onChange({ ...node, ...patch });
  const updateConfig = (patch: Partial<typeof node.config>) =>
    onChange({ ...node, config: { ...node.config, ...patch } });
  const updateAssignment = (patch: Partial<NonNullable<typeof node.config.assignment>>) => {
    const base = node.config.assignment ?? { type: "role" as AssignmentType };
    updateConfig({ assignment: { ...base, ...patch } });
  };

  const isEnd = node.type === "completed" || node.type === "rejected";
  const isStart = node.type === "start" || node.type === "submit";
  const showAssignment = !isStart && !isEnd && node.type !== "parallel";

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card p-3 overflow-y-auto text-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">Properties</div>
        {!disabled && !isStart ? (
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="text-xs text-destructive hover:underline"
          >
            Hapus
          </button>
        ) : null}
      </div>

      <Section title="General">
        <Field label="Name">
          <input
            disabled={disabled}
            className="input"
            value={node.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </Field>
        <Field label="Key">
          <input
            disabled={disabled || node.id === "start"}
            className="input"
            value={node.id}
            onChange={(e) =>
              update({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 60) })
            }
          />
        </Field>
        <Field label="Description">
          <textarea
            disabled={disabled}
            className="input min-h-[60px]"
            value={node.config.description ?? ""}
            onChange={(e) => updateConfig({ description: e.target.value })}
          />
        </Field>
      </Section>

      <Section title="Behavior">
        <Toggle
          disabled={disabled}
          label="Required"
          checked={!!node.config.required}
          onChange={(v) => updateConfig({ required: v })}
        />
        <Toggle
          disabled={disabled}
          label="Allow Comment"
          checked={!!node.config.allow_comment}
          onChange={(v) => updateConfig({ allow_comment: v })}
        />
        <Toggle
          disabled={disabled}
          label="Allow Attachment"
          checked={!!node.config.allow_attachment}
          onChange={(v) => updateConfig({ allow_attachment: v })}
        />
        <Toggle
          disabled={disabled}
          label="Allow Delegation"
          checked={!!node.config.allow_delegation}
          onChange={(v) => updateConfig({ allow_delegation: v })}
        />
      </Section>

      {node.type === "parallel" ? (
        <Section title="Parallel">
          <Field label="Mode">
            <select
              disabled={disabled}
              className="input"
              value={node.config.parallel_mode ?? "all"}
              onChange={(e) =>
                updateConfig({ parallel_mode: e.target.value as "all" | "any" })
              }
            >
              <option value="all">Require All</option>
              <option value="any">Require Any</option>
            </select>
          </Field>
        </Section>
      ) : null}

      {showAssignment ? (
        <Section title="Assignment">
          <Field label="Type">
            <select
              disabled={disabled}
              className="input"
              value={node.config.assignment?.type ?? "role"}
              onChange={(e) => updateAssignment({ type: e.target.value as AssignmentType })}
            >
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          {node.config.assignment?.type === "role" ? (
            <>
              <Field label="Role">
                <select
                  disabled={disabled}
                  className="input"
                  value={node.config.assignment?.role ?? ""}
                  onChange={(e) => updateAssignment({ role: e.target.value })}
                >
                  <option value="">— pilih role —</option>
                  {KNOWN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                disabled={disabled}
                label="Same OPD as Applicant"
                checked={!!node.config.assignment?.same_opd_as_applicant}
                onChange={(v) => updateAssignment({ same_opd_as_applicant: v })}
              />
            </>
          ) : null}
          {node.config.assignment?.type === "specific_user" ? (
            <Field label="User ID (UUID)">
              <input
                disabled={disabled}
                className="input"
                value={node.config.assignment?.user_id ?? ""}
                onChange={(e) => updateAssignment({ user_id: e.target.value })}
              />
            </Field>
          ) : null}
          {node.config.assignment?.type === "opd" ? (
            <Field label="OPD ID (UUID, kosongkan jika same-as-applicant)">
              <input
                disabled={disabled}
                className="input"
                value={node.config.assignment?.opd_id ?? ""}
                onChange={(e) => updateAssignment({ opd_id: e.target.value })}
              />
            </Field>
          ) : null}
          {node.config.assignment?.type === "department" ? (
            <Field label="Department">
              <input
                disabled={disabled}
                className="input"
                value={node.config.assignment?.department ?? ""}
                onChange={(e) => updateAssignment({ department: e.target.value })}
              />
            </Field>
          ) : null}
        </Section>
      ) : null}

      <Section title="SLA">
        <Field label="SLA (jam)">
          <input
            disabled={disabled}
            type="number"
            min={0}
            className="input"
            value={node.sla_hours ?? ""}
            onChange={(e) =>
              update({ sla_hours: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </Field>
      </Section>

      <Section title="Escalation">
        <Toggle
          disabled={disabled}
          label="Aktifkan eskalasi"
          checked={!!node.config.escalation?.enabled}
          onChange={(v) =>
            updateConfig({
              escalation: { ...(node.config.escalation ?? { enabled: false }), enabled: v },
            })
          }
        />
        {node.config.escalation?.enabled ? (
          <>
            <Field label="Setelah (jam)">
              <input
                disabled={disabled}
                type="number"
                min={0}
                className="input"
                value={node.config.escalation?.after_hours ?? ""}
                onChange={(e) =>
                  updateConfig({
                    escalation: {
                      ...(node.config.escalation ?? { enabled: true }),
                      after_hours: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Escalate To">
              <select
                disabled={disabled}
                className="input"
                value={node.config.escalation?.escalate_to_type ?? "manager"}
                onChange={(e) =>
                  updateConfig({
                    escalation: {
                      ...(node.config.escalation ?? { enabled: true }),
                      escalate_to_type: e.target.value as "manager" | "user" | "role",
                    },
                  })
                }
              >
                <option value="manager">Manager</option>
                <option value="user">Specific User</option>
                <option value="role">Role</option>
              </select>
            </Field>
            {node.config.escalation?.escalate_to_type === "role" ? (
              <Field label="Role">
                <select
                  disabled={disabled}
                  className="input"
                  value={node.config.escalation?.escalate_to_role ?? ""}
                  onChange={(e) =>
                    updateConfig({
                      escalation: {
                        ...(node.config.escalation ?? { enabled: true }),
                        escalate_to_role: e.target.value,
                      },
                    })
                  }
                >
                  <option value="">— pilih —</option>
                  {KNOWN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title="Actions">
        <div className="space-y-1">
          {NODE_ACTIONS.map((a) => (
            <Toggle
              key={a}
              disabled={disabled}
              label={a.replace(/_/g, " ")}
              checked={(node.config.actions ?? []).includes(a)}
              onChange={(v) => {
                const cur = new Set<NodeAction>(node.config.actions ?? []);
                if (v) cur.add(a);
                else cur.delete(a);
                updateConfig({ actions: Array.from(cur) });
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Notifications">
        <Toggle
          disabled={disabled}
          label="Email"
          checked={!!node.config.notifications?.email}
          onChange={(v) =>
            updateConfig({
              notifications: {
                email: v,
                in_app: !!node.config.notifications?.in_app,
              },
            })
          }
        />
        <Toggle
          disabled={disabled}
          label="In-App"
          checked={!!node.config.notifications?.in_app}
          onChange={(v) =>
            updateConfig({
              notifications: {
                email: !!node.config.notifications?.email,
                in_app: v,
              },
            })
          }
        />
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
