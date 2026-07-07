import { supabaseAdmin } from "./client.server";
import { createHash } from "node:crypto";

export async function checkRateLimit(
  identifier: string,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - windowSec * 1000).toISOString();
  try {
    const { data: existing } = await supabaseAdmin
      .from("rate_limit")
      .select("id,count,window_start")
      .eq("identifier", identifier)
      .eq("bucket", bucket)
      .gte("window_start", windowStart)
      .maybeSingle();
    if (existing) {
      if ((existing.count ?? 0) >= limit) return { ok: false, remaining: 0 };
      await supabaseAdmin
        .from("rate_limit")
        .update({ count: (existing.count ?? 0) + 1 })
        .eq("id", existing.id);
      return { ok: true, remaining: limit - (existing.count ?? 0) - 1 };
    }
    await supabaseAdmin
      .from("rate_limit")
      .insert({ identifier, bucket, count: 1, window_start: new Date().toISOString() });
    return { ok: true, remaining: limit - 1 };
  } catch {
    return { ok: true, remaining: limit };
  }
}

/** Ambil IP klien dari headers (Cloudflare/Proxy aware) lalu hash. */
export async function clientIpHash(fallback = "anon"): Promise<string> {
  try {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const h = getRequestHeaders() as unknown as Record<string, string | undefined>;
    const xff = (h["x-forwarded-for"] ?? "").split(",")[0]?.trim();
    const raw = h["cf-connecting-ip"] || h["x-real-ip"] || xff || fallback;
    return createHash("sha256").update(String(raw)).digest("hex").slice(0, 32);
  } catch {
    return createHash("sha256").update(fallback).digest("hex").slice(0, 32);
  }
}

/**
 * Helper untuk endpoint publik: cek rate-limit per IP. Lempar Error 429
 * jika melewati kuota. Default: 30 req/menit.
 */
export async function enforcePublicRateLimit(
  bucket: string,
  opts: { limit?: number; windowSec?: number; identifier?: string } = {},
): Promise<void> {
  const identifier = opts.identifier ?? `ip:${await clientIpHash()}`;
  const r = await checkRateLimit(identifier, bucket, opts.limit ?? 30, opts.windowSec ?? 60);
  if (!r.ok) {
    const err = new Error("Terlalu banyak permintaan. Coba lagi sebentar.");
    (err as Error & { statusCode?: number }).statusCode = 429;
    throw err;
  }
}
