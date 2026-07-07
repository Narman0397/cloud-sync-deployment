// Phase 1B.2 — Properties Panel (General / Validation / Conditional / Prefill).
// Visual builder, tanpa JSON editor.
import { useState, useMemo, useEffect } from "react";
import type {
  FieldType,
  FormField,
  FieldOption,
  FieldValidation,
  VisibleIfRule,
} from "@/features/forms/schema/types";
import { isPresentationalField } from "@/features/forms/schema/types";
import { slugifyKey } from "@/features/forms/wizard/types";
import { SYSTEM_VARIABLES } from "@/features/forms/services/form-prefill.service";
import { Trash2, Plus } from "lucide-react";

type Tab = "general" | "validation" | "conditional" | "prefill";

interface Props {
  field: FormField;
  allFields: FormField[];
  onChange: (next: FormField) => void;
  onAudit?: (ev: string) => void;
  readOnly?: boolean;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "general", label: "Umum" },
  { id: "validation", label: "Aturan Pengisian" },
  { id: "conditional", label: "Kondisi Tampil" },
  { id: "prefill", label: "Isi Otomatis" },
];

export function PropertiesPanel(props: Props) {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={
              (t.id === "validation" || t.id === "conditional" || t.id === "prefill") &&
              isPresentationalField(props.field.tipe as FieldType)
            }
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === "general" && <GeneralTab {...props} />}
        {tab === "validation" && <ValidationTab {...props} />}
        {tab === "conditional" && <ConditionalTab {...props} />}
        {tab === "prefill" && <PrefillTab {...props} />}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ---------------- General ----------------
function GeneralTab({ field, onChange, readOnly }: Props) {
  const [keyTouched, setKeyTouched] = useState(false);
  const hasChoices =
    field.tipe === "dropdown" || field.tipe === "multi_select" || field.tipe === "radio";
  return (
    <div>
      <Row label="Label Isian (Pertanyaan)">
        <input
          className={inputCls}
          disabled={readOnly}
          value={field.label}
          onChange={(e) => {
            const label = e.target.value;
            const next: FormField = { ...field, label };
            if (!keyTouched && !isPresentationalField(field.tipe as FieldType)) {
              next.kode = slugifyKey(label);
            }
            onChange(next);
          }}
        />
      </Row>
      <Row label="Petunjuk Pengisian">
        <textarea
          className={`${inputCls} min-h-[60px]`}
          disabled={readOnly}
          placeholder="Bantu pengguna mengisi dengan kalimat singkat."
          value={field.help_text ?? ""}
          onChange={(e) => onChange({ ...field, help_text: e.target.value || null })}
        />
      </Row>
      {!isPresentationalField(field.tipe as FieldType) && (
        <Row label="Contoh Jawaban (placeholder)">
          <input
            className={inputCls}
            disabled={readOnly}
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ ...field, placeholder: e.target.value || null })}
          />
        </Row>
      )}
      {!isPresentationalField(field.tipe as FieldType) && (
        <div className="mt-3 flex flex-wrap gap-3">
          <Toggle
            label="Wajib diisi"
            disabled={readOnly}
            checked={field.required}
            onChange={(v) => onChange({ ...field, required: v })}
          />
        </div>
      )}
      {hasChoices && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Daftar Pilihan
          </div>
          <OptionsEditor
            options={field.options}
            disabled={readOnly}
            onChange={(opts) => onChange({ ...field, options: opts })}
          />
        </div>
      )}
      {!isPresentationalField(field.tipe as FieldType) && (
        <details className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-2">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Pengaturan Lanjutan
          </summary>
          <div className="mt-2">
            <Row label="Kode Internal (otomatis)">
              <input
                className={inputCls}
                disabled={readOnly}
                value={field.kode}
                onChange={(e) => {
                  setKeyTouched(true);
                  onChange({ ...field, kode: e.target.value.replace(/[^a-z0-9_]/g, "") });
                }}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Dipakai sistem untuk menyimpan jawaban. Biasanya tidak perlu diubah.
                Ubah sebelum form digunakan — kode ini tidak akan berubah otomatis setelah ada data masuk.
              </p>
            </Row>
          </div>
        </details>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      <span>{label}</span>
    </label>
  );
}

function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: FieldOption[];
  onChange: (opts: FieldOption[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Label"
            value={opt.label}
            disabled={disabled}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...next[i], label: e.target.value };
              if (!next[i].value) next[i].value = slugifyKey(e.target.value);
              onChange(next);
            }}
          />
          <input
            className={`${inputCls} w-24`}
            placeholder="value"
            value={opt.value}
            disabled={disabled}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...next[i], value: e.target.value.replace(/[^a-z0-9_]/g, "") };
              onChange(next);
            }}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...options, { value: `opsi_${options.length + 1}`, label: `Opsi ${options.length + 1}` }])}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Tambah Pilihan
        </button>
      )}
    </div>
  );
}

