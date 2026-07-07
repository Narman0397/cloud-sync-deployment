// Panduan Singkat TTE — halaman onboarding sederhana untuk membantu user
// memahami alur dokumen & tanda tangan dalam 3 langkah.
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FilePlus2,
  PenLine,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/document-center/panduan")({
  head: () => ({
    meta: [{ title: "Panduan TTE — Pusat Dokumen" }, { name: "robots", content: "noindex" }],
  }),
  component: PanduanPage,
});

function PanduanPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Panduan</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
          3 Langkah Menggunakan Tanda Tangan Elektronik
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sistem TTE internal aktif otomatis. Ikuti alur sederhana berikut untuk membuat dokumen
          resmi bertanda tangan yang dapat diverifikasi publik.
        </p>
      </header>

      <ol className="space-y-4">
        <Step
          n={1}
          icon={FilePlus2}
          title="Buat Dokumen"
          desc="Pilih template surat, isi data (banyak field otomatis terisi dari profil & OPD Anda), lalu simpan sebagai draft. Draft tersimpan otomatis setiap perubahan."
          cta={{ to: "/admin/document-center/templates", label: "Pilih Template" }}
          bullets={[
            "Nomor surat otomatis mengikuti aturan penomoran OPD.",
            "Preview PDF muncul di sisi kanan saat mengisi form.",
          ]}
        />
        <Step
          n={2}
          icon={PenLine}
          title="Kirim untuk Ditandatangani"
          desc="Tentukan penandatangan (bisa lebih dari satu, berurutan). Sistem mengirim notifikasi in-app & email ke penandatangan berikutnya secara otomatis."
          cta={{ to: "/admin/document-center/signature/queue", label: "Buka Antrian TTD" }}
          bullets={[
            "Penandatangan cukup klik 'Tanda Tangan Sekarang' pada dokumen di antrian.",
            "TTD memakai spesimen internal + hash SHA-256 + QR verifikasi.",
          ]}
        />
        <Step
          n={3}
          icon={ShieldCheck}
          title="Verifikasi & Bagikan"
          desc="Setelah semua penandatangan selesai, dokumen final dapat diunduh. Setiap dokumen memiliki tautan verifikasi publik (QR) untuk pemeriksaan keaslian."
          cta={{ to: "/admin/document-center/documents", label: "Lihat Dokumen Selesai" }}
          bullets={[
            "Tautan verifikasi dapat dibagikan lewat email/WhatsApp.",
            "Publik memeriksa keaslian dokumen di /verify tanpa perlu login.",
          ]}
        />
      </ol>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <HelpCircle className="h-4 w-4 text-primary" /> FAQ Singkat
        </div>
        <dl className="mt-3 space-y-3 text-sm">
          <FAQ
            q="Apakah TTE ini sah?"
            a="TTE internal memakai standar hash SHA-256 dan QR verifikasi. Dokumen final tidak dapat dipalsukan tanpa terdeteksi saat verifikasi."
          />
          <FAQ
            q="Apa yang terjadi jika penandatangan menolak?"
            a="Alur dihentikan dan pembuat dokumen menerima notifikasi beserta alasan penolakan. Anda dapat merevisi dan mengirim ulang."
          />
          <FAQ
            q="Bisakah dokumen ditarik kembali?"
            a="Bisa, selama belum ada penandatangan yang menyelesaikan tanda tangan. Buka detail dokumen dan pilih 'Batalkan'."
          />
        </dl>
      </section>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  desc,
  bullets,
  cta,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  bullets: string[];
  cta: { to: string; label: string };
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          <ul className="mt-3 space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Link
            to={cta.to}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </li>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{q}</dt>
      <dd className="mt-0.5 text-muted-foreground">{a}</dd>
    </div>
  );
}
