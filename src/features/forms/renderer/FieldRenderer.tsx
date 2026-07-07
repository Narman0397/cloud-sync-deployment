import type { FormField } from "@/features/forms/schema/types";
import { FileUploader } from "./FileUploader";
import type { FileRow } from "./types";

export function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
  submissionId,
  files,
  onFilesChanged,
  error,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly: boolean;
  submissionId: string | null;
  files: FileRow[];
  onFilesChanged: () => Promise<void> | void;
  error?: string | null;
}) {
  const inputCls = `mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60 ${
    error ? "border-destructive" : "border-border"
  }`;
  const label = (
    <label htmlFor={`field-${field.kode}`} className="text-sm font-medium">
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </label>
  );
  const help = field.help_text && (
    <p id={`help-${field.kode}`} className="mt-1 text-xs text-muted-foreground">
      {field.help_text}
    </p>
  );
  const errEl = error ? (
    <p id={`err-${field.kode}`} className="mt-1 text-xs text-destructive" role="alert">
      {error}
    </p>
  ) : null;
  const ariaProps = {
    id: `field-${field.kode}`,
    "aria-describedby":
      [field.help_text ? `help-${field.kode}` : null, error ? `err-${field.kode}` : null]
        .filter(Boolean)
        .join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-required": field.required || undefined,
  } as const;

  const wrap = (inner: React.ReactNode) => (
    <div>
      {inner}
      {help}
      {errEl}
    </div>
  );

  switch (field.tipe) {
    case "heading":
      return (
        <div>
          <h3 className="font-display text-lg font-semibold">{field.label}</h3>
          {field.help_text && (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          )}
        </div>
      );
    case "section":
      return (
        <div className="border-t border-border pt-3">
          <h4 className="text-sm font-semibold uppercase text-muted-foreground">{field.label}</h4>
        </div>
      );
    case "divider":
      return <hr className="border-border" />;
    case "short_text":
    case "email":
    case "phone":
    case "nip":
    case "nik":
    case "address":
      return wrap(
        <>
          {label}
          <input
            {...ariaProps}
            type={field.tipe === "email" ? "email" : field.tipe === "phone" ? "tel" : "text"}
            inputMode={
              field.tipe === "nip" || field.tipe === "nik"
                ? "numeric"
                : field.tipe === "phone"
                  ? "tel"
                  : undefined
            }
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            placeholder={field.placeholder ?? ""}
            className={inputCls}
          />
        </>,
      );
    case "long_text":
      return wrap(
        <>
          {label}
          <textarea
            {...ariaProps}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            placeholder={field.placeholder ?? ""}
            rows={4}
            className={inputCls}
          />
        </>,
      );
    case "number":
    case "currency":
      return wrap(
        <>
          {label}
          <input
            {...ariaProps}
            type="number"
            inputMode={field.tipe === "currency" ? "decimal" : "numeric"}
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            disabled={readOnly}
            placeholder={field.tipe === "currency" ? "Rp" : (field.placeholder ?? "")}
            className={inputCls}
          />
        </>,
      );
    case "rating": {
      const max = field.validation.ratingMax ?? 5;
      const cur = Number(value ?? 0);
      return wrap(
        <>
          {label}
          <div className="mt-1 flex gap-1" role="radiogroup" aria-label={field.label}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => !readOnly && onChange(n)}
                disabled={readOnly}
                aria-checked={cur === n}
                role="radio"
                className={`h-8 w-8 rounded-md border text-sm ${
                  cur >= n ? "bg-primary text-primary-foreground" : "border-border"
                } disabled:opacity-60`}
              >
                {n}
              </button>
            ))}
          </div>
        </>,
      );
    }
    case "date":
      return wrap(
        <>
          {label}
          <input
            {...ariaProps}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            className={inputCls}
          />
        </>,
      );
    case "datetime":
      return wrap(
        <>
          {label}
          <input
            {...ariaProps}
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            className={inputCls}
          />
        </>,
      );
    case "time":
      return wrap(
        <>
          {label}
          <input
            {...ariaProps}
            type="time"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            className={inputCls}
          />
        </>,
      );
    case "date_range": {
      const r = (value as { start?: string; end?: string } | null) ?? {};
      return wrap(
        <>
          {label}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={r.start ?? ""}
              onChange={(e) => onChange({ ...r, start: e.target.value })}
              disabled={readOnly}
              className={inputCls}
              aria-label={`${field.label} mulai`}
            />
            <input
              type="date"
              value={r.end ?? ""}
              onChange={(e) => onChange({ ...r, end: e.target.value })}
              disabled={readOnly}
              className={inputCls}
              aria-label={`${field.label} selesai`}
            />
          </div>
        </>,
      );
    }
    case "dropdown":
      return wrap(
        <>
          {label}
          <select
            {...ariaProps}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            className={inputCls}
          >
            <option value="">-- pilih --</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </>,
      );
    case "multi_select": {
      const arr = (Array.isArray(value) ? value : []) as string[];
      return wrap(
        <>
          {label}
          <select
            {...ariaProps}
            multiple
            value={arr}
            onChange={(e) =>
              onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
            disabled={readOnly}
            className={`${inputCls} h-32`}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </>,
      );
    }
    case "radio":
      return wrap(
        <>
          {label}
          <div className="mt-1 space-y-1" role="radiogroup" aria-label={field.label}>
            {field.options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.kode}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                  disabled={readOnly}
                />{" "}
                {o.label}
              </label>
            ))}
          </div>
        </>,
      );
    case "checkbox": {
      const arr = (Array.isArray(value) ? value : []) as string[];
      return wrap(
        <>
          {label}
          <div className="mt-1 space-y-1">
            {field.options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={arr.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arr, o.value]
                      : arr.filter((v) => v !== o.value);
                    onChange(next);
                  }}
                  disabled={readOnly}
                />{" "}
                {o.label}
              </label>
            ))}
          </div>
        </>,
      );
    }
    case "signature":
      return wrap(
        <>
          {label}
          <textarea
            {...ariaProps}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
            placeholder="Tanda tangan / nama lengkap"
            rows={2}
            className={inputCls}
          />
        </>,
      );
    case "file_upload":
    case "multi_file_upload":
      return wrap(
        <FileUploader
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          submissionId={submissionId}
          files={files}
          onFilesChanged={onFilesChanged}
          label={label}
          help={null}
        />,
      );
    default:
      return null;
  }
}
