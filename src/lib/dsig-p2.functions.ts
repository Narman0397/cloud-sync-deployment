// P2 — Rotasi sertifikat, KPI Document Center, health provider.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin_opd", "admin_pemda"]);
  if (!data || data.length === 0) throw new Error("Akses ditolak");
}

/** Rotasi sertifikat: nonaktifkan sertifikat lama, terbitkan baru dengan referensi rotated_from. */
export const dcRotateCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        certificate_id: z.string().uuid(),
        reason: z.string().min(3).max(500),
        expired_at: z.string().datetime().optional().nullable(),
        public_key: z.string().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: cert, error: e1 } = await supabaseAdmin
      .from("signing_certificates")
      .select("id,user_id,nip,full_name,position")
      .eq("id", data.certificate_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cert) throw new Error("Sertifikat tidak ditemukan");
    const now = new Date().toISOString();
    const { error: e2 } = await supabaseAdmin
      .from("signing_certificates")
      .update({
        is_active: false,
        revoked_at: now,
        revoke_reason: data.reason,
      })
      .eq("id", cert.id);
    if (e2) throw new Error(e2.message);
    const { data: inserted, error: e3 } = await supabaseAdmin
      .from("signing_certificates")
      .insert({
        user_id: cert.user_id,
        nip: cert.nip,
        full_name: cert.full_name,
        position: cert.position,
        public_key: data.public_key ?? null,
        expired_at: data.expired_at ?? null,
        is_active: true,
        rotated_from: cert.id,
      })
      .select("id")
      .single();
    if (e3) throw new Error(e3.message);
    return { ok: true, new_certificate_id: inserted.id, rotated_from: cert.id };
  });

/** Kesehatan provider (24 jam terakhir) — dari view v_dc_provider_health. */
export const dcProviderHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("v_dc_provider_health")
      .select("*");
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

/** KPI Document Center — agregat per hari. */
export const dcKpiDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        opd_id: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const to = data.to ?? new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 29);
    const from = data.from ?? fromDate.toISOString().slice(0, 10);
    let q = supabaseAdmin
      .from("v_dc_kpi")
      .select("*")
      .gte("day", from)
      .lte("day", to)
      .order("day", { ascending: true });
    if (data.opd_id) q = q.eq("opd_id", data.opd_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const totals = { pending: 0, signed: 0, rejected: 0, expired: 0, failed: 0, total: 0 };
    let ttSum = 0;
    let ttCount = 0;
    for (const r of rows ?? []) {
      totals.pending += Number(r.pending ?? 0);
      totals.signed += Number(r.signed ?? 0);
      totals.rejected += Number(r.rejected ?? 0);
      totals.expired += Number(r.expired ?? 0);
      totals.failed += Number(r.failed ?? 0);
      totals.total += Number(r.total ?? 0);
      const t = Number(r.avg_turnaround_seconds ?? 0);
      const s = Number(r.signed ?? 0);
      if (t > 0 && s > 0) {
        ttSum += t * s;
        ttCount += s;
      }
    }
    return {
      from,
      to,
      totals,
      avg_turnaround_seconds: ttCount > 0 ? ttSum / ttCount : 0,
      daily: rows ?? [],
    };
  });

/** Daftar sertifikat aktif + histori rotasi (untuk UI). */
export const dcListCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("signing_certificates")
      .select(
        "id,user_id,full_name,nip,position,issued_at,expired_at,is_active,revoked_at,revoke_reason,rotated_from",
      )
      .order("issued_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });
