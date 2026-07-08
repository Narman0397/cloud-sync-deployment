// Phase 3A — Document generator: merge + produce HTML/PDF/DOCX bytes.
import { mergeTemplate, type MergeContext } from "../placeholder/engine";
// NOTE: pdf-lib di-import lazy di dalam renderPdf() agar module init tidak crash
// di Worker runtime (pdf-lib menggunakan tslib.__extends yang bermasalah saat
// top-level import di Cloudflare Workers). Tanpa lazy import, semua server fn
// di documents.functions.ts (yang mengimpor generator ini) akan gagal init.

export type DocKind = "html" | "pdf" | "docx";

const MAX_TEMPLATE_HTML_BYTES = 512 * 1024; // 512KB sumber HTML
const MAX_CONTEXT_ENTRIES = 500;
const MAX_CONTEXT_VALUE_LEN = 10_000;

export interface GenerateInput {
  kind: DocKind;
  templateHtml: string;
  context: MergeContext;
}
export interface GenerateOutput {
  bytes: Uint8Array;
  mime: string;
  extension: string;
  mergedHtml: string;
}

function htmlToPlainBlocks(html: string): string[] {
  // Strip tags but keep paragraph breaks.
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withBreaks = noScripts
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = withBreaks.replace(/<[^>]+>/g, "");
  return text.replace(/&nbsp;/g, " ").split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

async function renderPdf(html: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 11;
  const lineHeight = 16;
  const margin = 56;
  let page = pdf.addPage([595.28, 841.89]); // A4
  let { width, height } = page.getSize();
  let y = height - margin;
  const maxWidth = width - margin * 2;

  const blocks = htmlToPlainBlocks(html);
  for (const block of blocks) {
    const words = block.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const wPx = font.widthOfTextAtSize(test, fontSize);
      if (wPx > maxWidth && line) {
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
        if (y < margin) {
          page = pdf.addPage([595.28, 841.89]);
          ({ width, height } = page.getSize());
          y = height - margin;
        }
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= lineHeight + 4;
      if (y < margin) {
        page = pdf.addPage([595.28, 841.89]);
        ({ width, height } = page.getSize());
        y = height - margin;
      }
    }
  }
  // Suppress unused warning
  void fontBold;
  return await pdf.save();
}

async function renderDocx(html: string): Promise<Uint8Array> {
  // Minimal worker-safe DOCX via OOXML strings packed by pizzip.
  const PizZip = (await import("pizzip")).default;
  const blocks = htmlToPlainBlocks(html);
  const paras = blocks
    .map(
      (b) =>
        `<w:p><w:r><w:t xml:space="preserve">${b
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`,
    )
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paras}<w:sectPr/></w:body></w:document>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const zip = new PizZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("word/document.xml", document);
  return zip.generate({ type: "uint8array" });
}

export async function generateDocument(input: GenerateInput): Promise<GenerateOutput> {
  // Hard limits — mencegah payload abusive yang melumpuhkan worker.
  if (!input.templateHtml || typeof input.templateHtml !== "string") {
    throw new Error("Template HTML wajib diisi");
  }
  if (input.templateHtml.length > MAX_TEMPLATE_HTML_BYTES) {
    throw new Error("Template HTML terlalu besar (>512KB)");
  }
  if (input.context && typeof input.context === "object") {
    const entries = Object.entries(input.context as unknown as Record<string, unknown>);
    if (entries.length > MAX_CONTEXT_ENTRIES) {
      throw new Error(`Terlalu banyak placeholder (>${MAX_CONTEXT_ENTRIES})`);
    }
    for (const [k, v] of entries) {
      if (typeof v === "string" && v.length > MAX_CONTEXT_VALUE_LEN) {
        throw new Error(`Nilai placeholder '${k}' terlalu panjang`);
      }
    }
  }
  const merged = mergeTemplate(input.templateHtml, input.context);
  if (input.kind === "html") {
    return {
      bytes: new TextEncoder().encode(merged),
      mime: "text/html",
      extension: "html",
      mergedHtml: merged,
    };
  }
  if (input.kind === "pdf") {
    const bytes = await renderPdf(merged);
    return { bytes, mime: "application/pdf", extension: "pdf", mergedHtml: merged };
  }
  const bytes = await renderDocx(merged);
  return {
    bytes,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    mergedHtml: merged,
  };
}
