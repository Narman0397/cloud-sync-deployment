// Phase 2B — Assignment Engine.
// Resolusi assignee aktual dari NodeAssignment (snapshot) + konteks pemohon.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { NodeAssignment } from "../schema/types";

type SB = SupabaseClient<Database>;

export interface ApplicantContext {
  user_id: string;
  opd_id: string | null;
}

export interface ResolveResult {
  assignees: string[];
  reason: string;
}

/**
 * Resolve daftar user_id yang harus menerima task untuk node tertentu.
 * Mengembalikan array (kosong jika tidak ditemukan → caller harus masuk ke exception queue).
 */
export async function resolveAssignees(
  supabase: SB,
  assignment: NodeAssignment | undefined | null,
  applicant: ApplicantContext,
): Promise<ResolveResult> {
  if (!assignment) {
    return { assignees: [applicant.user_id], reason: "fallback_applicant" };
  }
  switch (assignment.type) {
    case "specific_user": {
      if (!assignment.user_id) return { assignees: [], reason: "missing_user_id" };
      return { assignees: [assignment.user_id], reason: "specific_user" };
    }
    case "role": {
      if (!assignment.role) return { assignees: [], reason: "missing_role" };
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", assignment.role as never);
      let users = (roles ?? []).map((r) => r.user_id as string);
      if (assignment.same_opd_as_applicant && applicant.opd_id) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id")
          .in("id", users.length > 0 ? users : ["00000000-0000-0000-0000-000000000000"])
          .eq("opd_id", applicant.opd_id);
        users = (profs ?? []).map((p) => p.id as string);
      }
      // verified only
      if (users.length > 0) {
        const { data: verified } = await supabase
          .from("profiles")
          .select("id")
          .in("id", users)
          .eq("verification_status", "verified");
        users = (verified ?? []).map((p) => p.id as string);
      }
      return { assignees: users, reason: "role" };
    }
    case "opd": {
      const opdId = assignment.same_opd_as_applicant ? applicant.opd_id : (assignment.opd_id ?? null);
      if (!opdId) return { assignees: [], reason: "missing_opd" };
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin_opd" as never);
      const ids = (admins ?? []).map((r) => r.user_id as string);
      if (ids.length === 0) return { assignees: [], reason: "no_opd_admin" };
      const { data: profs } = await supabase
        .from("profiles")
        .select("id")
        .in("id", ids)
        .eq("opd_id", opdId)
        .eq("verification_status", "verified");
      return {
        assignees: (profs ?? []).map((p) => p.id as string),
        reason: "opd",
      };
    }
    case "department": {
      // Department: cari user pada master_jabatan/department field di profiles bila ada.
      // Fallback: kosong → exception queue.
      if (!assignment.department) return { assignees: [], reason: "missing_department" };
      const { data } = await supabase
        .from("profiles")
        .select("id, jabatan")
        .ilike("jabatan", `%${assignment.department}%`)
        .eq("verification_status", "verified");
      return {
        assignees: (data ?? []).map((p) => p.id as string),
        reason: "department",
      };
    }
    case "current_user_manager": {
      // Cari kepala_opd: user dengan role kepala_opd & OPD sama dengan pemohon.
      if (!applicant.opd_id) return { assignees: [], reason: "missing_applicant_opd" };
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "kepala_opd" as never);
      const candidateIds = (roles ?? []).map((r) => r.user_id as string);
      if (candidateIds.length === 0) return { assignees: [], reason: "no_manager" };
      const { data: profs } = await supabase
        .from("profiles")
        .select("id")
        .in("id", candidateIds)
        .eq("opd_id", applicant.opd_id)
        .eq("verification_status", "verified");
      return { assignees: (profs ?? []).map((p) => p.id as string), reason: "manager" };
    }
  }
}
