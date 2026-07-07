// Phase 1B.2 — Wizard draft hook (localStorage + server autosave debounce 1000ms).
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fwSaveDraft } from "@/lib/form-wizard.functions";
import type { WizardPayload, WizardStep } from "@/features/forms/wizard/types";
import { emptyPayload } from "@/features/forms/wizard/types";

const LS_KEY = (id: string) => `lov.fw.draft:${id}`;
const LS_INDEX = "lov.fw.drafts";

interface DraftState {
  id: string; // local-only id awal; bila server sync sukses, diisi server id
  serverId: string | null;
  formId: string | null;
  step: WizardStep;
  payload: WizardPayload;
  savedAt: string | null;
}

export interface UseWizardDraft {
  state: DraftState;
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  setPayload: (updater: (p: WizardPayload) => WizardPayload) => void;
  setStep: (step: WizardStep) => void;
  forceSave: () => Promise<void>;
  reset: () => void;
}

function loadLocal(id: string): DraftState | null {
  try {
    const raw = localStorage.getItem(LS_KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

function writeLocal(state: DraftState) {
  try {
    localStorage.setItem(LS_KEY(state.id), JSON.stringify(state));
    const idx = JSON.parse(localStorage.getItem(LS_INDEX) ?? "[]") as string[];
    if (!idx.includes(state.id)) {
      idx.unshift(state.id);
      localStorage.setItem(LS_INDEX, JSON.stringify(idx.slice(0, 50)));
    }
  } catch {
    // storage penuh — abaikan
  }
}

function removeLocal(id: string) {
  try {
    localStorage.removeItem(LS_KEY(id));
    const idx = JSON.parse(localStorage.getItem(LS_INDEX) ?? "[]") as string[];
    localStorage.setItem(LS_INDEX, JSON.stringify(idx.filter((x) => x !== id)));
  } catch {
    /* noop */
  }
}

export function useWizardDraft(opts: {
  localId: string;
  initialServerId?: string | null;
  initialFormId?: string | null;
  initialStep?: WizardStep;
  initialPayload?: WizardPayload;
}): UseWizardDraft {
  const saveDraft = useServerFn(fwSaveDraft);

  const initialState: DraftState = (() => {
    const fromLocal = loadLocal(opts.localId);
    if (fromLocal) return fromLocal;
    return {
      id: opts.localId,
      serverId: opts.initialServerId ?? null,
      formId: opts.initialFormId ?? null,
      step: opts.initialStep ?? "general",
      payload: opts.initialPayload ?? emptyPayload(),
      savedAt: null,
    };
  })();

  const [state, setState] = useState<DraftState>(initialState);
  const [status, setStatus] = useState<UseWizardDraft["status"]>("idle");
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const doSave = useCallback(async () => {
    const current = stateRef.current;
    setStatus("saving");
    setError(null);
    try {
      const res = await saveDraft({
        data: {
          id: current.serverId ?? undefined,
          formId: current.formId,
          step: current.step,
          title: current.payload.general.name || null,
          payload: current.payload as unknown as Record<string, unknown>,
        },
      });
      setState((prev) => {
        const next: DraftState = {
          ...prev,
          serverId: res.id,
          savedAt: res.updated_at,
        };
        writeLocal(next);
        return next;
      });
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Gagal menyimpan draft");
    }
  }, [saveDraft]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = doSave();
      inflight.current = p;
      void p.finally(() => {
        if (inflight.current === p) inflight.current = null;
      });
    }, 1000);
  }, [doSave]);

  const setPayload = useCallback(
    (updater: (p: WizardPayload) => WizardPayload) => {
      setState((prev) => {
        const next: DraftState = { ...prev, payload: updater(prev.payload) };
        writeLocal(next);
        return next;
      });
      schedule();
    },
    [schedule],
  );

  const setStep = useCallback(
    (step: WizardStep) => {
      setState((prev) => {
        const next = { ...prev, step };
        writeLocal(next);
        return next;
      });
      schedule();
    },
    [schedule],
  );

  const forceSave = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await doSave();
  }, [doSave]);

  const reset = useCallback(() => {
    removeLocal(opts.localId);
  }, [opts.localId]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { state, status, error, setPayload, setStep, forceSave, reset };
}
