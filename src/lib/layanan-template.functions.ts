// Server fn khusus untuk mengelola template dokumen milik Layanan Publik.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultLayananTemplateHtml } from "@/features/documents/placeholder/permohonan-catalog";

async function assertAdmin(userId: string, opd_id: string | null) {
  const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (isSuper) return true;
  const { data: isAdminOpd } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin_opd",
  });
  if (!isAdminOpd) return false;
  if (!opd_id) return true;
  const { data: myOpd } = await supabaseAdmin.rpc("get_user_opd", { _user_id: userId });
  return myOpd === opd_id;
}

// List template yang bisa dipilih oleh sebuah layanan (semua template dari opd milik layanan + shared).
export const listTemplatesForLayanan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ opd_id: z.string().uuid().nullable().optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const q = supabaseAdmin
      .from("document_templates")
      .select("id,name,category,status,opd_id,owner_opd_id")
      .is("deleted_at", null)
      .order("name");
    const { data: rows, error } = data.opd_id
      ? await q.or(`opd_id.eq.${data.opd_id},opd_id.is.null,owner_opd_id.eq.${data.opd_id}`)
      : await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// Buat template baru dari sebuah layanan lalu (opsional) langsung tautkan ke layanan.
export const createTemplateFromLayanan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        layanan_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: lay } = await supabaseAdmin
      .from("layanan_publik")
      .select("id,judul,opd_id")
      .eq("id", data.layanan_id)
      .maybeSingle();
    if (!lay) throw new Error("Layanan tidak ditemukan");
    const ok = await assertAdmin(context.userId, lay.opd_id);
    if (!ok) throw new Error("Forbidden");

    const html = defaultLayananTemplateHtml(lay.judul);
    const { data: tpl, error } = await supabaseAdmin
      .from("document_templates")
      .insert({
        name: `Surat — ${lay.judul}`,
        kind: "html",
        category: "layanan",
        template_html: html,
        variables: [],
        status: "active",
        opd_id: lay.opd_id,
        owner_opd_id: lay.opd_id,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("layanan_publik")
      .update({ document_template_id: tpl.id })
      .eq("id", lay.id);

    return { template_id: tpl.id };
  });
