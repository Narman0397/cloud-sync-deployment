// Phase 1B — ASN Prefill Mapping service.
// Menyediakan daftar variabel sistem yang dapat dipakai sebagai default value
// dan kontrak mapping antara field form ke kolom profile ASN.
//
// Mapping tidak melakukan I/O; konsumen (runtime renderer / submission init)
// memanggil resolveProfilePrefill(profile, mapping) untuk memperoleh values.

export type PrefillSource =
  | "profile.nama_lengkap"
  | "profile.nip"
  | "profile.jabatan"
  | "profile.opd_id"
  | "profile.opd_nama"
  | "profile.unit_kerja"
  | "profile.employment_type"
  | "profile.golongan"
  | "profile.tmt"
  | "profile.status_kepegawaian"
  | "profile.no_hp"
  | "profile.email";

export interface PrefillMapping {
  /** kode field di form */
  field_kode: string;
  /** sumber data */
  source: PrefillSource;
  /** apakah field ini dikunci dari editing */
  readonly?: boolean;
  /** apakah field disembunyikan dari user (default value otomatis) */
  hidden?: boolean;
}

export const SYSTEM_VARIABLES = [
  "$current_user.id",
  "$current_user.nama_lengkap",
  "$current_user.nip",
  "$current_user.email",
  "$current_user.role",
  "$current_user.employment_type",
  "$current_user.opd_id",
  "$current_user.opd_nama",
  "$current_user.unit_kerja",
  "$current_user.jabatan",
  "$current_user.golongan",
  "$current_user.tmt",
  "$current_user.status_kepegawaian",
  "$now",
  "$today",
] as const;
export type SystemVariable = (typeof SYSTEM_VARIABLES)[number];

export interface ProfileSubset {
  id?: string | null;
  nama_lengkap?: string | null;
  nip?: string | null;
  jabatan?: string | null;
  opd_id?: string | null;
  opd_nama?: string | null;
  unit_kerja?: string | null;
  employment_type?: string | null;
  golongan?: string | null;
  tmt?: string | null;
  status_kepegawaian?: string | null;
  no_hp?: string | null;
  email?: string | null;
}

export function resolveProfilePrefill(
  profile: ProfileSubset,
  mappings: PrefillMapping[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of mappings) {
    const key = m.source.replace(/^profile\./, "") as keyof ProfileSubset;
    const value = profile[key];
    if (value != null) out[m.field_kode] = String(value);
  }
  return out;
}

export function resolveSystemVariable(
  variable: SystemVariable,
  ctx: { profile?: ProfileSubset | null; now?: Date | null } = {},
): string {
  const now = ctx.now ?? new Date();
  if (variable === "$now") return now.toISOString();
  if (variable === "$today") return now.toISOString().slice(0, 10);
  const profile = ctx.profile ?? {};
  const key = variable.replace(/^\$current_user\./, "") as keyof ProfileSubset;
  return String(profile[key] ?? "");
}
