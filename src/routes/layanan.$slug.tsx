import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/site/PageShell";
import {
  ArrowLeft,
  ChevronRight,
  Building2,
  FileCheck2,
  Loader2,
  Info,
  Clock,
  ListOrdered,
  Printer,
} from "lucide-react";
import { layananBySlugQueryOptions, opdByIdQueryOptions } from "@/lib/queries";
import { parsePersyaratan } from "@/lib/parse-persyaratan";

export const Route = createFileRoute("/layanan/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Layanan ${params.slug} — Pemerintah Kabupaten Buton Selatan` },
      {
        name: "description",
        content: "Detail layanan publik: deskripsi, persyaratan, dan alur lengkap.",
      },
    ],
  }),
  loader: async ({ params, context: { queryClient } }) => {
    const item = await queryClient.ensureQueryData(layananBySlugQueryOptions(params.slug));
    if (item?.opd_id) {
      queryClient.ensureQueryData(opdByIdQueryOptions(item.opd_id));
    }
  },
  pendingComponent: () => (
    <PageShell>
      <section className="bg-gradient-hero text-primary-foreground">
        <div className="container-page py-12 md:py-16">
          <div className="flex items-center gap-2 text-white/85">
            <Loader2 className="h-5 w-5 animate-spin" /> Memuat…
          </div>
        </div>
      </section>
    </PageShell>
  ),
  component: LayananDetailPage,
});

