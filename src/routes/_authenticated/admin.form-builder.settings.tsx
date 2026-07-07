// Form Builder — Settings tab. Konfigurasi default form builder yang disimpan
// di app_setting (key='form_builder.settings'). Read-only untuk non super admin.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Settings as SettingsIcon, Save, Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/form-builder/settings")({
  head: () => ({
    meta: [{ title: "Settings — Form Builder" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

type FbSettings = {
  default_sla_days: number;
  autosave_interval_ms: number;
  allow_anonymous_submit: boolean;
  notify_reviewer_on_submit: boolean;
  notify_submitter_on_status_change: boolean;
  auto_version_on_publish_edit: boolean;
  max_file_size_mb: number;
  max_files_per_field: number;
};

const DEFAULTS: FbSettings = {
  default_sla_days: 7,
  autosave_interval_ms: 1000,
  allow_anonymous_submit: false,
  notify_reviewer_on_submit: true,
  notify_submitter_on_status_change: true,
  auto_version_on_publish_edit: true,
  max_file_size_mb: 10,
  max_files_per_field: 5,
};

const KEY = "form_builder.settings";

function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  const [value, setValue] = useState<FbSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_setting")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      if (cancelled) return;
      const stored = (data?.value ?? {}) as Partial<FbSettings>;
      setValue({ ...DEFAULTS, ...stored });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const { error } = await supabase
        .from("app_setting")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert({ key: KEY, value: value as any, category: "form_builder" });
      if (error) throw error;
      setSavedMsg("Tersimpan");
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (e) {
      setSavedMsg(e instanceof Error ? `Gagal: ${e.message}` : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!confirm("Reset ke nilai default?")) return;
    setValue(DEFAULTS);
  }

  if (loading) {
    return (
      <div className="grid place-items-center rounded-xl border border-border bg-card py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const disabled = !isSuperAdmin;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display text-lg font-bold">Pengaturan Form Builder</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Konfigurasi default berlaku untuk semua form baru. Form yang sudah dibuat tidak berubah.
        </p>
        {disabled && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Lock className="mt-0.5 h-3.5 w-3.5" />
            <span>Hanya Super Admin yang dapat mengubah pengaturan ini. Anda melihat dalam mode read-only.</span>
          </div>
        )}
      </div>

      <Section title="Default Form Baru" desc="Nilai awal yang otomatis terisi saat membuat form lewat wizard.">
        <NumField
          label="SLA default (hari)"
          help="Batas waktu standar untuk memproses pengajuan."
          value={value.default_sla_days}
          min={1}
          max={365}
          onChange={(n) => setValue((v) => ({ ...v, default_sla_days: n }))}
          disabled={disabled}
        />
        <ToggleField
          label="Izinkan submit anonim"
          help="Jika aktif, pemohon tidak perlu login untuk mengisi form publik."
          value={value.allow_anonymous_submit}
          onChange={(b) => setValue((v) => ({ ...v, allow_anonymous_submit: b }))}
          disabled={disabled}
        />
      </Section>

      <Section title="Notifikasi" desc="Email/notifikasi otomatis terkait submission.">
        <ToggleField
          label="Beritahu reviewer saat ada submission baru"
          value={value.notify_reviewer_on_submit}
          onChange={(b) => setValue((v) => ({ ...v, notify_reviewer_on_submit: b }))}
          disabled={disabled}
        />
        <ToggleField
          label="Beritahu pemohon saat status berubah"
          help="Diapprove, ditolak, atau diminta revisi."
          value={value.notify_submitter_on_status_change}
          onChange={(b) => setValue((v) => ({ ...v, notify_submitter_on_status_change: b }))}
          disabled={disabled}
        />
      </Section>

      <Section title="Versioning & Autosave">
        <ToggleField
          label="Auto-create version saat edit form yang sudah publish"
          help="Mencegah perubahan tidak sengaja pada form aktif."
          value={value.auto_version_on_publish_edit}
          onChange={(b) => setValue((v) => ({ ...v, auto_version_on_publish_edit: b }))}
          disabled={disabled}
        />
        <NumField
          label="Interval autosave wizard (ms)"
          help="Berapa cepat draft wizard disimpan otomatis. 500-5000 ms."
          value={value.autosave_interval_ms}
          min={500}
          max={5000}
          step={100}
          onChange={(n) => setValue((v) => ({ ...v, autosave_interval_ms: n }))}
          disabled={disabled}
        />
      </Section>

      <Section title="Batas Upload File" desc="Berlaku untuk field tipe file dan multi-file upload.">
        <NumField
          label="Ukuran maksimum per file (MB)"
          value={value.max_file_size_mb}
          min={1}
          max={50}
          onChange={(n) => setValue((v) => ({ ...v, max_file_size_mb: n }))}
          disabled={disabled}
        />
        <NumField
          label="Jumlah maksimum file per field"
          value={value.max_files_per_field}
          min={1}
          max={20}
          onChange={(n) => setValue((v) => ({ ...v, max_files_per_field: n }))}
          disabled={disabled}
        />
      </Section>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
        {savedMsg && <span className="mr-auto text-xs text-muted-foreground">{savedMsg}</span>}
        <button
          onClick={reset}
          disabled={disabled || saving}
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          Reset Default
        </button>
        <button
          onClick={() => void save()}
          disabled={disabled || saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h4 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h4>
      {desc && <p className="mb-3 text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function NumField({
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  help?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      {help && <span className="block text-xs text-muted-foreground">{help}</span>}
      <input
        type="number"
        className="mt-1 h-9 w-40 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-60"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </label>
  );
}

function ToggleField({
  label,
  help,
  value,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  value: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-primary"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help && <span className="block text-xs text-muted-foreground">{help}</span>}
      </span>
    </label>
  );
}
