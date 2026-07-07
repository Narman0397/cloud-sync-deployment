import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import {
  FIELD_TYPES,
  REGEX_PRESETS,
  REGEX_PRESET_KEYS,
  isPresentationalField,
  type FormField,
} from "@/features/forms/schema/types";

const TEXTY_TYPES: ReadonlyArray<FormField["tipe"]> = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "nip",
  "nik",
  "address",
];
const NUMERIC_TYPES: ReadonlyArray<FormField["tipe"]> = [
  "number",
  "currency",
  "rating",
  "date",
  "datetime",
  "time",
];

export function FieldEditor({
  field,
  readOnly,
  allFields,
  onChange,
  onRemove,
  onDuplicate,
}: {
  field: FormField;
  readOnly: boolean;
  allFields: FormField[];
  onChange: (f: FormField) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [openAdv, setOpenAdv] = useState(false);
  const hasOptions = ["dropdown", "radio", "checkbox", "multi_select"].includes(field.tipe);
  const isText = TEXTY_TYPES.includes(field.tipe);
  const isNumber = field.tipe === "number" || field.tipe === "currency";
  const isFile = ["file_upload", "multi_file_upload"].includes(field.tipe);
  const isPresentational = isPresentationalField(field.tipe);
  const supportsCompare = NUMERIC_TYPES.includes(field.tipe) || isText;
  const supportsUnique = ["checkbox", "multi_select", "multi_file_upload"].includes(field.tipe);

  function patchValidation(patch: Partial<FormField["validation"]>) {
    onChange({ ...field, validation: { ...field.validation, ...patch } });
  }

  const v = field.validation ?? {};
  const otherFields = allFields.filter((x) => x.kode && x.kode !== field.kode);
  const refField = field.visible_if?.field
    ? allFields.find((x) => x.kode === field.visible_if!.field)
    : null;
  const refHasOptions = refField && ["dropdown", "radio", "checkbox"].includes(refField.tipe);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase text-muted-foreground">Kode</label>
          <input
            value={field.kode}
            onChange={(e) => onChange({ ...field, kode: e.target.value.toLowerCase() })}
            disabled={readOnly}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono disabled:opacity-60"
          />
        </div>
        <div className="md:col-span-4">
          <label className="text-[10px] uppercase text-muted-foreground">Label</label>
          <input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            disabled={readOnly}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase text-muted-foreground">Tipe</label>
          <select
            value={field.tipe}
            onChange={(e) => onChange({ ...field, tipe: e.target.value as FormField["tipe"] })}
            disabled={readOnly}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 flex items-end gap-1">
          {!isPresentational && (
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange({ ...field, required: e.target.checked })}
                disabled={readOnly}
              />{" "}
              Wajib
            </label>
          )}
        </div>
        {!isPresentational && (
          <div className="md:col-span-12">
            <label className="text-[10px] uppercase text-muted-foreground">
              Placeholder / Help
            </label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value || null })}
                disabled={readOnly}
                placeholder="placeholder"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
              />
              <input
                value={field.help_text ?? ""}
                onChange={(e) => onChange({ ...field, help_text: e.target.value || null })}
                disabled={readOnly}
                placeholder="help text"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-60"
              />
            </div>
          </div>
        )}
        {hasOptions && (
          <div className="md:col-span-12">
            <label className="text-[10px] uppercase text-muted-foreground">
              Opsi (satu per baris: value|label)
            </label>
            <textarea
              value={field.options.map((o) => `${o.value}|${o.label}`).join("\n")}
              onChange={(e) =>
                onChange({
                  ...field,
                  options: e.target.value
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                      const [vv, l] = line.split("|");
                      return { value: (vv ?? "").trim(), label: (l ?? vv ?? "").trim() };
                    })
                    .filter((o) => o.value),
                })
              }
              disabled={readOnly}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono disabled:opacity-60"
              placeholder="opt1|Opsi 1"
            />
          </div>
        )}
      </div>

      {!isPresentational && (
        <div className="mt-3 rounded-lg border border-dashed border-border">
          <button
            type="button"
            onClick={() => setOpenAdv((o) => !o)}
            className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {openAdv ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Aturan validasi & logika tampil
          </button>
          {openAdv && (
            <div className="space-y-3 border-t border-border bg-muted/30 p-3">
              {/* Validation rules */}
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Aturan Validasi
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {isText && (
                    <>
                      <NumInput
                        label="Min karakter"
                        value={v.minLength}
                        onChange={(n) => patchValidation({ minLength: n ?? undefined })}
                        disabled={readOnly}
                      />
                      <NumInput
                        label="Max karakter"
                        value={v.maxLength}
                        onChange={(n) => patchValidation({ maxLength: n ?? undefined })}
                        disabled={readOnly}
                      />
                      <div className="col-span-2">
                        <label className="text-[10px] uppercase text-muted-foreground">
                          Format preset
                        </label>
                        <select
                          value={v.preset ?? ""}
                          onChange={(e) =>
                            patchValidation({
                              preset: (e.target.value || undefined) as
                                | (typeof REGEX_PRESET_KEYS)[number]
                                | undefined,
                            })
                          }
                          disabled={readOnly}
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                        >
                          <option value="">— Tidak ada preset —</option>
                          {REGEX_PRESET_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {REGEX_PRESETS[k].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] uppercase text-muted-foreground">
                          Pattern (regex kustom)
                        </label>
                        <input
                          value={v.pattern ?? ""}
                          onChange={(e) =>
                            patchValidation({ pattern: e.target.value || undefined })
                          }
                          disabled={readOnly || !!v.preset}
                          placeholder={v.preset ? "—(pakai preset)" : "^[0-9]{10}$"}
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs disabled:opacity-60"
                        />
                      </div>
                    </>
                  )}
                  {isNumber && (
                    <>
                      <NumInput
                        label="Min"
                        value={v.min}
                        onChange={(n) => patchValidation({ min: n ?? undefined })}
                        disabled={readOnly}
                      />
                      <NumInput
                        label="Max"
                        value={v.max}
                        onChange={(n) => patchValidation({ max: n ?? undefined })}
                        disabled={readOnly}
                      />
                    </>
                  )}
                  {field.tipe === "rating" && (
                    <NumInput
                      label="Skala maksimum (2–10)"
                      value={v.ratingMax}
                      onChange={(n) =>
                        patchValidation({ ratingMax: n ?? undefined })
                      }
                      disabled={readOnly}
                    />
                  )}
                  {isFile && (
                    <>
                      <NumInput
                        label="Max ukuran (MB)"
                        value={v.maxSizeMb}
                        onChange={(n) => patchValidation({ maxSizeMb: n ?? undefined })}
                        disabled={readOnly}
                      />
                      {field.tipe === "multi_file_upload" && (
                        <NumInput
                          label="Max jumlah file"
                          value={v.maxFiles}
                          onChange={(n) => patchValidation({ maxFiles: n ?? undefined })}
                          disabled={readOnly}
                        />
                      )}
                      <div className="col-span-2">
                        <label className="text-[10px] uppercase text-muted-foreground">
                          MIME / ekstensi (pisahkan koma)
                        </label>
                        <input
                          value={(v.accept ?? []).join(", ")}
                          onChange={(e) =>
                            patchValidation({
                              accept: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          disabled={readOnly}
                          placeholder="application/pdf, image/*"
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                        />
                      </div>
                    </>
                  )}
                  {supportsUnique && (
                    <label className="col-span-2 flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={!!v.unique}
                        onChange={(e) => patchValidation({ unique: e.target.checked || undefined })}
                        disabled={readOnly}
                      />
                      Nilai harus unik (tidak ada duplikat)
                    </label>
                  )}
                </div>
              </div>

              {/* Cross-field compare */}
              {supportsCompare && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                    Perbandingan Antar-Field
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <select
                      value={v.compare?.field ?? ""}
                      onChange={(e) => {
                        const fld = e.target.value;
                        if (!fld) patchValidation({ compare: undefined });
                        else
                          patchValidation({
                            compare: {
                              field: fld,
                              op: v.compare?.op ?? "gt",
                              message: v.compare?.message,
                            },
                          });
                      }}
                      disabled={readOnly}
                      className="col-span-5 rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                    >
                      <option value="">— tidak ada —</option>
                      {otherFields.map((x) => (
                        <option key={x.kode} value={x.kode}>
                          {x.kode} — {x.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={v.compare?.op ?? "gt"}
                      onChange={(e) =>
                        v.compare &&
                        patchValidation({
                          compare: {
                            ...v.compare,
                            op: e.target.value as NonNullable<typeof v.compare>["op"],
                          },
                        })
                      }
                      disabled={readOnly || !v.compare?.field}
                      className="col-span-3 rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                    >
                      <option value="gt">&gt;</option>
                      <option value="gte">≥</option>
                      <option value="lt">&lt;</option>
                      <option value="lte">≤</option>
                      <option value="eq">=</option>
                      <option value="neq">≠</option>
                    </select>
                    <input
                      value={v.compare?.message ?? ""}
                      onChange={(e) =>
                        v.compare &&
                        patchValidation({
                          compare: { ...v.compare, message: e.target.value || undefined },
                        })
                      }
                      disabled={readOnly || !v.compare?.field}
                      placeholder="Pesan custom (opsional)"
                      className="col-span-4 rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Contoh: tanggal_akhir &gt; tanggal_mulai.
                  </p>
                </div>
              )}

              {/* Conditional logic */}
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Logika Tampil (Conditional)
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <select
                    value={field.visible_if?.field ?? ""}
                    onChange={(e) => {
                      const fld = e.target.value;
                      if (!fld) {
                        onChange({ ...field, visible_if: null });
                      } else {
                        onChange({
                          ...field,
                          visible_if: {
                            field: fld,
                            op: field.visible_if?.op ?? "eq",
                            value: field.visible_if?.value ?? "",
                          },
                        });
                      }
                    }}
                    disabled={readOnly}
                    className="col-span-4 rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                  >
                    <option value="">Selalu tampil</option>
                    {otherFields.map((x) => (
                      <option key={x.kode} value={x.kode}>
                        {x.kode} — {x.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={field.visible_if?.op ?? "eq"}
                    onChange={(e) => {
                      if (!field.visible_if) return;
                      onChange({
                        ...field,
                        visible_if: {
                          ...field.visible_if,
                          op: e.target.value as NonNullable<FormField["visible_if"]>["op"],
                        },
                      });
                    }}
                    disabled={readOnly || !field.visible_if?.field}
                    className="col-span-3 rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                  >
                    <option value="eq">= sama dengan</option>
                    <option value="neq">≠ tidak sama</option>
                    <option value="in">termasuk salah satu</option>
                    <option value="not_in">tidak termasuk</option>
                    <option value="filled">terisi</option>
                    <option value="empty">kosong</option>
                  </select>
                  <div className="col-span-5">
                    {field.visible_if && !["filled", "empty"].includes(field.visible_if.op) ? (
                      refHasOptions &&
                      (field.visible_if.op === "eq" || field.visible_if.op === "neq") ? (
                        <select
                          value={
                            typeof field.visible_if.value === "string"
                              ? field.visible_if.value
                              : ""
                          }
                          onChange={(e) =>
                            onChange({
                              ...field,
                              visible_if: { ...field.visible_if!, value: e.target.value },
                            })
                          }
                          disabled={readOnly}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                        >
                          <option value="">-- pilih nilai --</option>
                          {refField!.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={
                            Array.isArray(field.visible_if.value)
                              ? field.visible_if.value.join(",")
                              : (field.visible_if.value ?? "")
                          }
                          onChange={(e) => {
                            const op = field.visible_if!.op;
                            const raw = e.target.value;
                            const val =
                              op === "in" || op === "not_in"
                                ? raw
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : raw;
                            onChange({
                              ...field,
                              visible_if: { ...field.visible_if!, value: val },
                            });
                          }}
                          disabled={readOnly}
                          placeholder={
                            field.visible_if.op === "in" || field.visible_if.op === "not_in"
                              ? "nilai1, nilai2"
                              : "nilai"
                          }
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
                        />
                      )
                    ) : (
                      <div className="text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Field hanya muncul jika kondisi terpenuhi. Field tersembunyi tidak ikut divalidasi
                  saat submit.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end gap-1">
        <button
          onClick={onDuplicate}
          disabled={readOnly}
          title="Duplikat field"
          className="rounded-md border border-border p-1 text-muted-foreground disabled:opacity-30"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          disabled={readOnly}
          title="Hapus field"
          className="rounded-md border border-border p-1 text-destructive disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function NumInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs disabled:opacity-60"
      />
    </div>
  );
}