function LayananDetailPage() {
  const { slug } = Route.useParams();
  const { data: item } = useSuspenseQuery(layananBySlugQueryOptions(slug));
  const { data: opd } = useSuspenseQuery(opdByIdQueryOptions(item?.opd_id ?? ""));

  const notFoundFlag = !item;

  return (
    <PageShell>
      <section className="bg-gradient-hero text-primary-foreground">
        <div className="container-page py-12 md:py-16">
          <Link
            to="/layanan"
            className="inline-flex items-center gap-1 text-sm text-white/85 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke daftar layanan
          </Link>
          {notFoundFlag ? (
            <h1 className="mt-6 text-3xl font-bold md:text-4xl">Layanan tidak ditemukan</h1>
          ) : (
            <>
              <div className="mt-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur">
                Layanan Publik
              </div>
              <h1 className="mt-3 max-w-3xl text-balance text-3xl font-bold md:text-5xl">
                {item.judul}
              </h1>
              {opd && (
                <p className="mt-4 flex items-start gap-2 text-sm text-white/85 sm:items-center">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
                  <span className="leading-relaxed">
                    Penanggung jawab: <span className="font-semibold">{opd.singkatan}</span>
                    <span className="text-white/75"> — {opd.nama}</span>
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {notFoundFlag && (
        <section className="container-page py-14">
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              Layanan dengan tautan ini tidak tersedia atau telah dinonaktifkan.
            </p>
            <Link
              to="/layanan"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Lihat semua layanan <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {item &&
        (() => {
          const berkas = parsePersyaratan(item.persyaratan);
          const langkah = parsePersyaratan(item.alur);
          return (
            <section className="container-page grid gap-6 py-12 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                {item.deskripsi && (
                  <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                    <h2 className="font-display text-lg font-bold">Tentang Layanan</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-justify">
                      {item.deskripsi}
                    </p>
                  </article>
                )}

                <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                        <FileCheck2 className="h-5 w-5 text-primary" /> Persyaratan Berkas
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Berkas berikut wajib diunggah saat mengajukan permohonan layanan ini.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="print:hidden inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-muted"
                      title="Cetak / simpan sebagai PDF"
                    >
                      <Printer className="h-3.5 w-3.5" /> Cetak Checklist
                    </button>
                  </div>

                  {berkas.length > 0 ? (
                    <ol className="mt-5 space-y-3">
                      {berkas.map((b, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
                        >
                          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                            {i + 1}
                          </span>
                          <span className="pt-1 text-sm leading-snug text-foreground">{b}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>
                        Tidak ada berkas yang harus diunggah untuk layanan ini. Anda dapat langsung
                        mengajukan permohonan.
                      </span>
                    </div>
                  )}

                  <div className="mt-5 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                    Format yang diterima: <span className="font-medium">PDF, JPG, PNG, WebP</span> ·
                    maksimal
                    <span className="font-medium"> 1 MB</span> per berkas, hingga 10 berkas.
                  </div>
                </article>

                {langkah.length > 0 && (
                  <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                      <ListOrdered className="h-5 w-5 text-primary" /> Alur Layanan
                    </h2>
                    <ol className="mt-4 space-y-3">
                      {langkah.map((s, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {i + 1}
                          </span>
                          <span className="pt-1 text-sm leading-snug">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                )}

                {(() => {
                  const std: [string, string | null | number | undefined][] = [
                    ["Dasar Hukum", item.dasar_hukum],
                    ["Biaya / Tarif", item.biaya],
                    ["Produk Layanan", item.produk_layanan],
                    ["Jam Pelayanan", item.jam_pelayanan],
                    ["Sarana & Prasarana", item.sarana_prasarana],
                    ["Kompetensi Pelaksana", item.kompetensi_pelaksana],
                    ["Jumlah Pelaksana", item.jumlah_pelaksana ?? null],
                    ["Jaminan Pelayanan", item.jaminan_pelayanan],
                    ["Jaminan Keamanan", item.jaminan_keamanan],
                    ["Mekanisme Pengaduan", item.mekanisme_pengaduan],
                    ["Evaluasi Kinerja Pelaksana", item.evaluasi_kinerja],
                  ];
                  const filled = std.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
                  if (filled.length === 0) return null;
                  return (
                    <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                        <Info className="h-5 w-5 text-primary" /> Standar Pelayanan
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Komponen standar pelayanan sesuai UU 25/2009 & PermenPAN-RB 15/2014.
                      </p>
                      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                        {filled.map(([k, v]) => (
                          <div key={k} className="rounded-lg border border-border bg-surface p-3">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                            <dd className="mt-1 whitespace-pre-line text-sm text-foreground">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  );
                })()}

                {item.maklumat_pelayanan && item.maklumat_pelayanan.trim() && (
                  <article className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-6 shadow-soft">
                    <h2 className="font-display text-lg font-bold text-primary">Maklumat Pelayanan</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                      {item.maklumat_pelayanan}
                    </p>
                  </article>
                )}

                {item.faq.length > 0 && (
                  <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                    <h2 className="font-display text-lg font-bold">Pertanyaan Umum (FAQ)</h2>
                    <div className="mt-4 divide-y divide-border">
                      {item.faq.map((f, i) => (
                        <details key={i} className="group py-3">
                          <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                            <span className="mr-2 text-primary">Q.</span>{f.q}
                          </summary>
                          <p className="mt-2 whitespace-pre-line pl-5 text-sm text-muted-foreground">{f.a}</p>
                        </details>
                      ))}
                    </div>
                  </article>
                )}
              </div>


              <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                  <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" /> Tenggat Penyelesaian (SLA)
                  </h3>
                  <p className="mt-2 font-display text-2xl font-bold text-primary">
                    {item.sla_hari} hari kerja
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tenggat dihitung otomatis sejak permohonan diverifikasi lengkap.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-elevated">
                  <h3 className="font-display text-lg font-bold">Siap mengajukan?</h3>
                  <p className="mt-2 text-sm text-primary-foreground/85">
                    Ajukan permohonan online dan pantau statusnya secara real-time.
                  </p>
                  <Link
                    to="/permohonan/baru"
                    search={{ layanan: item.slug } as never}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-md bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-white/95 transition-colors"
                  >
                    Ajukan Permohonan <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {opd && (
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      OPD Pengelola
                    </h3>
                    <p className="mt-2 font-semibold">{opd.singkatan}</p>
                    <p className="text-sm text-muted-foreground">{opd.nama}</p>
                  </div>
                )}
              </aside>
            </section>
          );
        })()}
    </PageShell>
  );
}
