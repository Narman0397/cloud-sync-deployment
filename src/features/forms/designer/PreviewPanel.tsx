// Phase 1B.2 — Preview Panel: render fields seperti runtime dengan
// viewport switcher (Desktop / Tablet / Mobile).
import { useState } from "react";
import type { FormField } from "@/features/forms/schema/types";
import { isFieldVisible, isPresentationalField } from "@/features/forms/schema/types";
import { Smartphone, Tablet, Monitor } from "lucide-react";

type Viewport = "desktop" | "tablet" | "mobile";

export function PreviewPanel({ fields }: { fields: FormField[] }) {
  const [vp, setVp] = useState<Viewport>("desktop");
  const [values, setValues] = useState<Record<string, string>>({});

  const widthClass =
    vp === "mobile" ? "max-w-[360px]" : vp === "tablet" ? "max-w-[640px]" : "max-w-3xl";

  return (
    <div>
      <div className="mb-2 flex items-center gap-1 rounded-md border border-border bg-card p-1 w-fit">
        <VpBtn active={vp === "desktop"} onClick={() => setVp("desktop")}>
          <Monitor className="h-3.5 w-3.5" /> Desktop
        </VpBtn>
        <VpBtn active={vp === "tablet"} onClick={() => setVp("tablet")}>
          <Tablet className="h-3.5 w-3.5" /> Tablet
        </VpBtn>
        <VpBtn active={vp === "mobile"} onClick={() => setVp("mobile")}>
          <Smartphone className="h-3.5 w-3.5" /> Mobile
        </VpBtn>
      </div>
      <div className={`mx-auto ${widthClass} rounded-lg border border-border bg-background p-4`}>
        {fields.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Belum ada field.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => {
              const visible = isFieldVisible(f, values);
              if (!visible) return null;
              return (
                <PreviewField
                  key={f.kode}
                  field={f}
                  value={values[f.kode] ?? ""}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.kode]: v }))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VpBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function PreviewField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (isPresentationalField(field.tipe)) {
    if (field.tipe === "heading") return <h3 className="font-display text-lg font-bold">{field.label}</h3>;
    if (field.tipe === "section")
      return (
        <div className="border-b border-border pb-1 pt-2">
          <h4 className="text-sm font-bold uppercase tracking-wide text-primary">{field.label}</h4>
          {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
        </div>
      );
    if (field.tipe === "divider") return <hr className="my-2 border-border" />;
  }
  const cls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {field.help_text && <p className="mb-1 text-xs text-muted-foreground">{field.help_text}</p>}
      {renderInput(field, value, onChange, cls)}
    </div>
  );
}

function renderInput(field: FormField, value: string, onChange: (v: string) => void, cls: string) {
  switch (field.tipe) {
    case "long_text":
      return (
        <textarea
          className={`${cls} min-h-[80px]`}
          placeholder={field.placeholder ?? ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
    case "currency":
      return (
        <input
          type="number"
          className={cls}
          placeholder={field.placeholder ?? ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return <input type="date" className={cls} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "date_range":
      return (
        <div className="flex items-center gap-2">
          <input type="date" className={cls} />
          <span className="text-xs text-muted-foreground">s/d</span>
          <input type="date" className={cls} />
        </div>
      );
    case "dropdown":
      return (
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— pilih —</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "multi_select":
      return (
        <select multiple className={`${cls} min-h-[80px]`}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {field.options.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1 text-sm">
              <input
                type="radio"
                name={field.kode}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
          />
          {field.placeholder ?? "Saya menyetujui"}
        </label>
      );
    case "file_upload":
      return <input type="file" className={cls} />;
    case "signature":
      return (
        <div className="grid h-24 place-items-center rounded-md border-2 border-dashed border-border text-xs text-muted-foreground">
          [ Area Tanda Tangan ]
        </div>
      );
    case "email":
      return <input type="email" className={cls} placeholder={field.placeholder ?? ""} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <input type="tel" className={cls} placeholder={field.placeholder ?? ""} value={value} onChange={(e) => onChange(e.target.value)} />;
    default:
      return (
        <input
          type="text"
          className={cls}
          placeholder={field.placeholder ?? ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
