import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

type TargetRow = { form_id?: string; target_type: string; target_value: string | null };
type TargetUser = { user_id: string; opd_id: string | null };
type ProfileRow = {
  id: string;
  opd_id: string | null;
  asn_type: string | null;
  system_position: string | null;
};
type FormRow = {
  id: string;
  opd_pemilik_id: string | null;
  deadline: string | null;
  judul: string;
};

function matchesTarget(
  target: TargetRow,
  userId: string,
  profile: ProfileRow,
  roles: Set<string>,
): boolean {
  const value = target.target_value;
  if (!value) return false;
  if (target.target_type === "individu") return value === userId;
  if (target.target_type === "role") return roles.has(value);
  if (target.target_type === "opd") return !!profile.opd_id && value === profile.opd_id;
  if (target.target_type === "asn_type") return !!profile.asn_type && value === profile.asn_type;
  if (target.target_type === "position") {
    return !!profile.system_position && value === profile.system_position;
  }
  return false;
}

function isEligibleForForm(
  form: FormRow,
  targets: TargetRow[],
  userId: string,
  profile: ProfileRow,
  roles: Set<string>,
): boolean {
  if (targets.length > 0) {
    return targets.some((target) => matchesTarget(target, userId, profile, roles));
  }

  if (form.opd_pemilik_id) return profile.opd_id === form.opd_pemilik_id;

  // Superadmin can publish a cross-OPD form without an owner OPD. In that case,
  // make the default audience ASN so the form still appears in Tugas Saya.
  return roles.has("asn");
}

/** Resolve every user that matches a form's configured targets. */
export async function resolveTargetUserIds(
  supabaseAdmin: SB,
  formId: string,
  formOpdId: string | null,
): Promise<TargetUser[]> {
  const sb = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
  const { data: targets } = await sb
    .from("form_targets")
    .select("target_type,target_value")
    .eq("form_id", formId);
  const rows = ((targets ?? []) as TargetRow[]).filter((target) => !!target.target_value);
  const out = new Map<string, TargetUser>();

  const userIds = rows.filter((x) => x.target_type === "individu").map((x) => x.target_value!);
  if (userIds.length) {
    const { data } = await sb.from("profiles").select("id,opd_id").in("id", userIds);
    for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
  }

  const roles = rows.filter((x) => x.target_type === "role").map((x) => x.target_value!);
  if (roles.length) {
    const { data: roleUsers } = await sb.from("user_roles").select("user_id").in("role", roles);
    const ids = [...new Set((roleUsers ?? []).map((r: { user_id: string }) => r.user_id))];
    if (ids.length) {
      const { data } = await sb.from("profiles").select("id,opd_id").in("id", ids);
      for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
    }
  }

  const opds = rows.filter((x) => x.target_type === "opd").map((x) => x.target_value!);
  if (opds.length) {
    const { data } = await sb.from("profiles").select("id,opd_id").in("opd_id", opds);
    for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
  }

  const asnTypes = rows.filter((x) => x.target_type === "asn_type").map((x) => x.target_value!);
  if (asnTypes.length) {
    const { data } = await sb.from("profiles").select("id,opd_id").in("asn_type", asnTypes);
    for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
  }

  const positions = rows.filter((x) => x.target_type === "position").map((x) => x.target_value!);
  if (positions.length) {
    const { data } = await sb.from("profiles").select("id,opd_id").in("system_position", positions);
    for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
  }

  if (out.size === 0 && rows.length === 0 && formOpdId) {
    const { data } = await sb.from("profiles").select("id,opd_id").eq("opd_id", formOpdId);
    for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
  }

  if (out.size === 0 && rows.length === 0 && !formOpdId) {
    const { data: roleUsers } = await sb.from("user_roles").select("user_id").eq("role", "asn");
    const ids = [...new Set((roleUsers ?? []).map((r: { user_id: string }) => r.user_id))];
    if (ids.length) {
      const { data } = await sb.from("profiles").select("id,opd_id").in("id", ids);
      for (const p of data ?? []) out.set(p.id, { user_id: p.id, opd_id: p.opd_id });
    }
  }

  return [...out.values()];
}

/**
 * Repair-on-read: when a user opens Tugas Saya, create any assignment that
 * should exist for already-published forms but was missed during publish.
 */
export async function ensureAssignmentsForUser(supabaseAdmin: SB, userId: string): Promise<number> {
  const sb = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
  const [{ data: profile }, { data: roleRows }, { data: forms }] = await Promise.all([
    sb.from("profiles").select("id,opd_id,asn_type,system_position").eq("id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb
      .from("forms")
      .select("id,opd_pemilik_id,deadline,judul")
      .eq("status", "published")
      .is("deleted_at", null),
  ]);

  if (!profile || !forms?.length) return 0;

  const formRows = forms as FormRow[];
  const formIds = formRows.map((form) => form.id);
  const { data: targets } = await sb
    .from("form_targets")
    .select("form_id,target_type,target_value")
    .in("form_id", formIds);
  const targetsByForm = new Map<string, TargetRow[]>();
  for (const target of (targets ?? []) as TargetRow[]) {
    if (!target.form_id) continue;
    const current = targetsByForm.get(target.form_id) ?? [];
    current.push(target);
    targetsByForm.set(target.form_id, current);
  }

  const roles = new Set(((roleRows ?? []) as Array<{ role: string }>).map((row) => row.role));
  const eligibleForms = formRows.filter((form) =>
    isEligibleForForm(form, targetsByForm.get(form.id) ?? [], userId, profile as ProfileRow, roles),
  );
  if (eligibleForms.length === 0) return 0;

  const eligibleIds = eligibleForms.map((form) => form.id);
  const { data: existing } = await sb
    .from("form_assignments")
    .select("form_id")
    .eq("user_id", userId)
    .in("form_id", eligibleIds);
  const existingIds = new Set(((existing ?? []) as Array<{ form_id: string }>).map((row) => row.form_id));
  const missingForms = eligibleForms.filter((form) => !existingIds.has(form.id));
  if (missingForms.length === 0) return 0;

  const { error } = await sb.from("form_assignments").insert(
    missingForms.map((form) => ({
      form_id: form.id,
      user_id: userId,
      opd_id: (profile as ProfileRow).opd_id,
      status: "assigned",
      due_at: form.deadline ?? null,
    })),
  );
  if (error) throw new Error(error.message);
  return missingForms.length;
}