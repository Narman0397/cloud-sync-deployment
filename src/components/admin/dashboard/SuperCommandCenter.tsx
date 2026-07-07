// Wrapper: kumpulan zona Command Center untuk Super Admin.
// Mengambil semua data ringkas via supabase client (count-only) + RPC ringan.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HealthBar } from "./HealthBar";
import { WorkQueueCards } from "./WorkQueueCards";
import { EcosystemGrid, type EcosystemData } from "./EcosystemGrid";
import { RecentActivityFeed, type ActivityRow } from "./RecentActivityFeed";
import { OnboardingHint } from "./OnboardingHint";

import { RefreshCw } from "lucide-react";

type SummaryShape = {
  kpi?: { baru: number; diproses: number; selesai: number; ditolak: number; total: number };
  trend?: { key: string; masuk: number; selesai: number }[];
  sla?: { nama: string; total: number; on_time: number }[];
  backlog?: { singkatan: string | null; nama: string | null; baru: number; diproses: number }[];
};

type State = {
  loaded: boolean;
  // Health
  systemScore: number | null;
  systemTone: "ok" | "warn" | "crit" | "info";
  jobsPending: number;
  jobsFailed: number;
  jobsRunning: number;
  alertsCount: number;
  backupAgeHours: number | null;
  lastActivity: string | null;
  // Work queue
  pendingApproval: number;
  pendingVerifikasi: number;
  pendingReview: number;
  pendingSignature: number;
  overdueTasks: number;
  // Ecosystem
  eco: EcosystemData;
  // Activity
  activity: ActivityRow[];
};

const emptyEco: EcosystemData = {
  layananSpark: [],
  layanan: { total: 0, today: 0, slaOnTime: null, rating: null },
  kinerjaOpd: { opdAktif: 0, pejabat: 0, backlogTopName: null, backlogTopCount: 0 },
  data: { datasetAktif: 0, submission: 0, review: 0 },
  asn: { totalAsn: 0, hadirHariIni: null, izinPending: 0 },
  aset: { totalAset: 0, opnameAktif: 0, warrantyExp: 0 },
};

