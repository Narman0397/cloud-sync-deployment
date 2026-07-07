// AdminShell sekarang menampilkan OPD aktif berdasarkan profil admin yang login
// (super admin bisa pilih OPD untuk preview). Navigasi diperluas ke halaman baru
// dan ditampilkan sebagai drawer pada perangkat mobile (Android).
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Inbox,
  Users,
  FileClock,
  Database as DbIcon,
  ChevronRight,
  LogOut,
  Building2,
  Newspaper,
  UserSquare2,
  Star,
  MessageSquare,
  ListChecks,
  ScanLine,
  MapPin,
  Menu,
  X,
  Boxes,
  Hash,
  FileSignature,
  FileText,
  ShieldCheck,
  Search,
} from "lucide-react";

import lambang from "@/assets/lambang.png";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useSiteBranding } from "@/lib/site-settings";
import { RoleBadge } from "@/features/rbac";
import type { Permission } from "@/features/rbac";
import type { AppRole as RbacRole } from "@/features/rbac/constants";

type Opd = { id: string; nama: string; singkatan: string };

// Struktur nav: dapat dibatasi via `permission` (granular) atau `anyRole` (fallback).
type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hash?: string;
  permission?: Permission;
  anyRole?: RbacRole[];
};

const baseNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin", label: "Permohonan", icon: Inbox, hash: "tabel" },
  { to: "/admin/form-builder", label: "Form Builder", icon: FileClock },
  { to: "/admin/submission-review", label: "Review Submission", icon: ListChecks },
  { to: "/admin/laporan", label: "Laporan Masyarakat", icon: MessageSquare },
  { to: "/admin/layanan", label: "Layanan OPD", icon: ListChecks },
];
// Admin desa: hanya Dashboard & Verifikasi (lihat riwayat ada di halaman verifikasi)
const desaBaseNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/verifikasi", label: "Verifikasi Akun", icon: ScanLine },
];
// Admin Pemda: monitoring lintas-OPD, audit, dan persetujuan
const pemdaNav: NavItem[] = [
  { to: "/pemda", label: "Dashboard Pemda", icon: LayoutDashboard },
  { to: "/executive", label: "Dashboard Pimpinan", icon: LayoutDashboard },
  { to: "/admin/layanan", label: "Monitoring Layanan", icon: ListChecks },
  { to: "/admin/laporan", label: "Pengaduan Masyarakat", icon: MessageSquare },
  { to: "/admin/asn-kepatuhan", label: "Kepatuhan Absensi", icon: ScanLine },
  { to: "/admin/aset", label: "Aset Pemda", icon: Boxes },
  {
    to: "/admin/audit",
    label: "Riwayat Audit",
    icon: FileClock,
    permission: "can_view_audit_logs",
  },
];


// Pimpinan Daerah: read-only dashboard. Bupati mendapat tambahan link approval/disposisi.
const pimpinanNav: NavItem[] = [
  { to: "/executive", label: "Dashboard Eksekutif", icon: LayoutDashboard },
  { to: "/kinerja-opd", label: "Kinerja OPD", icon: ListChecks },
];
const bupatiExtraNav: NavItem[] = [
  {
    to: "/admin/document-center/signature",
    label: "Tanda Tangan Digital",
    icon: ShieldCheck,
    permission: "executive.sign",
  },
];

// Admin BKPSDM: fokus kepegawaian, RBAC, jabatan, kepatuhan ASN lintas-OPD.
const bkpsdmNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Pengguna", icon: Users },
  { to: "/admin/asn", label: "Data ASN", icon: Users },
  { to: "/admin/asn-kepatuhan", label: "Kepatuhan Kehadiran", icon: FileClock },
  { to: "/admin/izin", label: "Persetujuan Izin/Cuti", icon: ListChecks },
  { to: "/admin/master-jabatan", label: "Master Jabatan", icon: ListChecks },
  { to: "/admin/pejabat", label: "Pejabat", icon: UserSquare2 },
  { to: "/admin/opd", label: "Daftar OPD", icon: Building2 },
  { to: "/admin/approvals", label: "Persetujuan Akun", icon: ShieldCheck },
  { to: "/admin/sistem", label: "Pengaturan Sistem", icon: ShieldCheck },
  { to: "/admin/security/permissions", label: "Pengaturan: Permission (RBAC)", icon: ShieldCheck },
];

