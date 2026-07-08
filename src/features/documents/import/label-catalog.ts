// Kamus label → placeholder token untuk auto-detect saat impor Word.
export interface LabelRule {
  patterns: RegExp[];
  token: string;
  label: string;
}

export const LABEL_RULES: LabelRule[] = [
  {
    patterns: [/^nama(\s+lengkap|\s+pemohon)?$/i],
    token: "submission.nama",
    label: "Nama Pemohon",
  },
  { patterns: [/^nip$/i], token: "submission.nip", label: "NIP" },
  { patterns: [/^jabatan$/i], token: "submission.jabatan", label: "Jabatan" },
  {
    patterns: [/^(opd|instansi|unit\s*kerja)$/i],
    token: "submission.opd",
    label: "OPD",
  },
  {
    patterns: [/^(tanggal|tgl|tanggal\s+pengajuan)$/i],
    token: "system.tanggal",
    label: "Tanggal",
  },
  {
    patterns: [/^(nomor\s*surat|no\.?\s*surat)$/i],
    token: "document.nomor_surat",
    label: "Nomor Surat",
  },
  {
    patterns: [/^email$/i],
    token: "profile.email",
    label: "Email",
  },
];

export function suggestTokenForLabel(label: string): { token: string; label: string } | null {
  const trimmed = label.trim();
  for (const rule of LABEL_RULES) {
    if (rule.patterns.some((re) => re.test(trimmed))) {
      return { token: rule.token, label: rule.label };
    }
  }
  return null;
}

export interface DetectedRow {
  rawLine: string;
  label: string;
  value: string;
  suggestedToken: string | null;
  suggestedLabel: string | null;
}

const LINE_RE = /^\s*([A-Za-z .]+?)\s*[:\-]\s*(.+?)\s*$/;

export function detectMappings(text: string): DetectedRow[] {
  const out: DetectedRow[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const m = rawLine.match(LINE_RE);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    if (!value || value.length > 200) continue;
    if (label.length < 2 || label.length > 40) continue;
    const key = `${label.toLowerCase()}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const suggestion = suggestTokenForLabel(label);
    out.push({
      rawLine,
      label,
      value,
      suggestedToken: suggestion?.token ?? null,
      suggestedLabel: suggestion?.label ?? null,
    });
  }
  return out;
}
