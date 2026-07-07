import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageShell, PageHero } from "@/components/site/PageShell";

export const Route = createFileRoute("/maklumat-pelayanan")({
  head: () => ({
    meta: [
      { title: "Maklumat Pelayanan — Pemerintah Kabupaten Buton Selatan" },
      {
        name: "description",
        content:
          "Maklumat Pelayanan Pemerintah Kabupaten Buton Selatan sesuai UU 25/2009 tentang Pelayanan Publik.",
      },
      { property: "og:title", content: "Maklumat Pelayanan Buton Selatan" },
      {
        property: "og:description",
        content: "Janji layanan resmi Pemerintah Kabupaten Buton Selatan kepada masyarakat.",
      },
    ],
  }),
  component: MaklumatPage,
});

const POINTS = [
  "Memberikan pelayanan sesuai dengan standar pelayanan yang telah ditetapkan.",
  "Memberikan pelayanan yang cepat, mudah, tepat, adil, dan tanpa diskriminasi.",
  "Melaksanakan tugas pelayanan dengan penuh tanggung jawab, disiplin, dan profesional.",
  "Menerima kritik, saran, dan pengaduan masyarakat serta menindaklanjuti sesuai ketentuan.",
  "Menyediakan sarana pengaduan dan menyelesaikan pengaduan sesuai standar waktu yang ditetapkan.",
  "Bersedia menerima sanksi sesuai peraturan perundang-undangan apabila tidak menepati maklumat ini.",
];

function MaklumatPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Standar Pelayanan"
        title="Maklumat Pelayanan Publik."
        description="Janji resmi Pemerintah Kabupaten Buton Selatan kepada masyarakat dalam menyelenggarakan pelayanan publik."
      />
      <section className="container-page py-12">
        <article className="mx-auto max-w-3xl rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-soft/40 to-card p-8 shadow-elevated">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="font-display text-2xl font-bold">Maklumat Pelayanan</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Dengan ini, seluruh unsur penyelenggara pelayanan publik pada Pemerintah Kabupaten Buton
            Selatan menyatakan sanggup:
          </p>
          <ol className="mt-5 space-y-3">
            {POINTS.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="pt-1 text-sm leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
            Dasar hukum: UU No. 25 Tahun 2009 tentang Pelayanan Publik ·
            PermenPAN-RB No. 15 Tahun 2014 tentang Pedoman Standar Pelayanan.
          </div>
        </article>
      </section>
    </PageShell>
  );
}
