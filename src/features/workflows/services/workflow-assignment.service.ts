// Phase 2A — Assignment helpers (pra-runtime).
// Catatan: eksekusi (penentuan assignee aktual) baru di Phase 2B/3.
import type { NodeAssignment } from "../schema/types";

export const KNOWN_ROLES: ReadonlyArray<string> = [
  "super_admin",
  "admin_pemda",
  "admin_opd",
  "admin_desa",
  "pimpinan",
  "verifikator_bkpsdm",
  "kepala_opd",
  "kepala_bidang",
  "asn",
];

export function describeAssignment(a?: NodeAssignment | null): string {
  if (!a) return "(belum diatur)";
  switch (a.type) {
    case "specific_user":
      return `User: ${a.user_id ?? "?"}`;
    case "role":
      return `Role: ${a.role ?? "?"}${a.same_opd_as_applicant ? " (OPD pemohon)" : ""}`;
    case "opd":
      return a.same_opd_as_applicant ? "OPD pemohon" : `OPD: ${a.opd_id ?? "?"}`;
    case "department":
      return `Dept: ${a.department ?? "?"}`;
    case "current_user_manager":
      return "Atasan langsung pemohon";
  }
}
