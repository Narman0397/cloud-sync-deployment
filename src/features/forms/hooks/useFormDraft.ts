import { useEffect, useRef, useState } from "react";
import { saveDraft } from "@/lib/submissions.functions";
import type { SubmissionRow } from "@/features/forms/renderer/types";

/**
 * Mengelola state draft pengisian + autosave tiap 5 detik.
 * Phase 1C: tambahan backup localStorage agar tidak hilang jika offline /
 * tab ditutup sebelum autosave berikutnya.
 */

const LS_PREFIX = "form-draft:";

function lsKey(assignmentId: string, submissionId: string | null) {
  return `${LS_PREFIX}${assignmentId}:${submissionId ?? "new"}`;
}

function loadLocalBackup(assignmentId: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const k = lsKey(assignmentId, null);
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: Record<string, unknown>; at: number };
    // expire 7 hari
    if (Date.now() - parsed.at > 7 * 24 * 3600 * 1000) {
      window.localStorage.removeItem(k);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function useFormDraft({
  assignmentId,
  initialSubmission,
  initialData,
  busy,
}: {
  assignmentId: string;
  initialSubmission: SubmissionRow | null;
  initialData: Record<string, unknown>;
  busy: boolean;
}) {
  // Jika belum ada submission server-side, coba restore dari localStorage.
  const seed: Record<string, unknown> = (() => {
    if (initialSubmission) return initialData;
    const backup = loadLocalBackup(assignmentId);
    return backup ?? initialData;
  })();
  const [data, setData] = useState<Record<string, unknown>>(seed);
  const [submission, setSubmission] = useState<SubmissionRow | null>(initialSubmission);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(seed));
  const dirtyRef = useRef(false);
  const [hasLocalBackup] = useState(() => !initialSubmission && loadLocalBackup(assignmentId) !== null);

  // Sync ketika initial data berubah (mis. setelah reload).
  useEffect(() => {
    setData(initialData);
    setSubmission(initialSubmission);
    lastSavedRef.current = JSON.stringify(initialData);
    dirtyRef.current = false;
  }, [initialData, initialSubmission]);

  // Mirror perubahan ke localStorage agar tidak hilang.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const k = lsKey(assignmentId, submission?.id ?? null);
      window.localStorage.setItem(k, JSON.stringify({ data, at: Date.now() }));
    } catch {
      /* quota habis: abaikan */
    }
  }, [data, assignmentId, submission?.id]);

  function setField(kode: string, value: unknown) {
    dirtyRef.current = true;
    setData((d) => ({ ...d, [kode]: value }));
  }

  function clearLocalBackup() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(lsKey(assignmentId, null));
      if (submission?.id) window.localStorage.removeItem(lsKey(assignmentId, submission.id));
    } catch {
      /* ignore */
    }
  }

  async function manualSave(): Promise<{ id: string }> {
    setIsSaving(true);
    setSaveError(null);
    try {
      const r = (await saveDraft({
        data: submission ? { submissionId: submission.id, data } : { assignmentId, data },
      })) as { id: string };
      lastSavedRef.current = JSON.stringify(data);
      if (!submission) setSubmission({ id: r.id, status: "draft", data, review_note: null });
      dirtyRef.current = false;
      setLastSavedAt(new Date());
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      setSaveError(msg);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }

  // Autosave 5s.
  useEffect(() => {
    const t = setInterval(async () => {
      if (!dirtyRef.current || busy) return;
      if (submission && !["draft", "revision_required"].includes(submission.status)) return;
      const snap = JSON.stringify(data);
      if (snap === lastSavedRef.current) return;
      try {
        await manualSave();
      } catch {
        // saveError sudah di-set oleh manualSave; biarkan visual indikator menampilkan
      }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, submission, busy]);

  // Prompt sebelum tutup tab jika ada perubahan belum tersimpan.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const isDirty = (() => JSON.stringify(data) !== lastSavedRef.current)();

  return {
    data,
    setData,
    setField,
    submission,
    setSubmission,
    manualSave,
    isSaving,
    lastSavedAt,
    saveError,
    isDirty,
    hasLocalBackup,
    clearLocalBackup,
  };
}