// ---------------- Validation ----------------
function ValidationTab({ field, onChange, readOnly, onAudit }: Props) {
  const v: FieldValidation = field.validation ?? {};
  function setV(patch: Partial<FieldValidation>) {
    onChange({ ...field, validation: { ...v, ...patch } });
    onAudit?.("field.update_validation");
  }
  const t = field.tipe as FieldType;
  const isText = t === "short_text" || t === "long_text" || t === "email" || t === "phone";
  const isNumber = t === "number" || t === "currency";
  const isFile = t === "file_upload";
  const isDate = t === "date" || t === "date_range";
  return (
    <div>
      {isText && (
        <>
          <Row label="Minimal Karakter">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.minLength ?? ""}
              onChange={(e) =>
                setV({ minLength: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
          <Row label="Maksimal Karakter">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.maxLength ?? ""}
              onChange={(e) =>
                setV({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
          <details className="mt-1 rounded-md border border-dashed border-border bg-muted/20 p-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
              Aturan Lanjutan
            </summary>
            <div className="mt-2">
              <Row label="Pola Karakter (regex, opsional)">
                <input
                  className={inputCls}
                  disabled={readOnly}
                  placeholder="contoh: ^[A-Z]{3}\\d{4}$"
                  value={v.pattern ?? ""}
                  onChange={(e) => setV({ pattern: e.target.value || undefined })}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Aturan lanjutan untuk membatasi format jawaban. Kosongkan jika tidak yakin.
                </p>
              </Row>
            </div>
          </details>
        </>
      )}
      {isNumber && (
        <>
          <Row label="Nilai Minimum">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.min ?? ""}
              onChange={(e) =>
                setV({ min: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
          <Row label="Nilai Maksimum">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.max ?? ""}
              onChange={(e) =>
                setV({ max: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
        </>
      )}
      {isFile && (
        <>
          <Row label="Jenis Berkas yang Diizinkan">
            <input
              className={inputCls}
              disabled={readOnly}
              placeholder="application/pdf, image/*"
              value={(v.accept ?? []).join(", ")}
              onChange={(e) =>
                setV({
                  accept: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Contoh: <code>application/pdf</code> (PDF saja) atau <code>image/*</code> (semua gambar). Pisahkan dengan koma.
            </p>
          </Row>
          <Row label="Ukuran Maksimum (MB)">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.maxSizeMb ?? ""}
              onChange={(e) =>
                setV({ maxSizeMb: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
        </>
      )}
      {isDate && (
        <p className="text-xs text-muted-foreground">
          Batas tanggal awal/akhir akan diperiksa saat pengguna mengisi formulir.
        </p>
      )}
      {!isText && !isNumber && !isFile && !isDate && (
        <p className="text-xs text-muted-foreground">
          Tipe ini tidak memerlukan aturan pengisian tambahan.
        </p>
      )}
    </div>
  );
}

// ---------------- Conditional Logic ----------------
const COND_OPS: Array<{ value: VisibleIfRule extends infer R ? (R extends { op: infer O } ? O : never) : never; label: string }> = [
  { value: "eq" as const, label: "sama dengan" },
  { value: "neq" as const, label: "tidak sama dengan" },
  { value: "contains" as const, label: "mengandung" },
  { value: "not_contains" as const, label: "tidak mengandung" },
  { value: "gt" as const, label: "lebih dari" },
  { value: "gte" as const, label: "lebih dari atau sama" },
  { value: "lt" as const, label: "kurang dari" },
  { value: "lte" as const, label: "kurang dari atau sama" },
  { value: "filled" as const, label: "sudah diisi" },
  { value: "empty" as const, label: "belum diisi" },
];

function ConditionalTab({ field, allFields, onChange, readOnly, onAudit }: Props) {
  const others = useMemo(
    () =>
      allFields.filter(
        (f) => f.kode !== field.kode && !isPresentationalField(f.tipe as FieldType),
      ),
    [allFields, field.kode],
  );
  const rule = field.visible_if;
  const enabled = !!rule;

  function setRule(next: VisibleIfRule) {
    onChange({ ...field, visible_if: next });
    onAudit?.("field.update_conditional");
  }

  return (
    <div>
      <Toggle
        label="Tampilkan isian ini hanya jika syarat berikut terpenuhi"
        disabled={readOnly}
        checked={enabled}
        onChange={(v) =>
          setRule(v ? { field: others[0]?.kode ?? "", op: "eq", value: "" } : null)
        }
      />
      {enabled && rule && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tampilkan ketika
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className={`${inputCls} w-auto`}
              disabled={readOnly}
              value={rule.field}
              onChange={(e) => setRule({ ...rule, field: e.target.value })}
            >
              {others.map((o) => (
                <option key={o.kode} value={o.kode}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className={`${inputCls} w-auto`}
              disabled={readOnly}
              value={rule.op}
              onChange={(e) =>
                setRule({ ...rule, op: e.target.value as NonNullable<VisibleIfRule>["op"] })
              }
            >
              {COND_OPS.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
            {rule.op !== "filled" && rule.op !== "empty" && (
              <input
                className={`${inputCls} w-auto flex-1`}
                placeholder="Nilai pembanding"
                disabled={readOnly}
                value={Array.isArray(rule.value) ? rule.value.join(",") : (rule.value ?? "")}
                onChange={(e) => setRule({ ...rule, value: e.target.value })}
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Aksi: <strong>Tampilkan isian ini</strong> bila syarat terpenuhi.
          </p>
        </div>
      )}
      {!enabled && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tidak ada aturan — isian ini selalu ditampilkan.
        </p>
      )}
    </div>
  );
}

// ---------------- Prefill (per-field) ----------------
function PrefillTab({ field, onChange, readOnly }: Props) {
  const [current, setCurrent] = useState<string>("");
  useEffect(() => setCurrent(""), [field.kode]);
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Isian ini bisa otomatis terisi dari profil pengguna (mis. nama, NIK). Pemetaan ini
        disimpan di pengaturan form — ringkasannya muncul di langkah "Tinjau".
      </p>
      <Row label="Variabel Sistem (data otomatis)">
        <select
          className={inputCls}
          disabled={readOnly}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        >
          <option value="">— Tidak ada —</option>
          {SYSTEM_VARIABLES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Row>
      {current && (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            onChange({ ...field, placeholder: `{{${current}}}` });
          }}
          className="mt-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Jadikan isi otomatis
        </button>
      )}
    </div>
  );
}
