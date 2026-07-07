// Feed audit log 10 terbaru untuk Super Admin.
import { Activity } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type ActivityRow = {
  id: string;
  action: string;
  resource_type: string | null;
  user_id: string | null;
  created_at: string;
};

export function RecentActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">Aktivitas Terbaru</h2>
        </div>
        <Link to="/admin/audit" className="text-[11px] font-medium text-primary hover:underline">
          Lihat semua
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md bg-surface px-3 py-8 text-center text-xs text-muted-foreground">
          Belum ada aktivitas.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 rounded-md bg-surface px-2.5 py-2 text-xs"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{r.action}</div>
                <div className="text-[10px] text-muted-foreground">
                  {r.resource_type ?? "system"} · {rel(r.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function rel(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}
