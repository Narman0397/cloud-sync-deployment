// Phase 1B.2 — Form Designer: palette + canvas + properties panel (drag&drop).
// Output: list FormField (flat). Section bertindak sebagai header visual
// untuk grup fields berikutnya hingga section berikutnya.
import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldType, FormField } from "@/features/forms/schema/types";
import { PALETTE, GROUP_LABEL, FIELD_TYPE_LABEL_ID, createFieldOfType } from "@/features/forms/designer/field-defaults";
import { PropertiesPanel } from "@/features/forms/designer/PropertiesPanel";
import {
  GripVertical,
  Trash2,
  Copy as CopyIcon,
  Plus,
  Heading as HeadingIcon,
  Minus,
  Layers,
} from "lucide-react";

interface DesignerProps {
  fields: FormField[];
  onChange: (next: FormField[]) => void;
  readOnly?: boolean;
  emitAudit?: (event: string, meta?: Record<string, unknown>) => void;
}

const PALETTE_PREFIX = "palette:";
const FIELD_PREFIX = "field:";

export function FormDesigner({ fields, onChange, readOnly, emitAudit }: DesignerProps) {
  const [selected, setSelected] = useState<string | null>(fields[0]?.kode ?? null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const existingKeys = useMemo(() => new Set(fields.map((f) => f.kode)), [fields]);

  const addFieldOfType = useCallback(
    (type: FieldType) => {
      if (readOnly) return;
      const newField = createFieldOfType(type, existingKeys);
      const next = [...fields, newField].map((f, i) => ({ ...f, urutan: i }));
      onChange(next);
      setSelected(newField.kode);
      emitAudit?.("field.add", { kode: newField.kode, tipe: newField.tipe, via: "click" });
    },
    [fields, onChange, existingKeys, readOnly, emitAudit],
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId.startsWith(PALETTE_PREFIX)) {
        const type = activeId.slice(PALETTE_PREFIX.length) as FieldType;
        const newField = createFieldOfType(type, existingKeys);
        let insertAt = fields.length;
        if (overId.startsWith(FIELD_PREFIX)) {
          const targetKode = overId.slice(FIELD_PREFIX.length);
          insertAt = fields.findIndex((f) => f.kode === targetKode);
          if (insertAt < 0) insertAt = fields.length;
        }
        const next = [...fields];
        next.splice(insertAt, 0, newField);
        onChange(next.map((f, i) => ({ ...f, urutan: i })));
        setSelected(newField.kode);
        emitAudit?.("field.add", { kode: newField.kode, tipe: newField.tipe });
        return;
      }

      if (activeId.startsWith(FIELD_PREFIX) && overId.startsWith(FIELD_PREFIX)) {
        const fromKode = activeId.slice(FIELD_PREFIX.length);
        const toKode = overId.slice(FIELD_PREFIX.length);
        if (fromKode === toKode) return;
        const from = fields.findIndex((f) => f.kode === fromKode);
        const to = fields.findIndex((f) => f.kode === toKode);
        if (from < 0 || to < 0) return;
        const next = arrayMove(fields, from, to).map((f, i) => ({ ...f, urutan: i }));
        onChange(next);
        emitAudit?.("field.reorder", { from: fromKode, to: toKode });
      }
    },
    [fields, onChange, existingKeys, emitAudit],
  );

  function removeField(kode: string) {
    onChange(fields.filter((f) => f.kode !== kode).map((f, i) => ({ ...f, urutan: i })));
    if (selected === kode) setSelected(null);
    emitAudit?.("field.remove", { kode });
  }

  function duplicateField(kode: string) {
    const src = fields.find((f) => f.kode === kode);
    if (!src) return;
    const newKey = `${src.kode}_copy`;
    let k = newKey;
    let n = 2;
    while (existingKeys.has(k)) k = `${newKey}_${n++}`;
    const idx = fields.findIndex((f) => f.kode === kode);
    const dup: FormField = { ...src, kode: k, label: `${src.label} (copy)` };
    const next = [...fields];
    next.splice(idx + 1, 0, dup);
    onChange(next.map((f, i) => ({ ...f, urutan: i })));
    setSelected(dup.kode);
    emitAudit?.("field.add", { kode: dup.kode, via: "duplicate" });
  }

  function updateField(updated: FormField, prev?: FormField) {
    onChange(fields.map((f) => (f.kode === (prev?.kode ?? updated.kode) ? updated : f)));
    if (selected === prev?.kode && prev.kode !== updated.kode) setSelected(updated.kode);
    emitAudit?.("field.update", { kode: updated.kode });
  }

  const selectedField = fields.find((f) => f.kode === selected) ?? null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_320px]">
        <Palette readOnly={readOnly} onAdd={addFieldOfType} />
        <Canvas
          fields={fields}
          selected={selected}
          onSelect={setSelected}
          onRemove={removeField}
          onDuplicate={duplicateField}
          readOnly={readOnly}
        />
        <aside className="rounded-lg border border-border bg-card">
          {selectedField ? (
            <PropertiesPanel
              key={selectedField.kode}
              field={selectedField}
              allFields={fields}
              onChange={(next) => updateField(next, selectedField)}
              onAudit={(ev) => emitAudit?.(ev, { kode: selectedField.kode })}
              readOnly={readOnly}
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Pilih salah satu isian di kanvas untuk mengubah pengaturannya.
            </div>
          )}
        </aside>
      </div>
      <DragOverlay>
        {activeId?.startsWith(PALETTE_PREFIX) ? (
          <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow">
            + {activeId.slice(PALETTE_PREFIX.length)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ----------------- Palette -----------------
function Palette({ readOnly, onAdd }: { readOnly?: boolean; onAdd: (type: FieldType) => void }) {
  const grouped = useMemo(() => {
    const g: Record<string, typeof PALETTE> = {};
    for (const p of PALETTE) (g[p.group] ??= []).push(p);
    return g;
  }, []);
  return (
    <aside className="rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Pustaka Isian
      </h3>
      {readOnly ? (
        <p className="text-xs text-muted-foreground">
          Mode hanya-baca. Buat versi baru untuk mengubah.
        </p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Klik untuk menambah, atau seret ke area kanan.
          </p>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUP_LABEL[group as keyof typeof GROUP_LABEL]}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((it) => (
                  <PaletteChip key={it.type} type={it.type} label={it.label} onAdd={onAdd} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

function PaletteChip({
  type,
  label,
  onAdd,
}: {
  type: FieldType;
  label: string;
  onAdd: (type: FieldType) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${type}`,
  });
  return (
    <div className="flex items-stretch gap-0.5">
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        onClick={() => onAdd(type)}
        title="Klik untuk menambah, atau seret ke kanvas"
        className={`flex flex-1 items-center justify-start gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs hover:bg-muted ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        <Plus className="h-3 w-3 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

// ----------------- Canvas -----------------
function Canvas({
  fields,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  readOnly,
}: {
  fields: FormField[];
  selected: string | null;
  onSelect: (k: string) => void;
  onRemove: (k: string) => void;
  onDuplicate: (k: string) => void;
  readOnly?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "canvas-root" });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-[420px] rounded-lg border-2 border-dashed bg-background p-3 ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      {fields.length === 0 ? (
        <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
          Seret isian dari panel kiri ke sini, atau klik salah satu untuk menambahkannya.
        </div>
      ) : (
        <SortableContext
          items={fields.map((f) => `${FIELD_PREFIX}${f.kode}`)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-1.5">
            {fields.map((f) => (
              <CanvasItem
                key={f.kode}
                field={f}
                selected={selected === f.kode}
                onSelect={() => onSelect(f.kode)}
                onRemove={() => onRemove(f.kode)}
                onDuplicate={() => onDuplicate(f.kode)}
                readOnly={readOnly}
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}

function CanvasItem({
  field,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  readOnly,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  readOnly?: boolean;
}) {
  const id = `${FIELD_PREFIX}${field.kode}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: readOnly,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon =
    field.tipe === "section"
      ? Layers
      : field.tipe === "heading"
        ? HeadingIcon
        : field.tipe === "divider"
          ? Minus
          : null;

  if (field.tipe === "section") {
    return (
      <li ref={setNodeRef} style={style}>
        <div
          onClick={onSelect}
          className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 ${
            selected ? "border-primary bg-primary/5" : "border-border bg-muted/40"
          }`}
        >
          {!readOnly && (
            <button {...listeners} {...attributes} className="cursor-grab p-0.5 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <Layers className="h-4 w-4 text-primary" />
          <span className="font-semibold">{field.label}</span>
          <span className="ml-auto text-[10px] uppercase text-muted-foreground">Bagian</span>
          {!readOnly && (
            <RowActions onRemove={onRemove} onDuplicate={onDuplicate} />
          )}
        </div>
      </li>
    );
  }

  if (field.tipe === "divider") {
    return (
      <li ref={setNodeRef} style={style}>
        <div
          onClick={onSelect}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${
            selected ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
        >
          {!readOnly && (
            <button {...listeners} {...attributes} className="cursor-grab p-0.5 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <Minus className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Pemisah</span>
          {!readOnly && <RowActions onRemove={onRemove} onDuplicate={onDuplicate} />}
        </div>
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style}>
      <div
        onClick={onSelect}
        className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
          selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
        }`}
      >
        {!readOnly && (
          <button {...listeners} {...attributes} className="cursor-grab p-0.5 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{field.label}</span>
            {field.required && (
              <span className="text-red-500" title="Wajib diisi">*</span>
            )}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {FIELD_TYPE_LABEL_ID[field.tipe as FieldType] ?? field.tipe}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            Kode: <code>{field.kode}</code>
          </div>
        </div>
        {!readOnly && <RowActions onRemove={onRemove} onDuplicate={onDuplicate} />}
      </div>
    </li>
  );
}

function RowActions({ onRemove, onDuplicate }: { onRemove: () => void; onDuplicate: () => void }) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Gandakan isian ini"
        aria-label="Gandakan"
        onClick={onDuplicate}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <CopyIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Hapus isian ini"
        aria-label="Hapus"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
