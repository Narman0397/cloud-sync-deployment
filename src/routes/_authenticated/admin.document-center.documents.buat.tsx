// 3-step wizard: Pilih Template → Pilih Submission & Pratinjau Nomor → Generate & Kirim TTE.
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  docListTemplates,
  docGenerate,
  docPreviewNumbering,
} from "@/lib/documents.functions";
import {
  docListSubmissionsForTemplate,
  sigListProviders,
  sigSendDocument,
} from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";
import { StepRail } from "@/components/ui-kit/StepRail";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { HelpHint } from "@/components/ui-kit/HelpHint";

export const Route = createFileRoute("/_authenticated/admin/document-center/documents/buat")({
  head: () => ({ meta: [{ title: "Buat Dokumen — Wizard" }] }),
  component: WizardPage,
});

type Step = 1 | 2 | 3;

function WizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string>("");
  const [docName, setDocName] = useState<string>("");
  const [generated, setGenerated] = useState<{ id: string; doc_number: string | null } | null>(null);
  const [providerId, setProviderId] = useState<string>("");

  const tplsFn = useServerFn(docListTemplates);
  const subFn = useServerFn(docListSubmissionsForTemplate);
  const prevNumFn = useServerFn(docPreviewNumbering);
  const provFn = useServerFn(sigListProviders);
  const genFn = useServerFn(docGenerate);
  const sendFn = useServerFn(sigSendDocument);

  const tplsQ = useQuery({
    queryKey: ["wizard", "tpls"],
    queryFn: () => tplsFn({ data: { status: "active", limit: 100 } }),
  });
  const subsQ = useQuery({
    queryKey: ["wizard", "subs", templateId],
    queryFn: () => subFn({ data: { templateId: templateId ?? undefined } }),
    enabled: step >= 2,
  });
  const provQ = useQuery({
    queryKey: ["wizard", "providers"],
    queryFn: () => provFn(),
    enabled: step === 3,
  });

  const tpl = (tplsQ.data?.rows ?? []).find((t) => t.id === templateId);

  const numQ = useQuery({
    queryKey: ["wizard", "previewNum", tpl?.numbering_rule_id],
    queryFn: () =>
      prevNumFn({
        data: { rule_id: tpl!.numbering_rule_id! },
      }) as Promise<{ preview: string }>,
    enabled: !!tpl?.numbering_rule_id && step === 2,
  });

  const genMut = useMutation({
    mutationFn: async () =>
      genFn({
        data: {
          template_id: templateId!,
          submission_id: submissionId,
          name: docName || undefined,
        },
      }),
    onSuccess: (r) => {
      setGenerated({ id: r.id, doc_number: r.doc_number ?? null });
      toast.success(`Dokumen dibuat${r.doc_number ? ` — ${r.doc_number}` : ""}`);
      setStep(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const prov = (provQ.data?.providers ?? []).find((p) => p.id === providerId);
      if (!prov) throw new Error("Pilih provider");
      return sendFn({
        data: {
          generatedDocumentId: generated!.id,
          providerCode: prov.code,
          mode: "sequential",
          signers: [],
        },
      });
    },
    onSuccess: (r: { requestId?: string }) => {
      toast.success("Permintaan TTE dikirim");
      if (r.requestId) {
        navigate({
          to: "/admin/document-center/signature/requests/$id",
          params: { id: r.requestId },
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stepIds = ["template", "data", "kirim"] as const;
  const currentId = stepIds[step - 1];
  const doneIds = stepIds.slice(0, step - 1);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <Link to="/admin/document-center" className="hover:underline">
            ← Hub Dokumen &amp; TTE
          </Link> as unknown as string
        }
        title="Buat Dokumen Baru"
        description="Tiga langkah singkat: pilih template, hubungkan dengan data permohonan, lalu kirim untuk ditandatangani."
      />
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-4 md:self-start">
          <StepRail
            phases={[
              {
                title: "Susun",
                items: [
                  { id: "template", label: "Pilih template", hint: "Format dokumen resmi" },
                  { id: "data", label: "Sumber data", hint: "Pilih permohonan / submission" },
                ],
              },
              {
                title: "Kirim",
                items: [
                  { id: "kirim", label: "Tandatangani", hint: "Pilih provider TTE" },
                ],
              },
            ]}
            currentId={currentId}
            doneIds={doneIds}
            lockedIds={step < 3 ? ["kirim"] : step < 2 ? ["data", "kirim"] : []}
            onSelect={(id) => {
              const idx = stepIds.indexOf(id as (typeof stepIds)[number]);
              if (idx >= 0 && idx < step) setStep((idx + 1) as Step);
            }}
          />
        </aside>
        <div className="min-w-0 space-y-4">
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              Pilih template aktif{" "}
              <HelpHint title="Apa itu template?">
                Template adalah kerangka dokumen resmi (mis. Surat Tugas, SK) yang akan diisi
                otomatis dari data permohonan. Hanya template berstatus aktif yang muncul di sini.
              </HelpHint>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tplsQ.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {(tplsQ.data?.rows ?? []).length === 0 && !tplsQ.isLoading && (
              <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                Belum ada template aktif.{" "}
                <Link to="/admin/document-center/templates" className="text-primary underline">
                  Kelola template
                </Link>
                .
              </div>
            )}
            <div className="grid gap-2">
              {(tplsQ.data?.rows ?? []).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`flex items-center justify-between rounded-md border p-3 text-left hover:bg-muted ${
                    templateId === t.id ? "border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.category ?? "—"} • {t.kind}
                      {t.numbering_rule_id ? " • penomoran otomatis" : " • tanpa penomoran"}
                    </div>
                  </div>
                  <Badge variant="outline">v{t.current_version ?? 1}</Badge>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button disabled={!templateId} onClick={() => setStep(2)}>
                Lanjut →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              Sumber data &amp; penomoran{" "}
              <HelpHint title="Sumber data">
                Pilih permohonan/submission yang isinya akan dipakai untuk mengisi template.
                Nomor surat akan dipratinjau otomatis bila template terikat aturan penomoran.
              </HelpHint>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Permohonan / Submission</Label>
              <select
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— pilih permohonan —</option>
                {(subsQ.data?.rows ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)} • {s.status} •{" "}
                    {s.submitted_at
                      ? new Date(s.submitted_at).toLocaleDateString("id-ID")
                      : "—"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Nama dokumen (opsional)</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Otomatis mengikuti template jika dikosongkan"
              />
            </div>
            {tpl?.numbering_rule_id && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="text-xs uppercase text-muted-foreground">
                  Pratinjau nomor surat
                </div>
                <div className="mt-1 font-mono">
                  {numQ.isLoading
                    ? "memuat…"
                    : (numQ.data as { preview?: string } | undefined)?.preview ?? "—"}
                </div>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← Kembali
              </Button>
              <Button
                disabled={!submissionId || genMut.isPending}
                onClick={() => genMut.mutate()}
              >
                {genMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Buat dokumen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && generated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-display">Dokumen siap — kirim untuk ditandatangani</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <strong>Dokumen:</strong> {docName || tpl?.name}
              </div>
              <div>
                <strong>Nomor:</strong>{" "}
                <span className="font-mono">{generated.doc_number ?? "—"}</span>
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Provider TTE (opsional)
                <HelpHint title="Apa fungsi provider?">
                  Provider adalah layanan TTE yang digunakan (mis. BSrE atau Internal Sistem).
                  Jika dikosongkan, Anda bisa mengirim ke antrian TTE nanti dari halaman detail.
                </HelpHint>
              </Label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— lewati, tandatangani manual nanti —</option>
                {(provQ.data?.providers ?? [])
                  .filter((p) => p.status === "active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Link
                to="/admin/document-center/documents/$id"
                params={{ id: generated.id }}
                className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Buka detail dokumen →
              </Link>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(1);
                    setTemplateId(null);
                    setSubmissionId("");
                    setDocName("");
                    setGenerated(null);
                    setProviderId("");
                  }}
                >
                  Buat lagi
                </Button>
                <Button
                  disabled={!providerId || sendMut.isPending}
                  onClick={() => sendMut.mutate()}
                >
                  {sendMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Kirim ke TTE
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </div>
      </div>
    </div>
  );
}

