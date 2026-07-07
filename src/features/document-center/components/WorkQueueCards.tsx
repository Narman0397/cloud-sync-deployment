// Work Queue Cards — dashboard task-oriented untuk Document Center.
// Menampilkan kategori pekerjaan yang menunggu user + link langsung.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { dcInbox } from "@/lib/document-center.functions";
import { Eye, PenLine, RotateCcw, AlertTriangle, Clock, ShieldAlert, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CardDef = {
  label: string;
  key: keyof Awaited<ReturnType<typeof dcInbox>>;
  icon: LucideIcon;
  to: string;
  tone: string;
};

const CARDS: CardDef[] = [
  { label: "Menunggu review saya",   key: "pendingReview",    icon: Eye,         to: "/admin/document-center/inbox", tone: "bg-blue-50 text-blue-900 border-blue-200" },
  { label: "Menunggu tanda tangan",   key: "pendingSignature", icon: PenLine,     to: "/admin/document-center/signature/queue", tone: "bg-indigo-50 text-indigo-900 border-indigo-200" },
  { label: "Perlu revisi",            key: "needsRevision",    icon: RotateCcw,   to: "/admin/document-center/documents?statuses=perlu_revisi", tone: "bg-amber-50 text-amber-900 border-amber-200" },
  { label: "Dokumen gagal",           key: "failed",           icon: AlertTriangle, to: "/admin/document-center/documents?statuses=gagal", tone: "bg-red-50 text-red-900 border-red-200" },
  { label: "Melewati SLA",            key: "overdueSla",       icon: Clock,       to: "/admin/document-center/inbox?sla=overdue", tone: "bg-orange-50 text-orange-900 border-orange-200" },
  { label: "Sertifikat kedaluwarsa",  key: "expiringCerts",    icon: ShieldAlert, to: "/admin/document-center/signature/monitoring", tone: "bg-purple-50 text-purple-900 border-purple-200" },
];

export function WorkQueueCards() {
  const fn = useServerFn(dcInbox);
  const q = useQuery({ queryKey: ["dc", "inbox"], queryFn: () => fn(), refetchInterval: 60_000 });
  const data = q.data;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS.map((c) => {
        const value = data?.[c.key] ?? 0;
        const Icon = c.icon;
        return (
          <Link
            key={c.key}
            to={c.to}
            className={`group rounded-xl border p-4 shadow-soft transition hover:shadow-elevated ${c.tone}`}
          >
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/70">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </div>
            <div className="mt-3 text-3xl font-bold tabular-nums">
              {q.isLoading ? "…" : value.toLocaleString("id-ID")}
            </div>
            <div className="text-sm font-medium">{c.label}</div>
          </Link>
        );
      })}
    </div>
  );
}
