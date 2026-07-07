// Zona B — Antrian kerja, dipisah jadi 2 grup: "Perlu Anda Tindak" & "Perlu Perhatian".
import { Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardCheck, FileSignature, ListChecks, ScanLine, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type WorkItem = {
  label: string;
  count: number;
  to: string;
  desc: string;
  icon: LucideIcon;
  urgent?: boolean;
};

interface Props {
  pendingApproval: number;
  pendingVerifikasi: number;
  pendingReview: number;
  pendingSignature: number;
  overdueTasks: number;
}

export function WorkQueueCards(p: Props) {
  const action: WorkItem[] = [
    {
      label: "Persetujuan Akun",
      count: p.pendingApproval,
      to: "/admin/approvals",
      desc: "Pengguna menunggu persetujuan",
      icon: ClipboardCheck,
    },
    {
      label: "Verifikasi Akun",
      count: p.pendingVerifikasi,
      to: "/admin/verifikasi",
      desc: "Warga/ASN belum diverifikasi",
      icon: ScanLine,
    },
    {
      label: "Review Pengisian Form",
      count: p.pendingReview,
      to: "/admin/submission-review",
      desc: "Menunggu peninjauan",
      icon: ListChecks,
    },
    {
      label: "Tanda Tangan",
      count: p.pendingSignature,
      to: "/admin/document-center/signature/queue",
      desc: "Dokumen menunggu TTE",
      icon: FileSignature,
    },
  ];
  const attention: WorkItem[] = [
    {
      label: "Lewat Tenggat",
      count: p.overdueTasks,
      to: "/admin/monitoring/tasks",
      desc: "Workflow lewat tenggat / dieskalasi",
      icon: Timer,
      urgent: p.overdueTasks > 0,
    },
  ];

  const totalAction = action.reduce((s, i) => s + i.count, 0);
  const totalAttn = attention.reduce((s, i) => s + i.count, 0);

  return (
    <section aria-labelledby="work-queue-title" className="mb-6 space-y-5">
      <div>
        <h2 id="work-queue-title" className="font-display text-base font-bold text-foreground">
          Antrian Hari Ini
        </h2>
        <p className="text-xs text-muted-foreground">
          {totalAction + totalAttn === 0
            ? "Tidak ada antrian. Sistem bersih 🎉"
            : `${totalAction + totalAttn} item menunggu — klik kartu untuk membuka.`}
        </p>
      </div>

      <Group title="Perlu Anda Tindak" items={action} />
      {totalAttn > 0 && <Group title="Perlu Perhatian" items={attention} accent="warn" />}
    </section>
  );
}

function Group({
  title,
  items,
  accent,
}: {
  title: string;
  items: WorkItem[];
  accent?: "warn";
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            accent === "warn" ? "bg-destructive" : "bg-primary"
          }`}
        />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <Card key={it.label} item={it} />
        ))}
      </div>
    </div>
  );
}

function Card({ item: it }: { item: WorkItem }) {
  const hot = it.count > 0;
  const urgent = it.urgent && it.count > 0;
  return (
    <Link
      to={it.to}
      aria-label={`${it.label}: ${it.count} item. ${it.desc}`}
      className={`group flex flex-col gap-2 rounded-xl border p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated ${
        urgent
          ? "border-destructive/50 bg-destructive/5"
          : hot
            ? "border-primary/40 bg-primary-soft"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid h-8 w-8 place-items-center rounded-md ${
            urgent
              ? "bg-destructive/15 text-destructive"
              : hot
                ? "bg-primary/15 text-primary"
                : "bg-surface text-muted-foreground"
          }`}
        >
          <it.icon className="h-4 w-4" />
        </span>
        <span
          className={`font-display text-2xl font-bold ${
            urgent ? "text-destructive" : hot ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {it.count}
        </span>
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{it.label}</div>
        <div className="text-[11px] text-muted-foreground">{it.desc}</div>
      </div>
      <div className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
        Buka <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
