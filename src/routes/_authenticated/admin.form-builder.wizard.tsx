// Phase 1B.2 — Route Wizard: /admin/form-builder/wizard?draftId=...
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { FormWizard } from "@/features/forms/wizard/FormWizard";
import { fwGetDraft, fwListDrafts, fwDeleteDraft } from "@/lib/form-wizard.functions";
import { emptyPayload, type WizardPayload, type WizardStep } from "@/features/forms/wizard/types";
import { Loader2, Plus, Trash2 } from "lucide-react";

const searchSchema = z.object({
  draftId: z.string().uuid().optional().catch(undefined),
  new: z.coerce.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/admin/form-builder/wizard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Buat Form — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const { isSuperAdmin, isAdminPemda } = useAuth();
  const getDraft = useServerFn(fwGetDraft);
  const listDrafts = useServerFn(fwListDrafts);
  const deleteDraft = useServerFn(fwDeleteDraft);
  const [loading, setLoading] = useState(true);
  const [serverId, setServerId] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>("general");
  const [payload, setPayload] = useState<WizardPayload>(emptyPayload());
  const [drafts, setDrafts] = useState<
    Array<{ id: string; title: string | null; step: string; updated_at: string }>
  >([]);
  const [localId, setLocalId] = useState<string | null>(null);

  // Bootstrap: pilih mode (resume existing draft / show picker / create new)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (search.draftId) {
          const d = (await getDraft({ data: { id: search.draftId } })) as {
            id: string;
            step: string;
            payload: unknown;
          } | null;
          if (cancelled) return;
          if (d) {
            setServerId(d.id);
            setLocalId(d.id);
            setStep((d.step as WizardStep) ?? "general");
            setPayload({ ...emptyPayload(), ...(d.payload as Partial<WizardPayload>) });
          }
          setLoading(false);
          return;
        }
        if (search.new) {
          const newId = crypto.randomUUID();
          if (cancelled) return;
          setLocalId(newId);
          setLoading(false);
          return;
        }
        const list = (await listDrafts()) as Array<{
          id: string;
          title: string | null;
          step: string;
          updated_at: string;
        }>;
        if (cancelled) return;
        setDrafts(list);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.draftId, search.new, getDraft, listDrafts]);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!localId) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Lanjutkan draft yang belum selesai, atau mulai form baru dari nol.
          </p>
          <button
            onClick={() => nav({ to: "/admin/form-builder/wizard", search: { new: true } })}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Form Baru
          </button>
        </div>
        <ul className="space-y-1">
          {drafts.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada draft tersimpan.
            </li>
          )}
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
            >
              <button
                onClick={() => nav({ to: "/admin/form-builder/wizard", search: { draftId: d.id } })}
                className="flex-1 text-left"
              >
                <div className="font-medium">{d.title || "(tanpa nama)"}</div>
                <div className="text-xs text-muted-foreground">
                  Step: {d.step} · Diubah {new Date(d.updated_at).toLocaleString("id-ID")}
                </div>
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Hapus draft ini?")) return;
                  await deleteDraft({ data: { id: d.id } });
                  setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                }}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <FormWizard
      localId={localId}
      initialServerId={serverId}
      initialPayload={payload}
      initialStep={step}
      isElevated={isSuperAdmin || isAdminPemda}
    />
  );
}
