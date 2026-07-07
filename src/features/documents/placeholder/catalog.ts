// Phase 3A — Placeholder catalog for picker UI.
export interface PlaceholderItem {
  token: string;
  label: string;
  example?: string;
}
export interface PlaceholderGroup {
  category: "submission" | "profile" | "workflow" | "system" | "document";
  label: string;
  items: PlaceholderItem[];
}

export const PLACEHOLDER_CATALOG: PlaceholderGroup[] = [
  {
    category: "submission",
    label: "Field Submission",
    items: [
      { token: "submission.nama", label: "Nama Pemohon" },
      { token: "submission.nip", label: "NIP" },
      { token: "submission.opd", label: "OPD" },
      { token: "submission.jabatan", label: "Jabatan" },
      { token: "submission.id", label: "ID Submission" },
      { token: "submission.created_at", label: "Tanggal Pengajuan" },
    ],
  },
  {
    category: "profile",
    label: "Field Profil",
    items: [
      { token: "profile.full_name", label: "Nama Lengkap" },
      { token: "profile.nip", label: "NIP" },
      { token: "profile.email", label: "Email" },
      { token: "profile.opd_name", label: "OPD" },
    ],
  },
  {
    category: "workflow",
    label: "Workflow",
    items: [
      { token: "workflow.current_step", label: "Tahap Saat Ini" },
      { token: "workflow.approved_by", label: "Disetujui Oleh" },
      { token: "workflow.completed_at", label: "Tanggal Selesai" },
      { token: "workflow.version", label: "Versi Workflow" },
    ],
  },
  {
    category: "document",
    label: "Dokumen",
    items: [
      { token: "document.nomor_surat", label: "Nomor Surat" },
      { token: "document.template_version", label: "Versi Template" },
      { token: "document.generated_at", label: "Tanggal Generate" },
    ],
  },
  {
    category: "system",
    label: "Sistem",
    items: [
      { token: "system.tanggal", label: "Tanggal Hari Ini" },
      { token: "system.tahun", label: "Tahun" },
      { token: "system.app_name", label: "Nama Aplikasi" },
    ],
  },
];
