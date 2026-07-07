// Visual progress bar untuk status permohonan.
// Alur normal: baru → diproses → menunggu_dokumen (opsional) → selesai
// Alur alternatif: ditolak / dibatalkan (ditampilkan sebagai terminal negatif)
import { Check, X, Clock } from "lucide-react";

const STEPS = [
  { key: "baru", label: "Diterima" },
  { key: "diproses", label: "Diverifikasi" },
  { key: "menunggu_dokumen", label: "Menunggu Berkas" },
  { key: "selesai", label: "Selesai" },
] as const;

export function PermohonanProgressBar({ status }: { status: string }) {
  const isTerminalNegative = status === "ditolak" || status === "dibatalkan";
  const activeIdx = STEPS.findIndex((s) => s.key === status);
  const currentIdx = isTerminalNegative ? -1 : activeIdx >= 0 ? activeIdx : 0;

  if (isTerminalNegative) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <X className="h-5 w-5" />
        <div>
          <p className="text-sm font-semibold">
            {status === "ditolak" ? "Permohonan ditolak" : "Permohonan dibatalkan"}
          </p>
          <p className="text-xs">Silakan lihat catatan admin di bawah untuk informasi lanjutan.</p>
        </div>
      </div>
    );
  }

  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = i < currentIdx || status === "selesai";
        const current = i === currentIdx && status !== "selesai";
        return (
          <li key={step.key} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : current
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : current ? <Clock className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${
                  done || current ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded ${
                  i < currentIdx || status === "selesai" ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
