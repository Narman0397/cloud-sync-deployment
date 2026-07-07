// Membangun zod schema RUNTIME dari snapshot form, untuk memvalidasi
// data submission terhadap kontrak form pada saat publish (bukan kontrak
// live yang bisa berubah). Mendukung visible_if: field yang tersembunyi
// dianggap tidak wajib divalidasi.
//
// Phase 1C: tambahan validasi tipe baru (time, datetime, rating, address,
// nip, nik), named regex preset, cross-field compare, dan unique-per-array.
import { z, type ZodTypeAny } from "zod";
import {
  isFieldVisible,
  REGEX_PRESETS,
  isPresentationalField,
  type FormField,
  type FormSchemaSnapshot,
} from "./types";

function effectivePattern(f: FormField): string | undefined {
  if (f.validation.preset) return REGEX_PRESETS[f.validation.preset].pattern;
  return f.validation.pattern;
}

function fieldValidator(f: FormField): ZodTypeAny {
  switch (f.tipe) {
    case "short_text":
    case "long_text":
    case "email":
    case "phone":
    case "nip":
    case "nik":
    case "address": {
      let s = z.string().trim();
      if (f.validation.maxLength) s = s.max(f.validation.maxLength);
      if (f.validation.minLength) s = s.min(f.validation.minLength);
      const p = effectivePattern(f);
      if (p) s = s.regex(new RegExp(p), `${f.label} tidak sesuai format`);
      // Built-in untuk tipe dengan format default
      if (f.tipe === "email" && !p)
        s = s.regex(new RegExp(REGEX_PRESETS.email.pattern), `${f.label} tidak valid`);
      if (f.tipe === "phone" && !p)
        s = s.regex(new RegExp(REGEX_PRESETS.phone_id.pattern), `${f.label} tidak valid`);
      if (f.tipe === "nip" && !p)
        s = s.regex(new RegExp(REGEX_PRESETS.nip.pattern), `${f.label} harus 18 digit`);
      if (f.tipe === "nik" && !p)
        s = s.regex(new RegExp(REGEX_PRESETS.nik.pattern), `${f.label} harus 16 digit`);
      return f.required ? s.min(1, `${f.label} wajib diisi`) : s.optional().or(z.literal(""));
    }
    case "number":
    case "currency":
    case "rating": {
      let n = z.coerce.number();
      const min = f.tipe === "rating" ? 0 : f.validation.min;
      const max = f.tipe === "rating" ? (f.validation.ratingMax ?? 5) : f.validation.max;
      if (typeof min === "number") n = n.min(min);
      if (typeof max === "number") n = n.max(max);
      return f.required ? n : n.optional();
    }
    case "date":
    case "datetime": {
      const re = f.tipe === "date" ? /^\d{4}-\d{2}-\d{2}/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
      const d = z
        .string()
        .regex(re, "format tanggal tidak valid")
        .or(z.literal(""));
      return f.required ? d.refine((v) => v.length > 0, `${f.label} wajib diisi`) : d.optional();
    }
    case "time": {
      const d = z.string().regex(/^\d{2}:\d{2}/, "format jam tidak valid").or(z.literal(""));
      return f.required ? d.refine((v) => v.length > 0, `${f.label} wajib diisi`) : d.optional();
    }
    case "date_range": {
      const r = z
        .object({
          start: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
          end: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
        })
        .refine((v) => !v.start || !v.end || v.start <= v.end, "tanggal akhir < tanggal mulai");
      return f.required
        ? r.refine((v) => !!v.start && !!v.end, `${f.label} wajib diisi`)
        : r.optional();
    }
    case "dropdown":
    case "radio": {
      const allowed = f.options.map((o) => o.value);
      const e = allowed.length ? z.enum(allowed as [string, ...string[]]) : z.string();
      return f.required ? e : e.optional().or(z.literal(""));
    }
    case "checkbox":
    case "multi_select": {
      const allowed = f.options.map((o) => o.value);
      const base: ZodTypeAny = z
        .array(z.string())
        .refine((vs) => vs.every((v) => allowed.includes(v)), "pilihan tidak valid")
        .refine(
          (vs) => !f.validation.unique || new Set(vs).size === vs.length,
          "tidak boleh ada duplikat",
        );
      return f.required
        ? z.array(z.string()).min(1, `${f.label} wajib diisi`).and(base)
        : base.optional();
    }
    case "signature": {
      const s = z.string().optional().or(z.literal(""));
      return f.required ? z.string().min(1, `${f.label} wajib ditandatangani`) : s;
    }
    case "file_upload": {
      const s = z.string().optional().or(z.literal(""));
      return f.required ? z.string().min(1, `${f.label} wajib diunggah`) : s;
    }
    case "multi_file_upload": {
      const max = f.validation.maxFiles ?? 20;
      const base: ZodTypeAny = z
        .array(z.string())
        .max(max)
        .refine(
          (vs) => !f.validation.unique || new Set(vs).size === vs.length,
          "tidak boleh ada duplikat",
        );
      return f.required
        ? z.array(z.string()).min(1, `${f.label} wajib diunggah`).and(base)
        : base.optional();
    }
    default:
      return z.any();
  }
}

function compareValues(
  a: unknown,
  b: unknown,
  op: "gt" | "gte" | "lt" | "lte" | "eq" | "neq",
): boolean {
  if (a == null || b == null || a === "" || b === "") return true; // skip jika salah satu kosong
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) {
    switch (op) {
      case "gt":
        return na > nb;
      case "gte":
        return na >= nb;
      case "lt":
        return na < nb;
      case "lte":
        return na <= nb;
      case "eq":
        return na === nb;
      case "neq":
        return na !== nb;
    }
  }
  const sa = String(a);
  const sb = String(b);
  switch (op) {
    case "gt":
      return sa > sb;
    case "gte":
      return sa >= sb;
    case "lt":
      return sa < sb;
    case "lte":
      return sa <= sb;
    case "eq":
      return sa === sb;
    case "neq":
      return sa !== sb;
  }
}

export function buildSubmissionValidator(snapshot: FormSchemaSnapshot) {
  return z
    .object({})
    .passthrough()
    .superRefine((raw, ctx) => {
      const values = raw as Record<string, unknown>;
      for (const f of snapshot.fields) {
        if (isPresentationalField(f.tipe)) continue;
        if (!isFieldVisible(f, values)) continue;
        const result = fieldValidator(f).safeParse(values[f.kode]);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [f.kode, ...(issue.path as (string | number)[])],
              message: issue.message,
            });
          }
        }
        // Cross-field compare
        const cmp = f.validation.compare;
        if (cmp && cmp.field) {
          const ok = compareValues(values[f.kode], values[cmp.field], cmp.op);
          if (!ok) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [f.kode],
              message:
                cmp.message ?? `${f.label} harus ${cmp.op.toUpperCase()} dari ${cmp.field}`,
            });
          }
        }
      }
    });
}
