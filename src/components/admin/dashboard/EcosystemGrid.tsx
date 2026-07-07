// Zona C — 5 Ekosistem Portal sebagai kartu padat-data.
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  Boxes,
  Building2,
  Database,
  Inbox,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type EcoMetric = { label: string; value: string | number; tone?: "ok" | "warn" | "crit" };
export type EcoShortcut = { label: string; to: string };
export type EcoSpark = { value: number };

export type EcosystemCardProps = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  metrics: EcoMetric[];
  shortcuts: EcoShortcut[];
  spark?: EcoSpark[];
  accent: "primary" | "accent" | "gold" | "success" | "destructive";
  primaryTo: string;
};

const accentMap = {
  primary: {
    badge: "bg-primary/15 text-primary",
    bar: "from-primary/20 to-primary/0",
    stroke: "oklch(0.55 0.16 258)",
  },
  accent: {
    badge: "bg-accent/15 text-accent",
    bar: "from-accent/20 to-accent/0",
    stroke: "oklch(0.62 0.18 200)",
  },
  gold: {
    badge: "bg-gold/20 text-gold-foreground",
    bar: "from-gold/25 to-gold/0",
    stroke: "oklch(0.78 0.14 85)",
  },
  success: {
    badge: "bg-success/15 text-success",
    bar: "from-success/20 to-success/0",
    stroke: "oklch(0.62 0.14 155)",
  },
  destructive: {
    badge: "bg-destructive/15 text-destructive",
    bar: "from-destructive/20 to-destructive/0",
    stroke: "oklch(0.62 0.20 25)",
  },
} as const;

