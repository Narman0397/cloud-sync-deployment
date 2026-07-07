// Phase 1C — Form Fields Tab with drag-and-drop reorder, duplicate,
// dan bulk action (hapus banyak).
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";
import type { FormField } from "@/features/forms/schema/types";
import { FieldEditor } from "./FieldEditor";
import { duplicateField, emptyField } from "./types";

function SortableRow({
  id,
  children,
  disabled,
}: {
  id: string;
  children: (handle: React.ReactNode) => React.ReactNode;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const handle = (
    <button
      type="button"
      ref={setNodeRef as unknown as React.Ref<HTMLButtonElement>}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label="Drag untuk mengubah urutan"
      className="cursor-grab rounded-md border border-border p-1 text-muted-foreground active:cursor-grabbing disabled:opacity-30"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}

export function FormFieldsTab({
  fields,
  setFields,
  readOnly,
  busy,
  onSave,
}: {
  fields: FormField[];
  setFields: (f: FormField[]) => void;
  readOnly: boolean;
  busy: boolean;
  onSave: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function toggleSel(kode: string) {
    const next = new Set(selected);
    if (next.has(kode)) next.delete(kode);
    else next.add(kode);
    setSelected(next);
  }
  function selectAll() {
    setSelected(new Set(fields.map((f) => f.kode)));
  }
  function clearSel() {
    setSelected(new Set());
  }
  function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Hapus ${selected.size} field?`)) return;
    setFields(fields.filter((f) => !selected.has(f.kode)).map((f, i) => ({ ...f, urutan: i })));
    clearSel();
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = fields.findIndex((f) => f.kode === active.id);
    const newI = fields.findIndex((f) => f.kode === over.id);
    if (oldI < 0 || newI < 0) return;
    const moved = arrayMove(fields, oldI, newI).map((f, i) => ({ ...f, urutan: i }));
    setFields(moved);
  }

  return (
    <div className="space-y-3">
      {readOnly && (
        <p className="text-xs text-amber-600">
          Field hanya dapat diubah saat form berstatus draft.
        </p>
      )}

      {!readOnly && fields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
          <span className="font-medium">{selected.size} dipilih</span>
          <button
            type="button"
            onClick={selectAll}
            className="rounded border border-border px-2 py-0.5"
          >
            Pilih semua
          </button>
          <button
            type="button"
            onClick={clearSel}
            disabled={selected.size === 0}
            className="rounded border border-border px-2 py-0.5 disabled:opacity-40"
          >
            Bersihkan
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-1 rounded border border-destructive bg-destructive/10 px-2 py-0.5 text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" /> Hapus terpilih
          </button>
          <span className="text-muted-foreground">
            Tip: tarik ikon ⋮⋮ untuk mengubah urutan.
          </span>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={fields.map((f) => f.kode || `__${f.label}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {fields.map((f, i) => (
              <SortableRow key={f.kode || `__${i}`} id={f.kode || `__${i}`} disabled={readOnly}>
                {(handle) => (
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-center gap-1 pt-3">
                      {!readOnly && (
                        <input
                          type="checkbox"
                          checked={selected.has(f.kode)}
                          onChange={() => toggleSel(f.kode)}
                          aria-label={`Pilih field ${f.label}`}
                        />
                      )}
                      {handle}
                    </div>
                    <div className="flex-1">
                      <FieldEditor
                        field={f}
                        allFields={fields}
                        readOnly={readOnly}
                        onChange={(nf) => {
                          const arr = [...fields];
                          arr[i] = nf;
                          setFields(arr);
                        }}
                        onRemove={() =>
                          setFields(
                            fields.filter((_, k) => k !== i).map((x, k) => ({ ...x, urutan: k })),
                          )
                        }
                        onDuplicate={() => {
                          const copy = duplicateField(f, fields, i + 1);
                          const next = [...fields];
                          next.splice(i + 1, 0, copy);
                          setFields(next.map((x, k) => ({ ...x, urutan: k })));
                        }}
                      />
                    </div>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFields([...fields, emptyField(fields.length)])}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Plus className="h-4 w-4" /> Tambah Field
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Save className="h-4 w-4" /> Simpan Semua Field
          </button>
        </div>
      )}
    </div>
  );
}
