// Schema kontrak form runtime — sumber kebenaran untuk builder, renderer,
// validator, dan snapshot pada saat publish.
//
// Phase 1B catatan: enum FIELD_TYPES diperluas (additive). Tipe lama tetap
// berperilaku sama; tipe baru hanya dipakai oleh Form Builder UI baru.
// Phase 1C tambahan: tipe time, datetime, rating, address, nip, nik dan
// validasi lanjutan (named regex preset, cross-field compare, unique).
import { z } from "zod";

export const FIELD_TYPES = [
  // legacy / runtime existing
  "short_text",
  "long_text",
  "dropdown",
  "checkbox",
  "radio",
  "number",
  "date",
  "file_upload",
  "multi_file_upload",
  // Phase 1B additions (builder enterprise)
  "currency",
  "email",
  "phone",
  "date_range",
  "multi_select",
  "signature",
  "heading",
  "section",
  "divider",
  // Phase 1C additions (domain pemerintahan)
  "time",
  "datetime",
  "rating",
  "address",
  "nip",
  "nik",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Tipe presentational yang tidak menyimpan value pada submission. */
export const PRESENTATIONAL_FIELD_TYPES: ReadonlyArray<FieldType> = [
  "heading",
  "section",
  "divider",
];
export function isPresentationalField(t: FieldType): boolean {
  return PRESENTATIONAL_FIELD_TYPES.includes(t);
}

export const fieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

// Named regex preset — kunci pendek dipakai di builder; pola di-resolve oleh
// REGEX_PRESETS sehingga snapshot tetap pendek dan konsisten.
export const REGEX_PRESETS = {
  nip: { label: "NIP (18 digit)", pattern: "^[0-9]{18}$" },
  nik: { label: "NIK (16 digit)", pattern: "^[0-9]{16}$" },
  npwp: { label: "NPWP (15/16 digit)", pattern: "^[0-9]{15,16}$" },
  phone_id: { label: "Telepon ID", pattern: "^(\\+62|0)[0-9]{8,13}$" },
  email: { label: "Email", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
  numeric: { label: "Hanya angka", pattern: "^[0-9]+$" },
  alphanumeric: { label: "Huruf & angka", pattern: "^[A-Za-z0-9]+$" },
} as const;
export type RegexPresetKey = keyof typeof REGEX_PRESETS;
export const REGEX_PRESET_KEYS = Object.keys(REGEX_PRESETS) as RegexPresetKey[];

export const crossFieldRuleSchema = z
  .object({
    field: z.string().min(1).max(60),
    op: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
    message: z.string().max(200).optional(),
  })
  .nullable();
export type CrossFieldRule = z.infer<typeof crossFieldRuleSchema>;

export const fieldValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().max(20000).optional(),
    pattern: z.string().max(500).optional(),
    accept: z.array(z.string().max(80)).max(20).optional(),
    maxSizeMb: z.number().positive().max(50).optional(),
    maxFiles: z.number().int().positive().max(20).optional(),
    // Phase 1C
    preset: z.enum(REGEX_PRESET_KEYS as [RegexPresetKey, ...RegexPresetKey[]]).optional(),
    unique: z.boolean().optional(),
    compare: crossFieldRuleSchema.optional(),
    ratingMax: z.number().int().min(2).max(10).optional(),
  })
  .partial();
export type FieldValidation = z.infer<typeof fieldValidationSchema>;

export const visibleIfSchema = z
  .object({
    field: z.string().min(1).max(60),
    op: z.enum([
      "eq",
      "neq",
      "in",
      "not_in",
      "filled",
      "empty",
      "gt",
      "gte",
      "lt",
      "lte",
      "contains",
      "not_contains",
    ]),
    value: z.union([z.string().max(200), z.array(z.string().max(200)).max(50)]).optional(),
  })
  .nullable()
  .optional();
export type VisibleIfRule = z.infer<typeof visibleIfSchema>;

export const formFieldSchema = z.object({
  kode: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "kode hanya huruf kecil, angka, underscore"),
  label: z.string().trim().min(1).max(200),
  tipe: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional().nullable(),
  help_text: z.string().max(500).optional().nullable(),
  options: z.array(fieldOptionSchema).max(50).default([]),
  validation: fieldValidationSchema.default({}),
  visible_if: visibleIfSchema,
  urutan: z.number().int().nonnegative().default(0),
});
export type FormField = z.infer<typeof formFieldSchema>;

/** Evaluasi kondisi visible_if terhadap nilai form saat ini. */
export function isFieldVisible(field: FormField, values: Record<string, unknown>): boolean {
  const rule = field.visible_if;
  if (!rule) return true;
  const v = values[rule.field];
  const asStr = v == null ? "" : Array.isArray(v) ? v.map(String) : String(v);
  const rhsStr = String(rule.value ?? "");
  const rhsList = Array.isArray(rule.value) ? rule.value : rule.value ? [rule.value] : [];
  switch (rule.op) {
    case "filled":
      return Array.isArray(asStr) ? asStr.length > 0 : asStr !== "";
    case "empty":
      return Array.isArray(asStr) ? asStr.length === 0 : asStr === "";
    case "eq":
      return Array.isArray(asStr) ? asStr.includes(rhsStr) : asStr === rhsStr;
    case "neq":
      return Array.isArray(asStr) ? !asStr.includes(rhsStr) : asStr !== rhsStr;
    case "in":
      return Array.isArray(asStr)
        ? asStr.some((x) => rhsList.includes(x))
        : rhsList.includes(asStr);
    case "not_in":
      return Array.isArray(asStr)
        ? !asStr.some((x) => rhsList.includes(x))
        : !rhsList.includes(asStr);
    case "contains":
      return Array.isArray(asStr) ? asStr.some((x) => x.includes(rhsStr)) : asStr.includes(rhsStr);
    case "not_contains":
      return Array.isArray(asStr)
        ? !asStr.some((x) => x.includes(rhsStr))
        : !asStr.includes(rhsStr);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = Number(Array.isArray(asStr) ? asStr[0] : asStr);
      const b = Number(rhsStr);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (rule.op === "gt") return a > b;
      if (rule.op === "gte") return a >= b;
      if (rule.op === "lt") return a < b;
      return a <= b;
    }
    default:
      return true;
  }
}

export const formSchemaSnapshotSchema = z.object({
  version: z.literal(1),
  fields: z.array(formFieldSchema).min(1).max(100),
  publishedAt: z.string().datetime().optional(),
});
export type FormSchemaSnapshot = z.infer<typeof formSchemaSnapshotSchema>;

export function emptySnapshot(): FormSchemaSnapshot {
  return { version: 1, fields: [] as unknown as FormSchemaSnapshot["fields"] };
}
