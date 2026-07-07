// Phase 2A — Palette node yang bisa di-drag ke canvas.
import { NODE_TYPES, type NodeType } from "@/features/workflows/schema/types";
import {
  Play,
  Send,
  Eye,
  CheckCircle2,
  RotateCcw,
  Share2,
  PenLine,
  GitBranch,
  Flag,
  XCircle,
} from "lucide-react";

const META: Record<NodeType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  start: { label: "Start", icon: Play },
  submit: { label: "Submit", icon: Send },
  review: { label: "Review", icon: Eye },
  approval: { label: "Approval", icon: CheckCircle2 },
  revision: { label: "Revision", icon: RotateCcw },
  disposisi: { label: "Disposisi", icon: Share2 },
  signature: { label: "Digital Signature", icon: PenLine },
  parallel: { label: "Parallel", icon: GitBranch },
  completed: { label: "Completed", icon: Flag },
  rejected: { label: "Rejected", icon: XCircle },
};

interface Props {
  onAdd: (type: NodeType) => void;
}

export function NodePalette({ onAdd }: Props) {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card p-3 overflow-y-auto">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Node Palette
      </div>
      <ul className="space-y-1">
        {NODE_TYPES.map((t) => {
          const m = META[t];
          const Icon = m.icon;
          return (
            <li key={t}>
              <button
                type="button"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("application/wf-node-type", t)}
                onClick={() => onAdd(t)}
                className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4 text-primary" />
                {m.label}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Klik atau drag node ke canvas.
      </p>
    </aside>
  );
}
