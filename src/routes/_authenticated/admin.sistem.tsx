// F5.9 — Hub menu Sistem (Super Admin) — versi ringkas.
// Direstrukturisasi menjadi 2 lapis: Utama (harian) + Lanjutan (jarang dipakai).
// Menu yang duplikatif/redundan dihapus dari hub (mereka masih dapat diakses
// via menu utama masing-masing fitur, mis. Monitoring Center, Workflow, IKM).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Settings,
  Shield,
  FileClock,
  Cloud,
  HardDrive,
  Activity,
  LifeBuoy,
  AlertTriangle,
  FolderOpen,
  ListChecks,
  ScanLine,
  Server,
  MapPin,
  Palette,
  Briefcase,
  ClipboardCheck,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { SuperAdminOnly } from "@/components/admin/SuperAdminOnly";

export const Route = createFileRoute("/_authenticated/admin/sistem")({
  head: () => ({
    meta: [{ title: "Pengaturan Sistem — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <SuperAdminOnly>
        <SistemHub />
      </SuperAdminOnly>
    </AdminGuard>
  ),
});

type Item = {
  to: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Menu inti — sering dipakai admin.
const utama: Item[] = [
  {
    to: "/admin/config",
    label: "Konfigurasi Sistem",
    desc: "Mode akses menu publik, kebijakan global, dan pengaturan inti.",
    icon: Settings,
  },
  {
    to: "/admin/security/permissions",
    label: "Hak Akses Pengguna",
    desc: "Matriks permission per pengguna dan per role.",
    icon: Shield,
  },
  {
    to: "/admin/audit",
    label: "Riwayat Aktivitas",
    desc: "Audit log pengguna dan sistem dengan filter & ekspor.",
    icon: FileClock,
  },
  {
    to: "/admin/monitoring",
    label: "Monitoring Center",
    desc: "Pantau workflow, tanda tangan, dokumen, dan integrasi dalam satu tempat.",
    icon: Activity,
  },
  {
    to: "/admin/system-health",
    label: "Status Sistem",
    desc: "Cron, queue, dead-letter, dan diagnostik runtime.",
    icon: Activity,
  },
  {
    to: "/admin/storage",
    label: "File & Dokumen",
    desc: "Telusuri file pada bucket penyimpanan.",
    icon: FolderOpen,
  },
  {
    to: "/admin/backup",
    label: "Backup Data",
    desc: "Ekspor & impor data sistem.",
    icon: HardDrive,
  },
  {
    to: "/admin/branding",
    label: "Branding",
    desc: "Logo, warna, dan identitas portal.",
    icon: Palette,
  },
  {
    to: "/admin/lokasi",
    label: "Master Lokasi",
    desc: "Gedung, lantai, dan ruangan aset.",
    icon: MapPin,
  },
  {
    to: "/admin/system/jabatan-sistem",
    label: "Jabatan Sistem",
    desc: "Jabatan bawaan aplikasi yang selalu sinkron dengan master jabatan.",
    icon: Briefcase,
  },
  {
    to: "/admin/system/feature-flags",
    label: "Fitur (Feature Flags)",
    desc: "Aktif/nonaktifkan fitur tanpa redeploy.",
    icon: ListChecks,
  },
];

// Menu lanjutan — jarang dipakai, disembunyikan dalam accordion.
const lanjutan: Item[] = [
  {
    to: "/admin/system/settings",
    label: "Audit Konfigurasi",
    desc: "Riwayat perubahan pengaturan sistem.",
    icon: FileClock,
  },
  {
    to: "/admin/verifikasi-log",
    label: "Log Verifikasi",
    desc: "Jejak verifikasi akun warga dan staff.",
    icon: ScanLine,
  },
  {
    to: "/admin/system/retention",
    label: "Retensi Data",
    desc: "Kebijakan penyimpanan dan pembersihan data lama.",
    icon: Database,
  },
  {
    to: "/admin/system/storage-provider",
    label: "Penyedia Penyimpanan",
    desc: "Pilih Lovable Cloud atau Cloudflare R2.",
    icon: Cloud,
  },
  {
    to: "/admin/system/backup-status",
    label: "Status Backup",
    desc: "Pantau snapshot backup terakhir dan usianya.",
    icon: Database,
  },
  {
    to: "/admin/system/load-readiness",
    label: "Kesiapan Sistem",
    desc: "Indikator beban dan kapasitas sebelum go-live.",
    icon: Server,
  },
  {
    to: "/admin/system/disaster-recovery",
    label: "Pemulihan Sistem",
    desc: "Prosedur dan checklist disaster recovery.",
    icon: LifeBuoy,
  },
  {
    to: "/admin/system/go-live",
    label: "Go-Live Checklist",
    desc: "Kesiapan rilis ke produksi.",
    icon: AlertTriangle,
  },
  {
    to: "/admin/compliance",
    label: "Compliance Checklist",
    desc: "Item kepatuhan & audit governance.",
    icon: ClipboardCheck,
  },
];

function SistemHub() {
  const [openLanjutan, setOpenLanjutan] = useState(false);
  return (
    <AdminShell breadcrumb={[{ label: "Pengaturan Sistem" }]}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Pengaturan Sistem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Area khusus Super Admin. Menu utama untuk aktivitas harian; menu lanjutan berisi
          konfigurasi teknis yang jarang diubah.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Menu Utama
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {utama.map((it) => (
            <MenuCard key={it.to} item={it} />
          ))}
        </div>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setOpenLanjutan((v) => !v)}
          className="mb-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          aria-expanded={openLanjutan}
        >
          {openLanjutan ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Menu Lanjutan (Super Admin){" "}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {lanjutan.length}
          </span>
        </button>
        {openLanjutan && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lanjutan.map((it) => (
              <MenuCard key={it.to} item={it} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        Catatan: menu seperti Workflow Instances, Submission Tasks, IKM, Monitoring per-fitur, UAT
        Scenarios, dan Tata Kelola sudah dapat diakses langsung dari menu fitur masing-masing
        (Workflow, Layanan, Monitoring Center) sehingga tidak diduplikasi di hub ini.
      </p>
    </AdminShell>
  );
}

function MenuCard({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition hover:border-primary hover:bg-primary-soft"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-foreground">{item.label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.desc}</div>
      </div>
    </Link>
  );
}