export function EcosystemCard(p: EcosystemCardProps) {
  const a = accentMap[p.accent];
  return (
    <article className="group flex h-full flex-col rounded-xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated">
      <header className="flex items-start gap-3 p-4">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${a.badge}`}>
          <p.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold text-foreground">{p.title}</h3>
          <p className="line-clamp-2 text-[11px] text-muted-foreground">{p.subtitle}</p>
        </div>
        <Link
          to={p.primaryTo}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
          aria-label={`Buka ${p.title}`}
        >
          Buka <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2 px-4">
        {p.metrics.map((m) => (
          <div key={m.label} className="rounded-lg bg-surface p-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {m.label}
            </div>
            <div
              className={`mt-0.5 font-display text-lg font-bold ${
                m.tone === "crit"
                  ? "text-destructive"
                  : m.tone === "warn"
                    ? "text-gold-foreground"
                    : m.tone === "ok"
                      ? "text-success"
                      : "text-foreground"
              }`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {p.spark && p.spark.length > 0 && (
        <div className="mt-3 h-14 w-full px-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={p.spark} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id={`sp-${p.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={a.stroke} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={a.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={a.stroke}
                strokeWidth={1.5}
                fill={`url(#sp-${p.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <footer className="mt-auto flex flex-wrap gap-1.5 border-t border-border p-3">
        {p.shortcuts.map((s) => (
          <Link
            key={s.to + s.label}
            to={s.to}
            className="rounded-md bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-primary-soft hover:text-primary"
          >
            {s.label}
          </Link>
        ))}
      </footer>
    </article>
  );
}

export type EcosystemData = {
  layananSpark: EcoSpark[];
  layanan: { total: number; today: number; slaOnTime: number | null; rating: number | null };
  kinerjaOpd: { opdAktif: number; pejabat: number; backlogTopName: string | null; backlogTopCount: number };
  data: { datasetAktif: number; submission: number; review: number };
  asn: { totalAsn: number; hadirHariIni: number | null; izinPending: number };
  aset: { totalAset: number; opnameAktif: number; warrantyExp: number };
};

export function EcosystemGrid(d: EcosystemData) {
  const cards: EcosystemCardProps[] = [
    {
      id: "layanan",
      title: "Pelayanan Publik",
      subtitle: "Permohonan warga, layanan OPD, pengaduan & rating.",
      icon: Inbox,
      accent: "primary",
      primaryTo: "/admin",
      spark: d.layananSpark,
      metrics: [
        { label: "Total", value: d.layanan.total },
        { label: "Hari Ini", value: d.layanan.today },
        {
          label: "SLA On-time",
          value: d.layanan.slaOnTime != null ? `${d.layanan.slaOnTime}%` : "—",
          tone:
            d.layanan.slaOnTime == null
              ? undefined
              : d.layanan.slaOnTime >= 80
                ? "ok"
                : d.layanan.slaOnTime >= 50
                  ? "warn"
                  : "crit",
        },
        {
          label: "Rating",
          value: d.layanan.rating != null ? d.layanan.rating.toFixed(1) : "—",
        },
      ],
      shortcuts: [
        { label: "Permohonan", to: "/admin" },
        { label: "Layanan", to: "/admin/layanan" },
        { label: "Pengaduan", to: "/admin/laporan" },
        { label: "Rating", to: "/admin/rating" },
      ],
    },
    {
      id: "kinerja",
      title: "Kinerja OPD",
      subtitle: "Pantau performa OPD, pejabat & evaluasi layanan.",
      icon: Building2,
      accent: "gold",
      primaryTo: "/kinerja-opd",
      metrics: [
        { label: "OPD Aktif", value: d.kinerjaOpd.opdAktif },
        { label: "Pejabat", value: d.kinerjaOpd.pejabat },
        {
          label: "Top Backlog",
          value: d.kinerjaOpd.backlogTopName ?? "—",
        },
        {
          label: "Antri",
          value: d.kinerjaOpd.backlogTopCount,
          tone: d.kinerjaOpd.backlogTopCount > 20 ? "warn" : undefined,
        },
      ],
      shortcuts: [
        { label: "Kinerja OPD", to: "/kinerja-opd" },
        { label: "Daftar OPD", to: "/admin/opd" },
        { label: "Pejabat", to: "/admin/pejabat" },
      ],
    },
    {
      id: "data",
      title: "Berbagi Data",
      subtitle: "Dataset terbuka, pengisian template & review.",
      icon: Database,
      accent: "accent",
      primaryTo: "/admin/dataset",
      metrics: [
        { label: "Template Aktif", value: d.data.datasetAktif },
        { label: "Pengisian", value: d.data.submission },
        {
          label: "Menunggu Review",
          value: d.data.review,
          tone: d.data.review > 0 ? "warn" : undefined,
        },
        { label: "Portal", value: "Data Terbuka" },
      ],
      shortcuts: [
        { label: "Dataset", to: "/admin/dataset" },
        { label: "Review", to: "/admin/dataset/review" },
        { label: "Data Terbuka", to: "/data-terbuka" },
      ],
    },
    {
      id: "asn",
      title: "Manajemen ASN",
      subtitle: "Data pegawai, kehadiran, izin/cuti & kepatuhan.",
      icon: Users,
      accent: "success",
      primaryTo: "/admin/asn",
      metrics: [
        { label: "Total ASN", value: d.asn.totalAsn },
        {
          label: "Hadir Hari Ini",
          value: d.asn.hadirHariIni != null ? d.asn.hadirHariIni : "—",
        },
        {
          label: "Izin Pending",
          value: d.asn.izinPending,
          tone: d.asn.izinPending > 0 ? "warn" : undefined,
        },
        { label: "Kepatuhan", value: "Pantau" },
      ],
      shortcuts: [
        { label: "Data ASN", to: "/admin/asn" },
        { label: "Kepatuhan", to: "/admin/asn-kepatuhan" },
        { label: "Izin/Cuti", to: "/admin/izin" },
      ],
    },
    {
      id: "aset",
      title: "Manajemen Aset",
      subtitle: "Aset pemda, KIB, opname & pemeliharaan.",
      icon: Boxes,
      accent: "destructive",
      primaryTo: "/admin/aset",
      metrics: [
        { label: "Total Aset", value: d.aset.totalAset },
        {
          label: "Opname Aktif",
          value: d.aset.opnameAktif,
          tone: d.aset.opnameAktif > 0 ? "warn" : undefined,
        },
        {
          label: "Warranty < 30h",
          value: d.aset.warrantyExp,
          tone: d.aset.warrantyExp > 0 ? "crit" : undefined,
        },
        { label: "Modul", value: "KIB · BAST" },
      ],
      shortcuts: [
        { label: "Data Aset", to: "/admin/aset" },
        { label: "KIB", to: "/admin/aset/kib" },
        { label: "Opname", to: "/admin/aset/opname" },
      ],
    },
  ];

  return (
    <section aria-labelledby="eco-title" className="mb-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="eco-title" className="font-display text-base font-bold text-foreground">
            5 Ekosistem Portal
          </h2>
          <p className="text-xs text-muted-foreground">
            Ringkasan tiap modul. Klik kartu atau shortcut untuk masuk.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {cards.map((c) => (
          <EcosystemCard key={c.id} {...c} />
        ))}
      </div>
    </section>
  );
}