export function SuperCommandCenter({ summary }: { summary: SummaryShape | undefined }) {
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [s, setS] = useState<State>({
    loaded: false,
    systemScore: null,
    systemTone: "info",
    jobsPending: 0,
    jobsFailed: 0,
    jobsRunning: 0,
    alertsCount: 0,
    backupAgeHours: null,
    lastActivity: null,
    pendingApproval: 0,
    pendingVerifikasi: 0,
    pendingReview: 0,
    pendingSignature: 0,
    overdueTasks: 0,
    eco: emptyEco,
    activity: [],
  });

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const nowIso = new Date().toISOString();

    (async () => {
      const [
        jobsPending,
        jobsFailed,
        jobsRunning,
        deadLetter,
        pendingApproval,
        pendingReview,
        pendingSignature,
        overdueTasks,
        permTotal,
        permToday,
        datasetAktif,
        datasetSubs,
        datasetReview,
        opdAktif,
        pejabatCount,
        asnTotal,
        izinPending,
        asetTotal,
        opnameAktif,
        ratingAvg,
        backupSnap,
        activity,
        absensiToday,
      ] = await Promise.all([
        supabase.from("job_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("job_queue").select("id", { count: "exact", head: true }).in("status", ["failed"]),
        supabase.from("job_queue").select("id", { count: "exact", head: true }).eq("status", "running"),
        supabase.from("dead_letter_jobs").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("form_submissions")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "under_review"]),
        supabase
          .from("signature_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "sent"]),
        supabase
          .from("submission_tasks")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "in_progress", "escalated"])
          .lt("due_at", nowIso),
        supabase.from("permohonan").select("id", { count: "exact", head: true }),
        supabase
          .from("permohonan")
          .select("id", { count: "exact", head: true })
          .gte("tanggal_masuk", todayIso),
        supabase.from("dataset_template").select("id", { count: "exact", head: true }).eq("aktif", true),
        supabase.from("dataset_submission").select("id", { count: "exact", head: true }),
        supabase
          .from("dataset_submission")
          .select("id", { count: "exact", head: true })
          .eq("review_status", "pending"),
        supabase.from("opd").select("id", { count: "exact", head: true }),
        supabase.from("pejabat").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .not("nip", "is", null),
        supabase
          .from("pengajuan_izin")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("aset").select("id", { count: "exact", head: true }),
        supabase
          .from("aset_opname")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "draft"]),
        supabase.from("permohonan_rating").select("skor"),
        supabase
          .from("backup_snapshot")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("workflow_audit_logs")
          .select("id,action,resource_type,user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("absensi_asn")
          .select("user_id", { count: "exact", head: true })
          .gte("waktu", todayIso)
          .eq("tipe", "masuk"),
      ]);

      const ratingValues = ((ratingAvg.data ?? []) as { skor: number }[])
        .map((r) => r.skor)
        .filter((n) => typeof n === "number");
      const ratingMean =
        ratingValues.length > 0
          ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
          : null;

      const backupAge = backupSnap.data?.created_at
        ? Math.round((Date.now() - new Date(backupSnap.data.created_at).getTime()) / 3_600_000)
        : null;

      const totalFailed = (jobsFailed.count ?? 0) + (deadLetter.count ?? 0);
      const alerts =
        (totalFailed > 0 ? 1 : 0) +
        ((overdueTasks.count ?? 0) > 0 ? 1 : 0) +
        ((pendingSignature.count ?? 0) > 20 ? 1 : 0);

      // Skor sistem sederhana (0-100) berbasis sinyal yang ada.
      let score = 100;
      if (totalFailed > 0) score -= Math.min(30, totalFailed * 2);
      if ((overdueTasks.count ?? 0) > 0) score -= Math.min(20, (overdueTasks.count ?? 0));
      if (backupAge != null && backupAge > 48) score -= 15;
      if (backupAge == null) score -= 5;
      score = Math.max(0, score);
      const systemTone: State["systemTone"] = score >= 85 ? "ok" : score >= 60 ? "warn" : "crit";

      setS({
        loaded: true,
        systemScore: score,
        systemTone,
        jobsPending: jobsPending.count ?? 0,
        jobsFailed: totalFailed,
        jobsRunning: jobsRunning.count ?? 0,
        alertsCount: alerts,
        backupAgeHours: backupAge,
        lastActivity: (activity.data?.[0] as ActivityRow | undefined)?.created_at ?? null,
        pendingApproval: pendingApproval.count ?? 0,
        pendingVerifikasi: pendingApproval.count ?? 0,
        pendingReview: pendingReview.count ?? 0,
        pendingSignature: pendingSignature.count ?? 0,
        overdueTasks: overdueTasks.count ?? 0,
        eco: {
          layananSpark: [],
          layanan: {
            total: permTotal.count ?? 0,
            today: permToday.count ?? 0,
            slaOnTime: null,
            rating: ratingMean,
          },
          kinerjaOpd: {
            opdAktif: opdAktif.count ?? 0,
            pejabat: pejabatCount.count ?? 0,
            backlogTopName: null,
            backlogTopCount: 0,
          },
          data: {
            datasetAktif: datasetAktif.count ?? 0,
            submission: datasetSubs.count ?? 0,
            review: datasetReview.count ?? 0,
          },
          asn: {
            totalAsn: asnTotal.count ?? 0,
            hadirHariIni: absensiToday.count ?? 0,
            izinPending: izinPending.count ?? 0,
          },
          aset: {
            totalAset: asetTotal.count ?? 0,
            opnameAktif: opnameAktif.count ?? 0,
            warrantyExp: 0,
          },
        },
        activity: (activity.data ?? []) as ActivityRow[],
      });
      setUpdatedAt(new Date());
    })().catch(() => {
      /* silent */
    });
  }, []);

  // Layer in summary RPC enrichment (sparkline, sla, top backlog).
  const eco: EcosystemData = {
    ...s.eco,
    layananSpark: summary?.trend?.map((t) => ({ value: t.masuk })) ?? [],
    layanan: {
      ...s.eco.layanan,
      slaOnTime:
        summary?.sla && summary.sla.length > 0
          ? Math.round(
              (summary.sla.reduce((a, b) => a + b.on_time, 0) /
                Math.max(
                  1,
                  summary.sla.reduce((a, b) => a + b.total, 0),
                )) *
                100,
            )
          : null,
    },
    kinerjaOpd: {
      ...s.eco.kinerjaOpd,
      backlogTopName:
        summary?.backlog && summary.backlog.length > 0
          ? (summary.backlog[0].singkatan ?? summary.backlog[0].nama ?? "—")
          : null,
      backlogTopCount:
        summary?.backlog && summary.backlog.length > 0
          ? (summary.backlog[0].baru ?? 0) + (summary.backlog[0].diproses ?? 0)
          : 0,
    },
  };

  return (
    <>
      <OnboardingHint />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>
            {updatedAt
              ? `Diperbarui ${updatedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
              : "Memuat data…"}
          </span>
        </div>
        <span className="text-[11px]">Klik kartu mana pun untuk membuka halaman terkait.</span>
      </div>

      <HealthBar
        systemTone={s.systemTone}
        systemScore={s.systemScore}
        jobsPending={s.jobsPending}
        jobsFailed={s.jobsFailed}
        jobsRunning={s.jobsRunning}
        alertsCount={s.alertsCount}
        backupAgeHours={s.backupAgeHours}
        storageUsedMb={null}
        lastActivity={s.lastActivity}
      />
      <WorkQueueCards
        pendingApproval={s.pendingApproval}
        pendingVerifikasi={s.pendingVerifikasi}
        pendingReview={s.pendingReview}
        pendingSignature={s.pendingSignature}
        overdueTasks={s.overdueTasks}
      />
      <EcosystemGrid {...eco} />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-dashed border-border bg-surface/40 p-4 text-xs text-muted-foreground">
          <div className="font-display text-sm font-semibold text-foreground">Tips Navigasi</div>
          <ul className="mt-2 space-y-1 list-disc pl-4">
            <li>Panel <strong>Skor Sistem</strong> di atas memantau kesehatan layanan secara real-time.</li>
            <li>Kartu antrian berwarna merah menandakan perlu tindakan segera.</li>
            <li>Sidebar dikelompokkan per ekosistem agar mudah ditemukan.</li>
          </ul>
        </div>
        <RecentActivityFeed rows={s.activity} />
      </div>
    </>
  );
}

export { RecentActivityFeed };

