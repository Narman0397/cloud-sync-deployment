// Phase 3A — Placeholder engine: parse {{a.b.c}} and resolve from context.
export interface MergeContext {
  submission: Record<string, unknown>;
  profile: Record<string, unknown>;
  workflow: Record<string, unknown>;
  system: Record<string, unknown>;
  document: Record<string, unknown>;
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toLocaleDateString("id-ID");
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function mergeTemplate(template: string, ctx: MergeContext): string {
  return template.replace(PLACEHOLDER_RE, (_m, raw: string) => {
    // Default unprefixed -> submission
    const path = raw.includes(".") ? raw : `submission.${raw}`;
    return formatValue(getPath(ctx, path));
  });
}

export function extractPlaceholders(template: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE);
  while ((m = re.exec(template)) !== null) out.add(m[1]);
  return Array.from(out);
}