// Kepala BKPSDM: view eksekutif kepegawaian (read-only).
const kepalaBkpsdmNav: NavItem[] = [
  { to: "/executive", label: "Dashboard Eksekutif", icon: LayoutDashboard },
  { to: "/admin/asn", label: "Data ASN", icon: Users },
  { to: "/admin/asn-kepatuhan", label: "Kepatuhan Kehadiran", icon: FileClock },
  { to: "/admin/izin", label: "Izin/Cuti", icon: ListChecks },
  { to: "/admin/pejabat", label: "Pejabat", icon: UserSquare2 },
];

// Sidebar Super Admin diorganisir mengikuti 5 ekosistem portal + grup pendukung.
// Semua route existing tetap dipertahankan, hanya dikelompokkan & dilabeli ulang
// supaya pengguna baru langsung paham peta navigasinya.
type NavGroup = {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  items: NavItem[];
};

const superNavGroups: NavGroup[] = [
  {
    title: "⭐ Document Center",
    hint: "Hub terpadu dokumen & tanda tangan — draft → review → TTD → arsip.",
    items: [
      { to: "/admin/document-center", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin/document-center/inbox", label: "Kotak Tugas", icon: Inbox },
      { to: "/admin/document-center/lifecycle", label: "Siklus Hidup (Kanban)", icon: FileClock },
      { to: "/admin/document-center/documents", label: "Semua Dokumen", icon: FileText },
      { to: "/admin/document-center/signature/queue", label: "Antrian Tanda Tangan", icon: FileSignature },
      { to: "/admin/document-center/signature/monitoring", label: "Monitoring TTE", icon: ShieldCheck },
    ],
  },
  {
    title: "Ringkasan",
    hint: "Tiga sudut pandang: operasional admin, lintas-OPD, dan eksekutif.",

    items: [
      { to: "/admin", label: "Command Center", icon: LayoutDashboard },
      { to: "/pemda", label: "Dashboard Pemda", icon: LayoutDashboard },
      { to: "/executive", label: "Dashboard Pimpinan", icon: LayoutDashboard },
    ],
  },
  {
    title: "1. Pelayanan Publik",
    hint: "Permohonan warga, layanan OPD, pengaduan & rating.",
    
    items: [
      { to: "/admin/permohonan", label: "Permohonan", icon: Inbox },
      { to: "/admin/layanan", label: "Jenis Layanan", icon: ListChecks },
      { to: "/admin/laporan", label: "Pengaduan Masyarakat", icon: MessageSquare },
      { to: "/admin/rating", label: "Rating & Evaluasi", icon: Star },
    ],
  },
  {
    title: "2. Kinerja OPD",
    hint: "Pantau performa OPD, pejabat, dan struktur organisasi.",
    items: [
      { to: "/kinerja-opd", label: "Kinerja OPD", icon: ListChecks },
      { to: "/admin/opd", label: "Daftar OPD", icon: Building2 },
      { to: "/admin/desa", label: "Desa", icon: MapPin },
      { to: "/admin/pejabat", label: "Pejabat", icon: UserSquare2 },
      { to: "/admin/master-jabatan", label: "Master Jabatan", icon: ListChecks },
    ],
  },
  {
    title: "3. Berbagi Data",
    hint: "Form, builder, review submission & portal data terbuka.",
    items: [
      { to: "/admin/forms", label: "Forms", icon: FileText },
      { to: "/admin/form-builder", label: "Form Builder", icon: FileClock },
      { to: "/admin/submission-review", label: "Review Submission", icon: ListChecks },
      { to: "/data-terbuka", label: "Portal Data Terbuka", icon: DbIcon },
    ],
  },
  {
    title: "4. Manajemen ASN",
    hint: "Data pegawai, kehadiran, izin, dan kepatuhan ASN.",
    items: [
      { to: "/admin/asn", label: "Data ASN", icon: Users },
      { to: "/admin/asn-kepatuhan", label: "Kepatuhan Kehadiran", icon: FileClock },
      { to: "/admin/izin", label: "Persetujuan Izin/Cuti", icon: ListChecks },
      { to: "/admin/hari-libur", label: "Hari Libur", icon: FileClock },
    ],
  },
  {
    title: "5. Manajemen Aset",
    hint: "Aset pemda, kampanye, mutasi & pemeliharaan.",
    items: [
      { to: "/admin/aset", label: "Data Aset", icon: Boxes },
      { to: "/admin/aset-kampanye", label: "Kampanye Aset", icon: ListChecks },
      { to: "/admin/aset-extra", label: "Mutasi & Pemeliharaan", icon: ListChecks },
    ],
  },
  {
    title: "Dokumen & Tanda Tangan — Pengaturan",
    hint: "Pengaturan template, penomoran, dan provider TTE.",
    items: [
      { to: "/admin/document-center/templates", label: "Template Dokumen", icon: FileText },
      { to: "/admin/document-center/numbering", label: "Nomor Surat", icon: Hash },
      { to: "/admin/document-center/signature/providers", label: "Provider TTE", icon: ShieldCheck },
      { to: "/admin/document-center/panduan", label: "Panduan TTE", icon: ShieldCheck },
    ],
  },
  {
    title: "Pengguna & Akses",
    hint: "Pengguna, persetujuan akun, dan verifikasi warga.",
    items: [
      { to: "/admin/users", label: "Pengguna", icon: Users },
      { to: "/admin/approvals", label: "Persetujuan Akun", icon: ShieldCheck },
      { to: "/admin/verifikasi", label: "Verifikasi (QR)", icon: ScanLine },
      { to: "/admin/verifikasi-log", label: "Log Verifikasi", icon: ShieldCheck },
    ],
  },
  {
    title: "Konten & Branding",
    hint: "Berita, halaman, dan identitas portal.",
    items: [
      { to: "/admin/cms", label: "Berita & Halaman", icon: Newspaper },
    ],
  },
  {
    title: "Pengaturan",
    hint: "Audit, governance, monitoring, backup, hak akses, dan pengaturan teknis.",
    items: [
      { to: "/admin/sistem", label: "Pengaturan Sistem", icon: ShieldCheck },
      { to: "/admin/security/permissions", label: "Permission (RBAC)", icon: ShieldCheck },
      { to: "/admin/monitoring", label: "Monitoring Center", icon: LayoutDashboard },
    ],
  },
];



export function AdminShell({
  children,
  breadcrumb,
  opdAktifId,
  onChangeOpd,
}: {
  children: ReactNode;
  breadcrumb?: { label: string; to?: string }[];
  opdAktifId?: string;
  onChangeOpd?: (id: string) => void;
}) {
  const {
    isSuperAdmin,
    isAdminDesa,
    isAdminPemda,
    isAdminOpd,
    can,
    signOut,
    isPimpinan,
    isBupati,
    isAdminBkpsdm,
    isKepalaBkpsdm,
  } = useAuth();
  const [opdList, setOpdList] = useState<Opd[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const branding = useSiteBranding();

  useEffect(() => {
    supabase
      .from("opd")
      .select("id,nama,singkatan")
      .order("nama")
      .then(({ data }) => {
        setOpdList((data ?? []) as Opd[]);
      });
  }, []);

  // Kunci scroll saat drawer mobile terbuka.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const opd = opdList.find((o) => o.id === opdAktifId);
  // Pemilihan nav cerdas: super_admin pakai superNavGroups saja (tanpa baseNav agar tidak duplikat).
  const rawNav: NavItem[] = isSuperAdmin
    ? []
    : isAdminBkpsdm
      ? bkpsdmNav
      : isKepalaBkpsdm
        ? kepalaBkpsdmNav
        : isPimpinan
          ? [...pimpinanNav, ...(isBupati ? bupatiExtraNav : [])]
          : isAdminPemda
            ? pemdaNav
            : isAdminDesa && !isAdminOpd
              ? desaBaseNav
              : baseNav;
  // Filter berdasarkan permission granular (super_admin selalu lolos via can()).
  const primaryNav = rawNav.filter((it) => (it.permission ? can(it.permission) : true));

  const currentRole: RbacRole | null = isSuperAdmin
    ? "super_admin"
    : isAdminBkpsdm
      ? ("admin_bkpsdm" as RbacRole)
      : isKepalaBkpsdm
        ? ("kepala_bkpsdm" as RbacRole)
        : isAdminPemda
          ? "admin_pemda"
          : isPimpinan
            ? "pimpinan"
            : isAdminOpd
              ? "admin_opd"
              : isAdminDesa
                ? "admin_desa"
                : null;

  const [navQuery, setNavQuery] = useState("");

  function NavLinks({ onItem }: { onItem?: () => void }) {
    const q = navQuery.trim().toLowerCase();
    const matches = (s: string) => !q || s.toLowerCase().includes(q);
    return (
      <nav className="px-2 space-y-1">
        {isSuperAdmin && (
          <div className="relative mb-2 px-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Cari menu…"
              className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-xs"
              aria-label="Cari menu admin"
            />
          </div>
        )}
        {primaryNav.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            activeOptions={{ exact: true }}
            onClick={onItem}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-surface-foreground hover:bg-primary-soft hover:text-primary"
            activeProps={{ className: "bg-primary-soft text-primary" }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
        {isSuperAdmin &&
          superNavGroups.map((group) => {
            const groupMatchesTitle = matches(group.title);
            const visible = group.items.filter(
              (it) => groupMatchesTitle || matches(it.label),
            );
            if (visible.length === 0) return null;
            // Selalu render grup dalam keadaan terbuka agar semua link
            // (termasuk RBAC) selalu bisa diakses tanpa harus klik summary.
            const forceOpen = true;
            return (
              <details
                key={group.title}
                open={forceOpen}
                className="group/nav my-1 rounded-md"
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-surface"
                  title={group.hint}
                >
                  <span>{group.title}</span>
                  <ChevronRight className="h-3 w-3 transition group-open/nav:rotate-90" />
                </summary>
                <div className="mt-1 space-y-0.5">
                  {visible.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={onItem}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-surface-foreground hover:bg-primary-soft hover:text-primary"
                      activeProps={{ className: "bg-primary-soft text-primary" }}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </details>
            );
          })}
      </nav>
    );
  }



  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu admin"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img
              src={branding.logo_url || lambang}
              alt=""
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="hidden sm:block leading-tight">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Admin
              </div>
              <div className="font-display text-sm font-bold">
                {branding.admin_brand_name || branding.brand_name}
              </div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {currentRole && <RoleBadge role={currentRole} className="hidden sm:inline-flex" />}
            {(isSuperAdmin || isAdminPemda) && opdList.length > 0 && onChangeOpd && (
              <>
                <label className="hidden sm:block text-xs text-muted-foreground">OPD aktif</label>
                <select
                  value={opdAktifId ?? ""}
                  onChange={(e) => onChangeOpd(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm font-medium"
                  aria-label="Pilih OPD"
                >
                  <option value="">Semua OPD</option>
                  {opdList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.singkatan}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              onClick={() => signOut()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-background h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          <div className="p-4">
            <div className="rounded-lg bg-gradient-primary p-3 text-primary-foreground shadow-soft">
              <div className="text-[10px] uppercase opacity-80">OPD</div>
              <div className="text-sm font-semibold leading-tight">{opd?.nama ?? "Semua OPD"}</div>
            </div>
          </div>
          <NavLinks />
          <div className="mt-auto p-4 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-primary">
              ← Kembali ke Portal Warga
            </Link>
          </div>
        </aside>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative h-full w-72 max-w-[85vw] flex flex-col border-r border-border bg-background shadow-elevated animate-in slide-in-from-left duration-200 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <img
                    src={branding.logo_url || lambang}
                    alt=""
                    className="h-7 w-7 object-contain"
                  />
                  <div className="leading-tight">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Admin
                    </div>
                    <div className="text-sm font-display font-bold">
                      {branding.admin_brand_name || branding.brand_name}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Tutup menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-3">
                <div className="rounded-lg bg-gradient-primary p-3 text-primary-foreground shadow-soft">
                  <div className="text-[10px] uppercase opacity-80">OPD</div>
                  <div className="text-sm font-semibold leading-tight">
                    {opd?.nama ?? "Semua OPD"}
                  </div>
                </div>
              </div>
              <NavLinks onItem={() => setMobileOpen(false)} />
              <div className="mt-auto p-4 text-xs text-muted-foreground border-t border-border">
                <Link to="/" onClick={() => setMobileOpen(false)} className="hover:text-primary">
                  ← Kembali ke Portal Warga
                </Link>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="border-b border-border bg-background/60 px-4 py-2 md:px-6">
              <nav className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link to="/admin" className="hover:text-primary">
                  Admin
                </Link>
                {breadcrumb.map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    {b.to ? (
                      <Link to={b.to} className="hover:text-primary">
                        {b.label}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{b.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
          )}
          <div className="p-4 md:p-6 animate-page-in">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: "default" | "accent" | "gold" | "success" | "destructive";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    default: "bg-primary-soft text-primary",
    accent: "bg-accent/15 text-accent",
    gold: "bg-gold/20 text-gold-foreground",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-md ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-2xl font-bold text-foreground">{value}</div>
      {delta && <div className="mt-1 text-xs text-muted-foreground">{delta}</div>}
    </div>
  );
}
