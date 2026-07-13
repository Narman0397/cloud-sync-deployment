// Super admin — kelola template global "Bukti Permohonan".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KEY = "bukti_permohonan_template_html";

async function assertAdmin(userId: string) {
  const { data: isSuper } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (isSuper) return;
  const { data: isPemda } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin_pemda" });
  if (isPemda) return;
  throw new Error("Forbidden");
}

export const getBuktiTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("app_setting")
      .select("value,updated_at")
      .eq("key", KEY)
      .maybeSingle();
    const v = data?.value as unknown;
    return {
      html: typeof v === "string" ? v : "",
      updated_at: data?.updated_at ?? null,
    };
  });

export const saveBuktiTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ html: z.string().max(50000) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("app_setting")
      .select("key")
      .eq("key", KEY)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("app_setting")
        .update({ value: data.html, updated_at: new Date().toISOString() })
        .eq("key", KEY);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("app_setting")
        .insert({ key: KEY, value: data.html, category: "documents", public_visible: false });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
