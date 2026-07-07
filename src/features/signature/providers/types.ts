// Provider tanda tangan — sistem hanya memakai satu provider tetap: internal.
export type ProviderCode = "internal";

export type ProviderStatus =
  | "pending"
  | "sent"
  | "signed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "failed";

export interface SignerDescriptor {
  id: string; // signer row id
  full_name: string;
  email?: string | null;
  nip?: string | null;
  position?: string | null;
  order_index: number;
}

export interface SendDocumentInput {
  requestId: string;
  externalKey?: string | null;
  documentName: string;
  documentBytes: Uint8Array;
  mime: string;
  mode: "sequential" | "parallel";
  signers: SignerDescriptor[];
  callbackUrl: string;
  config: Record<string, unknown>;
}

export interface SendDocumentResult {
  externalRequestId: string;
  status: ProviderStatus;
}

export interface ProviderStatusResult {
  status: ProviderStatus;
  signers?: Array<{ external_signer_id: string; status: ProviderStatus; signed_at?: string }>;
  signedFile?: { bytes: Uint8Array; mime: string } | null;
  error?: string | null;
}

export interface WebhookEvent {
  externalRequestId: string;
  externalSignerId?: string | null;
  event: "signed" | "rejected" | "expired" | "cancelled" | "viewed";
  signedFileUrl?: string | null;
  reason?: string | null;
  payload: Record<string, unknown>;
}

export interface SignatureProvider {
  code: ProviderCode;
  sendDocument(input: SendDocumentInput): Promise<SendDocumentResult>;
  checkStatus(externalRequestId: string, config: Record<string, unknown>): Promise<ProviderStatusResult>;
  downloadSignedDocument(
    externalRequestId: string,
    config: Record<string, unknown>,
  ): Promise<{ bytes: Uint8Array; mime: string }>;
  cancelRequest(externalRequestId: string, reason: string, config: Record<string, unknown>): Promise<void>;
  verifyWebhook(headers: Headers, rawBody: string, secret: string | null): WebhookEvent | null;
}
