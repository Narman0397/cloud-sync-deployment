// Phase 3B — QR & hash verification helpers.

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildVerificationUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}/verify-doc/${encodeURIComponent(token)}`;
}

export async function qrSvg(url: string): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toString(url, { type: "svg", margin: 1, width: 200 });
}

export async function qrDataUrl(url: string): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(url, { margin: 1, width: 240 });
}
