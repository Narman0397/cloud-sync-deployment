// Internal Signature Provider — provider default sistem.
// Tidak memanggil layanan eksternal: dokumen ditandatangani memakai TTD spesimen
// internal (modul digital-signature) + hash SHA-256 + QR verifikasi.
// Status awal "sent" agar antrian bisa diproses oleh handler internal.
import type {
  SignatureProvider,
  SendDocumentInput,
  SendDocumentResult,
  ProviderStatusResult,
  WebhookEvent,
} from "./types";

export const InternalProvider: SignatureProvider = {
  code: "internal",
  async sendDocument(input: SendDocumentInput): Promise<SendDocumentResult> {
    return {
      externalRequestId: `internal-${input.requestId.slice(0, 8)}-${Date.now()}`,
      status: "sent",
    };
  },
  async checkStatus(): Promise<ProviderStatusResult> {
    // Status real dikelola oleh tabel signature_events internal.
    return { status: "sent" };
  },
  async downloadSignedDocument(): Promise<{ bytes: Uint8Array; mime: string }> {
    // Dokumen final disimpan di Storage internal; tidak perlu download remote.
    return { bytes: new Uint8Array(), mime: "application/pdf" };
  },
  async cancelRequest(): Promise<void> {
    return;
  },
  verifyWebhook(_headers: Headers, rawBody: string): WebhookEvent | null {
    try {
      const body = JSON.parse(rawBody) as {
        externalRequestId: string;
        externalSignerId?: string;
        event: "signed" | "rejected" | "expired" | "cancelled" | "viewed";
        reason?: string;
      };
      if (!body.externalRequestId || !body.event) return null;
      return {
        externalRequestId: body.externalRequestId,
        externalSignerId: body.externalSignerId ?? null,
        event: body.event,
        reason: body.reason ?? null,
        payload: body as unknown as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  },
};
