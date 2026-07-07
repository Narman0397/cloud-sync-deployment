// Heuristic PDF/A detection — checks XMP metadata block for `pdfaid:part`.
// Tidak menjamin validasi lengkap PDF/A-3, tetapi cukup untuk menandai dokumen
// "PDF/A-aware" dan memandu user mengganti tools jika perlu.

export type PdfProfile = {
  isPdf: boolean;
  pdfaPart: number | null; // 1 / 2 / 3 / null
  pdfaConformance: "A" | "B" | "U" | null;
  hasXmp: boolean;
};

export function detectPdfProfile(bytes: Uint8Array): PdfProfile {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 1024)));
  const isPdf = head.startsWith("%PDF-");
  if (!isPdf) return { isPdf: false, pdfaPart: null, pdfaConformance: null, hasXmp: false };
  // XMP metadata biasanya berada di stream <?xpacket ...?>
  const text = new TextDecoder("latin1").decode(bytes);
  const xmpStart = text.indexOf("<x:xmpmeta");
  const xmpEnd = text.indexOf("</x:xmpmeta>");
  const hasXmp = xmpStart >= 0 && xmpEnd > xmpStart;
  if (!hasXmp) return { isPdf, pdfaPart: null, pdfaConformance: null, hasXmp: false };
  const xmp = text.slice(xmpStart, xmpEnd + 12);
  const partMatch = xmp.match(/pdfaid:part\s*[>=]\s*"?(\d)/i);
  const confMatch = xmp.match(/pdfaid:conformance\s*[>=]\s*"?([ABU])/i);
  return {
    isPdf,
    pdfaPart: partMatch ? Number(partMatch[1]) : null,
    pdfaConformance: (confMatch?.[1] as "A" | "B" | "U" | undefined) ?? null,
    hasXmp: true,
  };
}

export function isPdfACompliant(profile: PdfProfile, minPart = 1): boolean {
  return profile.isPdf && profile.pdfaPart !== null && profile.pdfaPart >= minPart;
}
