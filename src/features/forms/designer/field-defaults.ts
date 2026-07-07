// Phase 1B.2 — Default factories per FieldType untuk palette → canvas.
// Microcopy: label palette & grup memakai Bahasa Indonesia ramah-awam
// (lihat docs/audit/form_builder_susun_field_ux_2026-06.md).
import type { FieldType, FormField } from "@/features/forms/schema/types";
import { slugifyKey } from "@/features/forms/wizard/types";

export interface PaletteItem {
  type: FieldType;
  label: string;
  group: "input" | "choice" | "media" | "layout";
  description?: string;
}

export const PALETTE: PaletteItem[] = [
  { type: "short_text", label: "Teks Singkat", group: "input" },
  { type: "long_text", label: "Paragraf", group: "input" },
  { type: "number", label: "Angka", group: "input" },
  { type: "currency", label: "Nominal Uang (Rp)", group: "input" },
  { type: "email", label: "Email", group: "input" },
  { type: "phone", label: "Nomor HP", group: "input" },
  { type: "date", label: "Tanggal", group: "input" },
  { type: "date_range", label: "Rentang Tanggal", group: "input" },
  { type: "dropdown", label: "Pilihan Tunggal", group: "choice" },
  { type: "multi_select", label: "Pilihan Banyak", group: "choice" },
  { type: "radio", label: "Pilih Salah Satu", group: "choice" },
  { type: "checkbox", label: "Centang Persetujuan", group: "choice" },
  { type: "file_upload", label: "Unggah Berkas", group: "media" },
  { type: "signature", label: "Tanda Tangan", group: "media" },
  { type: "heading", label: "Judul Bagian", group: "layout" },
  { type: "section", label: "Bagian / Subbab", group: "layout" },
  { type: "divider", label: "Garis Pemisah", group: "layout" },
];

export const GROUP_LABEL: Record<PaletteItem["group"], string> = {
  input: "Isian Data",
  choice: "Pilihan",
  media: "Berkas & Tanda Tangan",
  layout: "Penataan",
};

/**
 * Label ramah-pengguna per tipe field. Dipakai di badge canvas agar
 * pengguna awam tidak melihat `short_text`, `multi_select`, dll.
 */
export const FIELD_TYPE_LABEL_ID: Record<FieldType, string> = {
  short_text: "Teks Singkat",
  long_text: "Paragraf",
  number: "Angka",
  currency: "Nominal (Rp)",
  email: "Email",
  phone: "Nomor HP",
  date: "Tanggal",
  date_range: "Rentang Tanggal",
  dropdown: "Pilihan Tunggal",
  multi_select: "Pilihan Banyak",
  radio: "Pilih Salah Satu",
  checkbox: "Centang Persetujuan",
  file_upload: "Unggah Berkas",
  multi_file_upload: "Unggah Banyak Berkas",
  signature: "Tanda Tangan",
  heading: "Judul",
  section: "Bagian",
  divider: "Pemisah",
  time: "Jam",
  datetime: "Tanggal & Jam",
  rating: "Rating",
  address: "Alamat",
  nip: "NIP",
  nik: "NIK",
};

const DEFAULT_LABELS: Partial<Record<FieldType, string>> = {
  short_text: "Teks",
  long_text: "Paragraf",
  number: "Angka",
  currency: "Nominal (Rp)",
  email: "Email",
  phone: "Nomor HP",
  date: "Tanggal",
  date_range: "Rentang Tanggal",
  dropdown: "Pilihan",
  multi_select: "Pilihan (banyak)",
  radio: "Opsi",
  checkbox: "Persetujuan",
  file_upload: "Lampiran",
  signature: "Tanda Tangan",
  heading: "Judul Bagian",
  section: "Bagian",
  divider: "Pembatas",
};

export function createFieldOfType(type: FieldType, existingKeys: Set<string>): FormField {
  const label = DEFAULT_LABELS[type] ?? "Isian";
  const base = slugifyKey(label);
  let kode = base;
  let n = 2;
  while (existingKeys.has(kode)) kode = `${base}_${n++}`;

  const opts =
    type === "dropdown" || type === "multi_select" || type === "radio"
      ? [
          { value: "opsi_1", label: "Opsi 1" },
          { value: "opsi_2", label: "Opsi 2" },
        ]
      : [];

  return {
    kode,
    label,
    tipe: type,
    required: false,
    placeholder: null,
    help_text: null,
    options: opts,
    validation:
      type === "file_upload"
        ? { maxSizeMb: 5, accept: ["application/pdf", "image/*"] }
        : {},
    visible_if: null,
    urutan: 0,
  };
}
