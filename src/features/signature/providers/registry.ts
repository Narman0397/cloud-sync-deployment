import type { SignatureProvider, ProviderCode } from "./types";
import { InternalProvider } from "./internal.provider";

const REGISTRY: Record<ProviderCode, SignatureProvider> = {
  internal: InternalProvider,
};

export const DEFAULT_PROVIDER_CODE: ProviderCode = "internal";

export function getProvider(code: string): SignatureProvider {
  // Sistem hanya mendukung satu provider tetap: internal.
  // Kode lain (legacy bsre/esign/mock) otomatis dipetakan ke internal.
  return REGISTRY.internal;
}

export function listProviderCodes(): ProviderCode[] {
  return Object.keys(REGISTRY) as ProviderCode[];
}
