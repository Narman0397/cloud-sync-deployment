import type { FormField } from "@/features/forms/schema/types";

export type Target = {
  target_type: "opd" | "asn_type" | "role" | "position" | "unit_kerja" | "individu";
  target_value: string;
};

export type FormMeta = {
  judul: string;
  deskripsi: string;
  deadline: string;
  allow_multiple_submit: boolean;
  status: string;
};

export function emptyField(idx: number): FormField {
  return {
    kode: `field_${idx + 1}`,
    label: `Field ${idx + 1}`,
    tipe: "short_text",
    required: false,
    placeholder: null,
    help_text: null,
    options: [],
    validation: {},
    visible_if: null,
    urutan: idx,
  };
}

/** Klon field dengan kode unik (suffix _copy / _copyN). */
export function duplicateField(src: FormField, existing: FormField[], urutan: number): FormField {
  const taken = new Set(existing.map((f) => f.kode));
  let base = `${src.kode}_copy`;
  let kode = base;
  let n = 2;
  while (taken.has(kode)) {
    kode = `${base}${n}`;
    n++;
  }
  return {
    ...src,
    kode,
    label: `${src.label} (salinan)`,
    urutan,
  };
}
