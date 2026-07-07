// Panel kesehatan sistem ringkas: 1 skor besar + 6 mikro-stat grid.
// Tidak lagi scroll horizontal. Semua label Bahasa Indonesia ramah-pengguna.
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  HardDrive,
  ListChecks,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tone = "ok" | "warn" | "crit" | "info";

interface Stat {
  label: string;
  value: string | number;
  tone: Tone;
  icon: LucideIcon;
  to: string;
  hint: string;
}

const toneText: Record<Tone, string> = {
  ok: "text-success",
  warn: "text-gold",
  crit: "text-destructive",
  info: "text-foreground",
};
const toneBg: Record<Tone, string> = {
  ok: "bg-success/10",
  warn: "bg-gold/15",
  crit: "bg-destructive/10",
  info: "bg-surface",
};

export function HealthBar({
  systemTone,
  systemScore,
  jobsPending,
  jobsFailed,
  jobsRunning,
  alertsCount,
  backupAgeHours,
  storageUsedMb,
  lastActivity,
}: {
  systemTone: Tone;
  systemScore: number | null;
  jobsPending: number;
  jobsFailed: number;
  jobsRunning: number;
  alertsCount: number;
  backupAgeHours: number | null;
  storageUsedMb: number | null;
  lastActivity: string | null;
}) {
  const scoreLabel =
    systemScore != null ? `${systemScore}` : systemTone === "ok" ? "OK" : "—";
  const scoreCaption =
    systemTone === "ok"
      ? "Sistem sehat"
      : systemTone === "warn"
        ? "Perlu perhatian"
        : systemTone === "crit"
          ? "Perlu tindakan"
          : "Menghitung…";
  const ScoreIcon =
    systemTone === "ok"
      ? CheckCircle2
      : systemTone === "crit"
        ? XCircle
        : ShieldAlert;

  const stats: Stat[] = [
    {
      label: "Peringatan",
      value: alertsCount,
      tone: alertsCount > 0 ? "crit" : "ok",
      icon: Bell,
      to: "/admin/monitoring/health",
      hint: "Notifikasi belum tertangani",
    },
    {
      label: "Pekerjaan Antri",
      value: jobsPending,
      tone: jobsPending > 50 ? "warn" : "info",
      icon: ListChecks,
      to: "/admin/monitoring/reliability",
      hint: `${jobsRunning} sedang berjalan`,
    },
    {
      label: "Pekerjaan Gagal",
      value: jobsFailed,
      tone: jobsFailed > 0 ? "crit" : "ok",
      icon: AlertTriangle,
      to: "/admin/monitoring/reliability",
      hint: "Gagal + macet (dead-letter)",
    },
    {
      label: "Cadangan Data",
      value: backupAgeHours != null ? `${backupAgeHours}j` : "—",
      tone:
        backupAgeHours == null
          ? "info"
          : backupAgeHours > 48
            ? "crit"
            : backupAgeHours > 26
              ? "warn"
              : "ok",
      icon: HardDrive,
      to: "/admin/monitoring/health",
      hint: "Sejak cadangan terakhir",
    },
    {
      label: "Penyimpanan",
      value: storageUsedMb != null ? formatMb(storageUsedMb) : "—",
      tone: "info",
      icon: HardDrive,
      to: "/admin/monitoring/health",
      hint: "Total terpakai",
    },
    {
      label: "Aktivitas",
      value: lastActivity ? relTime(lastActivity) : "—",
      tone: "info",
      icon: Activity,
      to: "/admin/audit",
      hint: "Log audit terbaru",
    },
  ];

  return (
    <section
      aria-label="Ringkasan kesehatan sistem"
      className="mb-6 grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft md:grid-cols-[minmax(220px,260px)_1fr] md:p-5"
    >
      {/* Score block kiri */}
      <Link
        to="/admin/monitoring/health"
        aria-label={`Skor kesehatan sistem ${scoreLabel}, ${scoreCaption}`}
        className={`group flex items-center gap-4 rounded-xl border border-border/60 px-4 py-3 transition hover:border-primary/40 ${toneBg[systemTone]}`}
      >
        <span
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-background ${toneText[systemTone]}`}
        >
          <ScoreIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Skor Sistem
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`font-display text-3xl font-bold ${toneText[systemTone]}`}>
              {scoreLabel}
            </span>
            {systemScore != null && (
              <span className="text-xs text-muted-foreground">/100</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{scoreCaption}</div>
        </div>
      </Link>

      {/* Mikro-stat grid kanan */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              title={s.hint}
              aria-label={`${s.label}: ${s.value}. ${s.hint}`}
              className="group flex h-full items-center gap-2.5 rounded-lg border border-border/60 bg-background px-2.5 py-2 transition hover:border-primary/40 hover:shadow-soft"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${toneBg[s.tone]} ${toneText[s.tone]}`}
              >
                <s.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className={`font-display text-sm font-bold ${toneText[s.tone]}`}>
                  {s.value}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}
