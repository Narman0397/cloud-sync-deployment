// Badge status siklus hidup dokumen — konsisten di seluruh Document Center.
import { LIFECYCLE, type LifecycleStatus } from "../lifecycle";

const toneClass: Record<string, string> = {
  muted:   "bg-muted text-muted-foreground border-border",
  info:    "bg-primary-soft text-primary border-primary/20",
  warning: "bg-amber-100 text-amber-900 border-amber-300",
  success: "bg-emerald-100 text-emerald-900 border-emerald-300",
  danger:  "bg-red-100 text-red-900 border-red-300",
  primary: "bg-primary text-primary-foreground border-primary",
};

export function LifecycleBadge({
  status,
  size = "md",
  showIcon = true,
}: {
  status: LifecycleStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
}) {
  const meta = LIFECYCLE[status];
  const Icon = meta.icon;
  const cls = toneClass[meta.tone] ?? toneClass.muted;
  const sz = size === "sm" ? "text-[10px] px-1.5 py-0.5 gap-1" : "text-xs px-2 py-0.5 gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${cls} ${sz}`}
      title={meta.label}
    >
      {showIcon ? <Icon className="h-3 w-3" /> : null}
      {meta.label}
    </span>
  );
}
