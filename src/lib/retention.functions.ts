// Cron hook retention: menghapus spesimen TTD yang sudah dinonaktifkan
// melewati `retention_policies.retention_days` (default 90 hari).
// Dilindungi dengan CRON_SECRET (kirim sebagai input `secret`).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const runRetentionSweep = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ secret: z.string().min(8) }).parse(i))
  .handler(async ({ data }) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || data.secret !== expected) throw new Error("Unauthorized");

    const { data: policy } = await supabaseAdmin
      .from("retention_policies")
      .select("retention_days,enabled")
      .eq("entity", "digital_signatures_revoked")
      .maybeSingle();
    if (!policy?.enabled) return { ok: true, deleted: 0, skipped: "policy_disabled" as const };

    const days = Math.max(1, Number(policy.retention_days ?? 90));
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: targets, error } = await supabaseAdmin
      .from("digital_signatures")
      .select("id,signature_path,revoked_at,is_active")
      .eq("is_active", false)
      .lt("revoked_at", cutoff)
      .limit(500);
    if (error) throw new Error(error.message);

    let deleted = 0;
    for (const t of targets ?? []) {
      if (t.signature_path) {
        await supabaseAdmin.storage.from("signatures").remove([t.signature_path]);
      }
      const { error: delErr } = await supabaseAdmin
        .from("digital_signatures")
        .delete()
        .eq("id", t.id);
      if (!delErr) deleted++;
    }
    return { ok: true, deleted, cutoff };
  });
