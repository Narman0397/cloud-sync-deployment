// Bukti Permohonan — PDF receipt dengan QR untuk pemohon.
// Bukti berbeda dari "Dokumen Final": diterbitkan sebagai tanda bukti pengambilan
// dan diverifikasi admin OPD via QR scanner.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeTemplate } from "@/features/documents/placeholder/engine";
import { buildPermohonanContext } from "@/features/documents/services/permohonan-context.service";

const BUCKET = "berkas-permohonan";

function makeToken(len = 24): string {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function htmlToPlainBlocks(html: string): string[] {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withBreaks = noScripts
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = withBreaks.replace(/<[^>]+>/g, "");
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function defaultBuktiHtml(): string {
  return `
    <h2 style="text-align:center">BUKTI PERMOHONAN LAYANAN PUBLIK</h2>
    <p>Dokumen ini adalah bukti resmi pengajuan permohonan layanan publik. Tunjukkan bukti ini beserta identitas diri (KTP) saat mengambil dokumen di OPD terkait.</p>
    <p><b>Kode Permohonan:</b> {{permohonan.kode}}<br>
    <b>Judul:</b> {{permohonan.judul}}<br>
    <b>Kategori Layanan:</b> {{permohonan.kategori}}<br>
    <b>Tanggal Pengajuan:</b> {{permohonan.tanggal_masuk}}</p>
    <p><b>Pemohon:</b> {{pemohon.nama}}<br>
    <b>NIK:</b> {{pemohon.nik}}<br>
    <b>No HP:</b> {{pemohon.no_hp}}<br>
    <b>Alamat:</b> {{pemohon.alamat}}, Desa {{pemohon.desa}}</p>
    <p><b>OPD Tujuan:</b> {{opd.nama}} ({{opd.singkatan}})</p>
    <p style="margin-top:24px">Verifikasi keaslian bukti ini dengan memindai kode QR di bagian bawah halaman ini. Petugas OPD wajib melakukan verifikasi QR sebelum menyerahkan dokumen fisik.</p>
  `.trim();
}

async function getBuktiTemplateHtml(layananHtml: string | null): Promise<string> {
  if (layananHtml && layananHtml.trim()) return layananHtml;
  const { data } = await supabaseAdmin
    .from("app_setting")
    .select("value")
    .eq("key", "bukti_permohonan_template_html")
    .maybeSingle();
  const v = data?.value as unknown;
  if (typeof v === "string" && v.trim()) return v;
  return defaultBuktiHtml();
}

async function assertBuktiAccess(permohonan_id: string, userId: string): Promise<{ ok: boolean; isPemohon: boolean }> {
  const { data: p } = await supabaseAdmin
    .from("permohonan")
    .select("pemohon_id,opd_id")
    .eq("id", permohonan_id)
    .maybeSingle();
  if (!p) return { ok: false, isPemohon: false };
  if (p.pemohon_id === userId) return { ok: true, isPemohon: true };
  const { data: isSuper } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (isSuper) return { ok: true, isPemohon: false };
  const { data: isOpd } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin_opd" });
  if (isOpd) {
    const { data: myOpd } = await supabaseAdmin.rpc("get_user_opd", { _user_id: userId });
    return { ok: myOpd === p.opd_id, isPemohon: false };
  }
  return { ok: false, isPemohon: false };
}

async function buildBuktiPdf(
  permohonan_id: string,
  verifyUrl: string,
): Promise<{ bytes: Uint8Array; token: string; path: string }> {
  const { data: p } = await supabaseAdmin
    .from("permohonan")
    .select("id,kode,kategori,bukti_token")
    .eq("id", permohonan_id)
    .maybeSingle();
  if (!p) throw new Error("Permohonan tidak ditemukan");

  // Ambil template layanan jika ada.
  const { data: lay } = await supabaseAdmin
    .from("layanan_publik")
    .select("document_template_id")
    .or(`judul.eq.${p.kategori},slug.eq.${p.kategori}`)
    .maybeSingle();
  let layananHtml: string | null = null;
  if (lay?.document_template_id) {
    const { data: tpl } = await supabaseAdmin
      .from("document_templates")
      .select("template_html")
      .eq("id", lay.document_template_id)
      .maybeSingle();
    layananHtml = (tpl as { template_html?: string | null } | null)?.template_html ?? null;
  }

  const templateHtml = await getBuktiTemplateHtml(layananHtml);
  const ctx = await buildPermohonanContext(supabaseAdmin, permohonan_id, { verify_url: verifyUrl });
  const merged = mergeTemplate(templateHtml, ctx);
  const blocks = htmlToPlainBlocks(merged);

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const QRCode = (await import("qrcode")).default;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const A4: [number, number] = [595.28, 841.89];

  let page = pdf.addPage(A4);
  let { width, height } = page.getSize();
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 16;
  let y = height - margin;
  const maxWidth = width - margin * 2;

  for (const block of blocks) {
    const words = block.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const wPx = font.widthOfTextAtSize(test, fontSize);
      if (wPx > maxWidth && line) {
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
        if (y < margin + 160) {
          page = pdf.addPage(A4);
          ({ width, height } = page.getSize());
          y = height - margin;
        }
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
      y -= lineHeight + 4;
      if (y < margin + 160) {
        page = pdf.addPage(A4);
        ({ width, height } = page.getSize());
        y = height - margin;
      }
    }
  }

  // QR + info verifikasi di halaman terakhir.
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220 });
  const qrPng = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const qrImg = await pdf.embedPng(qrPng);
  const pages = pdf.getPages();
  const last = pages[pages.length - 1];
  last.drawText(`Diterbitkan: ${new Date().toLocaleString("id-ID")}`, {
    x: margin, y: 130, size: 10, font, color: rgb(0.1, 0.1, 0.15),
  });
  last.drawText("Verifikasi keaslian bukti:", { x: margin, y: 112, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  last.drawText(verifyUrl, { x: margin, y: 100, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
  last.drawImage(qrImg, { x: 435, y: 40, width: 110, height: 110 });
  last.drawText("Pindai QR untuk verifikasi", { x: 435, y: 28, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

  const bytes = await pdf.save();
  const token = p.bukti_token ?? makeToken();
  const path = `bukti/${permohonan_id}/${token}.pdf`;
  return { bytes, token, path };
}

export const generateBuktiPermohonan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      permohonan_id: z.string().uuid(),
      site_origin: z.string().url().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const acc = await assertBuktiAccess(data.permohonan_id, userId);
    if (!acc.ok) throw new Error("Forbidden");

    const origin = data.site_origin ?? "";
    // Token perlu ada sebelum verifyUrl dibangun, tapi verifyUrl dibutuhkan saat build PDF.
    // buildBuktiPdf akan reuse token existing jika sudah ada.
    const { data: pRow } = await supabaseAdmin
      .from("permohonan")
      .select("bukti_token")
      .eq("id", data.permohonan_id)
      .maybeSingle();
    const token = pRow?.bukti_token ?? makeToken();
    const verifyUrl = `${origin}/v/${token}`;

    // Pastikan token tersimpan lebih dulu (agar buildBuktiPdf reuse).
    if (!pRow?.bukti_token) {
      await supabaseAdmin.from("permohonan").update({ bukti_token: token }).eq("id", data.permohonan_id);
    }

    const built = await buildBuktiPdf(data.permohonan_id, verifyUrl);
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(built.path, built.bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Gagal upload bukti: ${upErr.message}`);

    await supabaseAdmin
      .from("permohonan")
      .update({
        bukti_path: built.path,
        bukti_generated_at: new Date().toISOString(),
      })
      .eq("id", data.permohonan_id);

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(built.path, 600);
    return { url: signed?.signedUrl ?? null, token, path: built.path };
  });

export const getBuktiSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ permohonan_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const acc = await assertBuktiAccess(data.permohonan_id, userId);
    if (!acc.ok) throw new Error("Forbidden");
    const { data: p } = await supabaseAdmin
      .from("permohonan")
      .select("bukti_path")
      .eq("id", data.permohonan_id)
      .maybeSingle();
    if (!p?.bukti_path) return { url: null };
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(p.bukti_path, 600);
    return { url: signed?.signedUrl ?? null };
  });

// PUBLIC — dipanggil oleh /verify/$token bila token adalah bukti permohonan.
export const verifyBuktiByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(i))
  .handler(async ({ data }) => {
    const { data: p } = await supabaseAdmin
      .from("permohonan")
      .select("id,kode,judul,kategori,status,tanggal_masuk,opd_id,pemohon_id,bukti_generated_at,bukti_verified_at,bukti_verified_note")
      .eq("bukti_token", data.token)
      .maybeSingle();
    if (!p) return { valid: false as const, reason: "not_found" as const };
    const [{ data: prof }, { data: opd }] = await Promise.all([
      supabaseAdmin.from("profiles").select("nama_lengkap,nik,no_hp").eq("id", p.pemohon_id).maybeSingle(),
      p.opd_id
        ? supabaseAdmin.from("opd").select("nama,singkatan").eq("id", p.opd_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const maskNik = (nik: string | null | undefined) => {
      if (!nik) return "-";
      if (nik.length <= 6) return nik;
      return nik.slice(0, 4) + "****" + nik.slice(-4);
    };
    return {
      valid: true as const,
      bukti: {
        permohonan_id: p.id,
        kode: p.kode,
        judul: p.judul,
        kategori: p.kategori,
        status: p.status,
        tanggal_masuk: p.tanggal_masuk,
        generated_at: p.bukti_generated_at,
        verified_at: p.bukti_verified_at,
        verified_note: p.bukti_verified_note,
        pemohon: {
          nama: prof?.nama_lengkap ?? "-",
          nik_masked: maskNik(prof?.nik ?? null),
          no_hp: prof?.no_hp ?? "-",
        },
        opd: {
          nama: (opd as { nama?: string } | null)?.nama ?? "-",
          singkatan: (opd as { singkatan?: string } | null)?.singkatan ?? "-",
        },
      },
    };
  });

// Admin OPD / super admin — tandai bukti sudah diverifikasi via scan QR.
export const adminScanVerifyBukti = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      token: z.string().min(8).max(128),
      note: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: p } = await supabaseAdmin
      .from("permohonan")
      .select("id,opd_id,bukti_verified_at")
      .eq("bukti_token", data.token)
      .maybeSingle();
    if (!p) throw new Error("Token bukti tidak ditemukan");
    const { data: isSuper } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: isOpd } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin_opd" });
      if (isOpd) {
        const { data: myOpd } = await supabaseAdmin.rpc("get_user_opd", { _user_id: userId });
        allowed = myOpd === p.opd_id;
      }
    }
    if (!allowed) throw new Error("Anda tidak berwenang memverifikasi bukti ini");

    await supabaseAdmin
      .from("permohonan")
      .update({
        bukti_verified_at: new Date().toISOString(),
        bukti_verified_by: userId,
        bukti_verified_note: data.note ?? null,
      })
      .eq("id", p.id);
    await supabaseAdmin.from("permohonan_riwayat").insert({
      permohonan_id: p.id,
      aksi: "bukti_diverifikasi",
      catatan: data.note ? `Bukti diverifikasi via QR: ${data.note}` : "Bukti diverifikasi via QR",
      oleh: userId,
    });
    return { ok: true as const, already_verified: !!p.bukti_verified_at };
  });
