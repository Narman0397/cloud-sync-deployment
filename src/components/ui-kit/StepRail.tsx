// Vertical step rail untuk wizard panjang.
// Kelompokkan step jadi fase, tampilkan status (done/current/locked) dengan progress.
import { Check, Lock } from "lucide-react";

export interface StepRailItem {
  id: string;
  label: string;
  hint?: string;
}
export interface StepRailPhase {
  title: string;
  items: StepRailItem[];
}

interface Props {
  phases: StepRailPhase[];
  currentId: string;
  doneIds?: ReadonlyArray<string>;
  lockedIds?: ReadonlyArray<string>;
  onSelect?: (id: string) => void;
}

export function StepRail({ phases, currentId, doneIds = [], lockedIds = [], onSelect }: Props) {
  const all = phases.flatMap((p) => p.items);
  const total = all.length;
  const doneCount = all.filter((s) => doneIds.includes(s.id)).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <nav aria-label="Langkah" className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Progress</span>
          <span>
            {doneCount}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {phases.map((phase) => (
        <div key={phase.title}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {phase.title}
          </div>
          <ol className="space-y-1">
            {phase.items.map((item, idx) => {
              const isDone = doneIds.includes(item.id);
              const isCurrent = item.id === currentId;
              const isLocked = lockedIds.includes(item.id);
              const globalIdx = all.findIndex((s) => s.id === item.id) + 1;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => onSelect?.(item.id)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                      isCurrent
                        ? "bg-primary-soft text-foreground"
                        : isLocked
                          ? "opacity-50"
                          : "hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                        isDone
                          ? "bg-primary text-primary-foreground"
                          : isCurrent
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isLocked ? (
                        <Lock className="h-3 w-3" />
                      ) : isDone ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        globalIdx
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-tight ${
                          isCurrent ? "font-semibold text-foreground" : "text-foreground/90"
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {idx < phase.items.length - 1 ? (
                    <span className="ml-[1.4rem] block h-2 w-px bg-border" aria-hidden />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}