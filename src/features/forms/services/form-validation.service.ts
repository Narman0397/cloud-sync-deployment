// Phase 1B — Validation service. Dipakai server-side & client-side.
// Sumber kebenaran satu schema: formFieldSchema dari schema/types.ts.
import { z } from "zod";
import {
  formFieldSchema,
  isPresentationalField,
  type FieldType,
  type FormField,
} from "@/features/forms/schema/types";

export const fieldsArraySchema = z
  .array(formFieldSchema)
  .max(200)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      // presentational fields tidak butuh kode unik
      if (isPresentationalField(f.tipe as FieldType)) continue;
      if (seen.has(f.kode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "kode"],
          message: `kode duplikat: ${f.kode}`,
        });
      }
      seen.add(f.kode);
    }
  });

export interface ValidateFieldsResult {
  ok: boolean;
  errors: Array<{ path: string; message: string }>;
}

export function validateFields(fields: unknown): ValidateFieldsResult {
  const parsed = fieldsArraySchema.safeParse(fields);
  if (parsed.success) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

/** Pastikan field memiliki struktur valid; lempar error berisi semua issue. */
export function assertValidFields(fields: unknown): FormField[] {
  const parsed = fieldsArraySchema.safeParse(fields);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Field tidak valid: ${msg}`);
  }
  return parsed.data;
}
