// Banner ringkas untuk Super Admin baru. Dapat di-dismiss permanen via localStorage.
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const KEY = "admin_dashboard_hint_dismissed_v1";

export function OnboardingHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShow(window.localStorage.getItem(KEY) !== "1");
  }, []);
  if (!show) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1">
        <div className="font-semibold text-foreground">Selamat datang di Command Center</div>
        <p className="text-xs text-muted-foreground">
          Strip <em>Health</em> di atas memantau kesehatan sistem. Di bawahnya:{" "}
          <strong>antrian kerja</strong> hari ini, lalu <strong>5 ekosistem portal</strong>{" "}
          (Pelayanan, Kinerja OPD, Data, ASN, Aset). Klik kartu mana pun untuk masuk ke modulnya.
        </p>
      </div>
      <button
        onClick={() => {
          window.localStorage.setItem(KEY, "1");
          setShow(false);
        }}
        aria-label="Sembunyikan tip"
        className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
