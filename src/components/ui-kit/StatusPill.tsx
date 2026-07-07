// Pill warna semantik untuk status TTE / form / dokumen.
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "muted";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground/80",
  info: "bg-primary-soft text-primary",
  warning: "bg-amber-100 text-amber-800",
  success: "bg-emerald-100 text-emerald-800",
  danger: "bg-red-100 text-red-800",
  muted: "bg-muted text-muted-foreground",
};

interface Props {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export function StatusPill({ tone = "neutral", children, className, icon }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

// Mapping helper untuk status TTE
export function signatureStatusTone(status: string): StatusTone {
  switch (status) {
    case "signed":
    case "completed":
      return "success";
    case "pending":
    case "sent":
      return "info";
    case "rejected":
    case "failed":
      return "danger";
    case "expired":
    case "cancelled":
      return "warning";
    case "draft":
      return "muted";
    default:
      return "neutral";
  }
}

const STATUS_LABEL_ID: Record<string, string> = {
  draft: "Draft",
  pending: "Menunggu kirim",
  sent: "Menunggu TTE",
  signed: "Tertandatangani",
  completed: "Selesai",
  rejected: "Ditolak",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  failed: "Gagal",
};

export function signatureStatusLabel(status: string): string {
  return STATUS_LABEL_ID[status] ?? status;
}