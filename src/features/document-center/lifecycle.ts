// Document Center — sumber tunggal kebenaran (SSoT) untuk display status
// dokumen di seluruh siklus hidup: draft → review → approval → signature
// → distribution → archive. Setiap status heterogen di DB dipetakan ke
// salah satu dari 9 display status seragam.
import type { LucideIcon } from "lucide-react";
import {
  FileEdit,
  Eye,
  RotateCcw,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Archive,
} from "lucide-react";

export type LifecycleStatus =
  | "draft"
  | "menunggu_review"
  | "perlu_revisi"
  | "disetujui"
  | "menunggu_ttd"
  | "sedang_ttd"
  | "ttd_berhasil"
  | "gagal"
  | "diarsipkan";

export type LifecycleStage =
  | "draft"
  | "review"
  | "approval"
  | "signature"
  | "distribution"
  | "archive";

export interface LifecycleMeta {
  label: string;
  short: string;
  stage: LifecycleStage;
  icon: LucideIcon;
  tone: "muted" | "info" | "warning" | "success" | "danger" | "primary";
}

export const LIFECYCLE: Record<LifecycleStatus, LifecycleMeta> = {
  draft:            { label: "Draft",                    short: "Draft",     stage: "draft",        icon: FileEdit,     tone: "muted"   },
  menunggu_review:  { label: "Menunggu Review",          short: "Review",    stage: "review",       icon: Eye,          tone: "info"    },
  perlu_revisi:     { label: "Perlu Revisi",             short: "Revisi",    stage: "review",       icon: RotateCcw,    tone: "warning" },
  disetujui:        { label: "Disetujui",                short: "Setuju",    stage: "approval",     icon: CheckCircle2, tone: "success" },
  menunggu_ttd:     { label: "Menunggu Tanda Tangan",    short: "Menunggu TTD", stage: "signature", icon: Clock,        tone: "info"    },
  sedang_ttd:       { label: "Sedang Ditandatangani",    short: "Proses TTD",stage: "signature",    icon: Loader2,      tone: "primary" },
  ttd_berhasil:     { label: "Berhasil Ditandatangani",  short: "Selesai",   stage: "distribution", icon: ShieldCheck,  tone: "success" },
  gagal:            { label: "Gagal",                    short: "Gagal",     stage: "signature",    icon: AlertTriangle,tone: "danger"  },
  diarsipkan:       { label: "Diarsipkan",               short: "Arsip",     stage: "archive",      icon: Archive,      tone: "muted"   },
};

export const STAGES: { key: LifecycleStage; label: string; statuses: LifecycleStatus[] }[] = [
  { key: "draft",        label: "Draft",        statuses: ["draft"] },
  { key: "review",       label: "Review",       statuses: ["menunggu_review", "perlu_revisi"] },
  { key: "approval",     label: "Approval",     statuses: ["disetujui"] },
  { key: "signature",    label: "Tanda Tangan", statuses: ["menunggu_ttd", "sedang_ttd", "gagal"] },
  { key: "distribution", label: "Distribusi",   statuses: ["ttd_berhasil"] },
  { key: "archive",      label: "Arsip",        statuses: ["diarsipkan"] },
];

/** Map status DB heterogen (generated_documents / signature_requests) → LifecycleStatus. */
export function mapDocStatus(
  docStatus: string | null | undefined,
  archivedAt?: string | null,
  sigStatus?: string | null,
): LifecycleStatus {
  if (archivedAt) return "diarsipkan";
  if (sigStatus) {
    if (sigStatus === "signed" || sigStatus === "completed") return "ttd_berhasil";
    if (sigStatus === "failed" || sigStatus === "rejected") return "gagal";
    if (sigStatus === "sent" || sigStatus === "in_progress") return "sedang_ttd";
    if (sigStatus === "pending") return "menunggu_ttd";
    if (sigStatus === "expired") return "gagal";
  }
  switch (docStatus) {
    case "draft":
    case "generated":
      return "draft";
    case "under_review":
    case "menunggu_review":
      return "menunggu_review";
    case "revision_required":
    case "perlu_revisi":
      return "perlu_revisi";
    case "approved":
    case "disetujui":
      return "disetujui";
    case "awaiting_signature":
    case "menunggu_ttd":
      return "menunggu_ttd";
    case "signing":
    case "sedang_ttd":
      return "sedang_ttd";
    case "signed":
    case "ttd_berhasil":
    case "completed":
      return "ttd_berhasil";
    case "failed":
    case "gagal":
    case "rejected":
      return "gagal";
    case "archived":
    case "diarsipkan":
      return "diarsipkan";
    default:
      return "draft";
  }
}

export const ALL_STATUSES: LifecycleStatus[] = Object.keys(LIFECYCLE) as LifecycleStatus[];
