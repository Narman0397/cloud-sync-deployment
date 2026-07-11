// Sprint A — Generate Dokumen Final (PDF + QR + hash + token verifikasi).
// Sekarang mendukung template kustom dari layanan_publik.document_template_id
// (isi otomatis dari data akun + input permohonan). Jika tidak ada template,
// fallback ke layout default.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeTemplate } from "@/features/documents/placeholder/engine";
import {
  buildPermohonanContext,
  getLayananTemplateForPermohonan,
} from "@/features/documents/services/permohonan-context.service";

const BUCKET = "berkas-permohonan";

function token(len = 24): string {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
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

export const generateDokumenFinal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        permohonan_id: z.string().uuid(),
        site_origin: z.string().url().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: p } = await supabaseAdmin
      .from("permohonan")
      .select(
        "id,kode,judul,kategori,status,nomor_surat,opd_id,pemohon_id,dokumen_final_path,tanggal_masuk,deskripsi, opd:opd!opd_id(nama,singkatan)",
      )
      .eq("id", data.permohonan_id)
      .maybeSingle();
    if (!p) throw new Error("Permohonan tidak ditemukan");
    if (!p.nomor_surat) throw new Error("Terbitkan nomor surat terlebih dahulu");

    // RBAC
    const { data: roleSuper } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    let allowed = !!roleSuper;
    if (!allowed) {
      const { data: roleOpd } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "admin_opd",
      });
      const { data: myOpd } = await supabaseAdmin.rpc("get_user_opd", { _user_id: userId });
      allowed = !!roleOpd && myOpd === p.opd_id;
    }
    if (!allowed) throw new Error("Forbidden");

    // Ambil template layanan (jika ada) & bangun konteks
    const tplInfo = await getLayananTemplateForPermohonan(supabaseAdmin, p.id);
    const tok = token();
    const origin = data.site_origin ?? "";
    const verifyUrl = `${origin}/v/${tok}`;

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const QRCode = (await import("qrcode")).default;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4: [number, number] = [595.28, 841.89];

    if (tplInfo.template_html) {
      // === Path template: merge {{placeholder}} lalu render sebagai teks paragraf ===
      const ctx = await buildPermohonanContext(supabaseAdmin, p.id, {
        verify_url: verifyUrl,
      });
      const merged = mergeTemplate(tplInfo.template_html, ctx);
      const blocks = htmlToPlainBlocks(merged);
      const margin = 56;
      const fontSize = 11;
      const lineHeight = 16;
      let page = pdf.addPage(A4);
      let { width, height } = page.getSize();
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
            if (y < margin + 140) {
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
          y -= lineHeight + 3;
          if (y < margin + 140) {
            page = pdf.addPage(A4);
            ({ width, height } = page.getSize());
            y = height - margin;
          }
        }
      }
    } else {
      // === Fallback layout default (sama seperti sebelumnya) ===
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("nama_lengkap,nik")
        .eq("id", p.pemohon_id)
        .maybeSingle();
      const opdRaw = (p as { opd?: unknown }).opd;
      const opdRel = (Array.isArray(opdRaw) ? opdRaw[0] : opdRaw) as
        | { nama?: string | null; singkatan?: string | null }
        | null
        | undefined;
      const opdNama = opdRel?.nama ?? "Pemerintah Daerah";
      const opdSingkatan = opdRel?.singkatan ?? "OPD";
      const page = pdf.addPage(A4);
      const draw = (t: string, x: number, yy: number, size = 11, bold = false) =>
        page.drawText(t, {
          x,
          y: yy,
          size,
          font: bold ? fontBold : font,
          color: rgb(0.1, 0.1, 0.15),
        });
      let y = 800;
      draw("PEMERINTAH DAERAH", 50, y, 10, true);
      y -= 14;
      draw(opdNama.toUpperCase(), 50, y, 14, true);
      y -= 14;
      draw(`(${opdSingkatan})`, 50, y, 10);
      y -= 8;
      page.drawLine({
        start: { x: 50, y: y - 4 },
        end: { x: 545, y: y - 4 },
        thickness: 1,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= 36;
      draw(`Nomor   : ${p.nomor_surat}`, 50, y);
      y -= 16;
      draw(`Perihal : ${p.kategori}`, 50, y);
      y -= 24;
      draw("Berdasarkan permohonan yang diajukan kepada kami:", 50, y);
      y -= 20;
      draw(`Kode Permohonan : ${p.kode}`, 70, y);
      y -= 14;
      draw(`Pemohon         : ${prof?.nama_lengkap ?? "-"} (NIK: ${prof?.nik ?? "-"})`, 70, y);
      y -= 14;
      draw(`Judul           : ${p.judul}`, 70, y);
      y -= 14;
      draw(`Tanggal Masuk   : ${new Date(p.tanggal_masuk).toLocaleDateString("id-ID")}`, 70, y);
      y -= 20;
      if (p.deskripsi) {
        const lines = wrap(p.deskripsi, 90).slice(0, 8);
        for (const ln of lines) {
          draw(ln, 50, y, 10);
          y -= 12;
        }
      }
    }

    // === Stempel QR + info verifikasi di halaman terakhir ===
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220 });
    const qrPng = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    const qrImg = await pdf.embedPng(qrPng);
    const pages = pdf.getPages();
    const last = pages[pages.length - 1];
    last.drawText(`Diterbitkan: ${new Date().toLocaleString("id-ID")}`, {
      x: 50,
      y: 130,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.15),
    });
    last.drawText("Verifikasi keaslian:", {
      x: 50,
      y: 112,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    last.drawText(verifyUrl, {
      x: 50,
      y: 100,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    last.drawImage(qrImg, { x: 435, y: 40, width: 110, height: 110 });
    last.drawText("Pindai QR untuk verifikasi", {
      x: 435,
      y: 28,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    const bytes = await pdf.save();
    const hash = await sha256Hex(bytes);
    const path = `dokumen-final/${p.id}/${tok}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(`Gagal upload: ${upErr.message}`);

    const { error: insErr } = await supabaseAdmin.from("dokumen_verifikasi").insert({
      token: tok,
      permohonan_id: p.id,
      nomor_surat: p.nomor_surat,
      storage_path: path,
      sha256: hash,
      signature_provider: tplInfo.tte_required ? "pending" : "none",
      diterbitkan_oleh: userId,
    });
    if (insErr) throw new Error(`Gagal simpan verifikasi: ${insErr.message}`);

    await supabaseAdmin.from("permohonan").update({ dokumen_final_path: path }).eq("id", p.id);

    // Opsional: buat signature_request jika layanan mewajibkan TTE
    let signature_request_id: string | null = null;
    if (tplInfo.tte_required) {
      const { data: gd } = await supabaseAdmin
        .from("generated_documents")
        .insert({
          storage_path: path,
          mime: "application/pdf",
          size_bytes: bytes.byteLength,
          doc_number: p.nomor_surat,
          name: `${p.kode} — ${p.judul}`,
          status: "generated",
          snapshot: { permohonan_id: p.id, token: tok, sha256: hash },
          generated_by: userId,
        })
        .select("id")
        .single();
      if (gd) {
        const { data: sr } = await supabaseAdmin
          .from("signature_requests")
          .insert({
            generated_document_id: gd.id,
            mode: "sequential",
            status: "draft",
            file_hash: hash,
            opd_id: p.opd_id,
            created_by: userId,
          })
          .select("id")
          .single();
        if (sr) {
          signature_request_id = sr.id;
          await supabaseAdmin.from("signature_request_signers").insert({
            request_id: sr.id,
            order_index: 0,
            signer_type: "role",
            role: tplInfo.tte_signer_role ?? "kepala_opd",
            opd_id: p.opd_id,
            status: "pending",
          });
        }
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      user_id: userId,
      aksi: "dokumen.generate",
      entitas: "permohonan",
      entitas_id: p.id,
      data_sesudah: {
        token: tok,
        sha256: hash,
        template_id: tplInfo.template_id,
        signature_request_id,
      },
    });

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 30);
    return {
      token: tok,
      path,
      sha256: hash,
      signed_url: signed?.signedUrl ?? null,
      verify_url: verifyUrl,
      template_used: !!tplInfo.template_html,
      tte_required: tplInfo.tte_required,
      signature_request_id,
    };
  });

export const getDokumenFinalSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ permohonan_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: p } = await supabaseAdmin
      .from("permohonan")
      .select("dokumen_final_path,opd_id,pemohon_id")
      .eq("id", data.permohonan_id)
      .maybeSingle();
    if (!p?.dokumen_final_path) return { signed_url: null };

    let allowed = p.pemohon_id === userId;
    if (!allowed) {
      const { data: roleSuper } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "super_admin",
      });
      allowed = !!roleSuper;
    }
    if (!allowed) {
      const { data: roleOpd } = await supabaseAdmin.rpc("has_role", {
        _user_id: userId,
        _role: "admin_opd",
      });
      const { data: myOpd } = await supabaseAdmin.rpc("get_user_opd", { _user_id: userId });
      allowed = !!roleOpd && myOpd === p.opd_id;
    }
    if (!allowed) throw new Error("Forbidden");

    const { data: s } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(p.dokumen_final_path, 60 * 30);
    return { signed_url: s?.signedUrl ?? null };
  });

function wrap(text: string, w: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > w) {
      if (cur) out.push(cur);
      cur = word;
    } else cur = cur ? cur + " " + word : word;
  }
  if (cur) out.push(cur);
  return out;
}
