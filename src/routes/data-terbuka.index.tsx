// Portal Data Terbuka: katalog form publik (status=published & is_public=true).
// Mendukung pencarian client-side, filter OPD, dan skeleton saat memuat.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { searchPublicForms } from "@/lib/forms-extras.functions";
import { Database, ChevronRight, Search, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/data-terbuka/")({
  head: () => ({
    meta: [
      { title: "Data Terbuka — Portal Pemerintah" },
      {
        name: "description",
        content: "Katalog formulir dan dataset publik yang dibuka oleh pemerintah daerah.",
      },
    ],
  }),
  component: PublicDataPage,
});

type Row = {
  id: string;
  judul: string;
  deskripsi: string | null;
  slug: string | null;
  published_at: string | null;
  opd: { nama: string; singkatan: string | null } | null;
};

function PublicDataPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [opdFilter, setOpdFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    let m = true;
    setBusy(true);
    const t = setTimeout(() => {
      searchPublicForms({ data: { q, opd: opdFilter, page, pageSize } })
        .then((r) => {
          if (!m) return;
          const res = r as unknown as { rows: Row[]; total: number };
          setRows(res.rows);
          setTotal(res.total);
        })
        .catch(() => void 0)
        .finally(() => {
          if (m) setBusy(false);
        });
    }, 250); // debounce
    return () => {
      m = false;
      clearTimeout(t);
    };
  }, [q, opdFilter, page]);

  // Reset ke halaman 1 saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [q, opdFilter]);

  const opds = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      const key = r.opd?.singkatan ?? r.opd?.nama ?? "";
      if (key) set.set(key, key);
    });
    return Array.from(set.keys()).sort();
  }, [rows]);

  const filtered = rows;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-foreground">Data Terbuka</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Formulir dan dataset publik yang dipublikasikan oleh OPD untuk dimanfaatkan masyarakat.
          </p>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul, deskripsi, atau OPD…"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm"
              aria-label="Cari data terbuka"
            />
          </div>
          {opds.length > 0 && (
            <select
              value={opdFilter}
              onChange={(e) => setOpdFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm sm:w-48"
              aria-label="Filter OPD"
            >
              <option value="">Semua OPD</option>
              {opds.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Hasil */}
        {busy && (
          <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </ul>
        )}
        {!busy && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "Belum ada dataset publik. Pantau halaman ini secara berkala."
              : "Tidak ada hasil yang cocok dengan pencarian Anda."}
          </div>
        )}
        {!busy && filtered.length > 0 && (
          <>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Menampilkan {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + filtered.length}{" "}
                dari {total} dataset
              </span>
              <span>
                Halaman {page} / {totalPages}
              </span>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/data-terbuka/$slug"
                    params={{ slug: r.slug ?? r.id }}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-soft"
                  >
                    <div className="rounded-lg bg-gradient-primary p-2 text-primary-foreground">
                      <Database className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {r.opd?.singkatan ?? r.opd?.nama ?? "Pemerintah Daerah"}
                      </div>
                      <div className="font-semibold text-foreground group-hover:text-primary">
                        {r.judul}
                      </div>
                      {r.deskripsi && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {r.deskripsi}
                        </p>
                      )}
                      {r.published_at && (
                        <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Dipublikasi {new Date(r.published_at).toLocaleDateString("id-ID")}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <nav
              className="mt-4 flex items-center justify-center gap-2"
              aria-label="Navigasi halaman"
            >
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" /> Sebelumnya
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Halaman berikutnya"
              >
                Berikutnya <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
