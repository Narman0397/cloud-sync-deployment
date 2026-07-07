import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { WorkQueueCards } from "@/features/document-center/components/WorkQueueCards";
import { dcInboxList, type InboxBucket } from "@/lib/document-center.functions";
import { Eye, PenLine, RotateCcw, AlertTriangle, Clock, ShieldAlert, Search, X } from "lucide-react";

type Search = { bucket?: string; q?: string };

const BUCKETS: { key: InboxBucket; label: string; icon: typeof Eye }[] = [
  { key: "pending_review", label: "Menunggu review", icon: Eye },
  { key: "pending_signature", label: "Tanda tangan saya", icon: PenLine },
  { key: "needs_revision", label: "Perlu revisi", icon: RotateCcw },
  { key: "failed", label: "Gagal", icon: AlertTriangle },
  { key: "overdue_sla", label: "Lewat SLA", icon: Clock },
  { key: "expiring_certs", label: "Sertifikat kedaluwarsa", icon: ShieldAlert },
];

export const Route = createFileRoute("/_authenticated/admin/document-center/inbox")({
  head: () => ({ meta: [{ title: "Kotak Tugas — Document Center" }] }),
  validateSearch: (raw: Record<string, unknown>): Search => ({
    bucket: typeof raw.bucket === "string" ? raw.bucket : undefined,
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
  component: InboxPage,
});

function InboxPage() {
  const search = Route.useSearch();
  const initial = (BUCKETS.find((b) => b.key === search.bucket)?.key ?? "pending_review") as InboxBucket;
  const [bucket, setBucket] = useState<InboxBucket>(initial);
  const [query, setQuery] = useState<string>(search.q ?? "");
  const fn = useServerFn(dcInboxList);

  const activeQuery = useQuery({
    queryKey: ["dc", "inbox-list", bucket],
    queryFn: () => fn({ data: { bucket, limit: 100 } }),
  });

  // Prefetch counts for every bucket (badge on tabs). Cached separately.
  const counts = useQueries({
    queries: BUCKETS.map((b) => ({
      queryKey: ["dc", "inbox-count", b.key],
      queryFn: () => fn({ data: { bucket: b.key, limit: 200 } }).then((r) => r.length),
      staleTime: 30_000,
    })),
  });

  const items = activeQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.title} ${it.subtitle ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  return (
    <div className="space-y-4">
      <WorkQueueCards />

      <div className="rounded-xl border border-border bg-card">
        <div
          role="tablist"
          aria-label="Kategori tugas"
          className="flex flex-wrap gap-1 border-b border-border p-2"
        >
          {BUCKETS.map((b, i) => {
            const active = b.key === bucket;
            const Icon = b.icon;
            const count = counts[i]?.data ?? null;
            return (
              <button
                key={b.key}
                role="tab"
                aria-selected={active}
                aria-label={`${b.label}${count != null ? `, ${count} item` : ""}`}
                onClick={() => setBucket(b.key)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span>{b.label}</span>
                {count != null && (
                  <span
                    className={`ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari dalam daftar…"
              aria-label="Cari tugas dalam kategori aktif"
              className="h-11 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Bersihkan pencarian"
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-border" role="list">
          {activeQuery.isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">Memuat…</div>
          )}
          {!activeQuery.isLoading && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Tidak ada tugas pada kategori ini."
                : `Tidak ada hasil untuk "${query}".`}
            </div>
          )}
          {filtered.map((item) => (
            <Link
              key={item.id}
              to={item.ref}
              role="listitem"
              className="flex min-h-14 items-center justify-between gap-3 p-3 text-sm hover:bg-muted/30 focus:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{item.title}</div>
                {item.subtitle && (
                  <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {new Date(item.when).toLocaleString("id-ID")}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
