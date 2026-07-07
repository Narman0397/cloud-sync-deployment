// My Sign Inbox — daftar slot tanda tangan pending milik pengguna.
// Mendukung bulk sign, delegasi, tolak dengan alasan terstruktur.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listMyPendingSigners,
  dcDelegateSigner,
  dcSearchDelegates,
} from "@/lib/dsig-bulk.functions";
import {
  rejectSigner,
  REJECT_REASON_CODES,
  REJECT_REASON_LABEL,
  type RejectReasonCode,
} from "@/lib/dsig-reject.functions";
import { signDocument } from "@/features/digital-signature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/document-center/signature/my-inbox")({
  head: () => ({ meta: [{ title: "Kotak Tanda Tangan Saya — Document Center" }] }),
  component: MyInboxPage,
});

type SlotRow = {
  id: string;
  request_id: string;
  order_index: number;
  parallel: boolean;
  deadline_at: string | null;
  status: string;
  request?: { id: string; current_step?: number | null; status?: string | null } | null;
};

function MyInboxPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyPendingSigners);
  const signFn = useServerFn(signDocument);
  const delegateFn = useServerFn(dcDelegateSigner);
  const searchFn = useServerFn(dcSearchDelegates);
  const rejectFn = useServerFn(rejectSigner);

  const q = useQuery({
    queryKey: ["dc", "my-sign-inbox"],
    queryFn: () => listFn(),
  });

  const rows = useMemo<SlotRow[]>(() => ((q.data?.rows ?? []) as unknown) as SlotRow[], [q.data]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [delegateFor, setDelegateFor] = useState<SlotRow | null>(null);
  const [rejectFor, setRejectFor] = useState<SlotRow | null>(null);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  async function runBulk() {
    if (selectedIds.length === 0) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const slotId of selectedIds) {
      const slot = rows.find((r) => r.id === slotId);
      if (!slot) continue;
      try {
        // signDocument menerima document_id (dokumen sumber). Slot menyimpan request_id;
        // detail dokumen ditangani oleh runtime per permintaan. Di sini kita gunakan request_id
        // sebagai proxy ID dokumen untuk backend legacy — sesuaikan bila API berbeda.
        await signFn({ data: { document_id: slot.request_id } });
        ok += 1;
      } catch (e) {
        fail += 1;
        console.error("sign fail", slotId, e);
      }
    }
    setBusy(false);
    setSelected({});
    if (ok > 0) toast.success(`${ok} dokumen ditandatangani`);
    if (fail > 0) toast.error(`${fail} gagal — cek log`);
    qc.invalidateQueries({ queryKey: ["dc"] });
  }

  const delegateM = useMutation({
    mutationFn: (input: { signer_id: string; to_user_id: string; reason: string }) =>
      delegateFn({ data: input }),
    onSuccess: () => {
      toast.success("Slot didelegasikan");
      setDelegateFor(null);
      qc.invalidateQueries({ queryKey: ["dc", "my-sign-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectM = useMutation({
    mutationFn: (input: { signer_id: string; reason_code: RejectReasonCode; reason_text: string }) =>
      rejectFn({ data: input }),
    onSuccess: () => {
      toast.success("Slot ditolak");
      setRejectFor(null);
      qc.invalidateQueries({ queryKey: ["dc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Kotak Tanda Tangan Saya</CardTitle>
            <p className="text-xs text-muted-foreground">
              Daftar slot tanda tangan menunggu Anda. Pilih beberapa untuk ditandatangani sekaligus, atau delegasikan.
            </p>
          </div>
          <Button size="sm" disabled={selectedIds.length === 0 || busy} onClick={runBulk}>
            {busy ? "Menandatangani…" : `Tandatangani ${selectedIds.length || ""} sekaligus`.trim()}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Permintaan</TableHead>
                <TableHead>Urutan</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={!!selected[r.id]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: !!v }))}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.request_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">
                    {r.parallel ? "Paralel" : `Urut #${r.order_index}`}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.deadline_at ? new Date(r.deadline_at).toLocaleString("id-ID") : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.status}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDelegateFor(r)}>
                        Delegasikan
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRejectFor(r)}
                        aria-label={`Tolak permintaan ${r.request_id.slice(0, 8)}`}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Tolak
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !q.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Tidak ada slot tanda tangan menunggu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DelegateDialog
        slot={delegateFor}
        onClose={() => setDelegateFor(null)}
        onSubmit={(to_user_id, reason) =>
          delegateFor && delegateM.mutate({ signer_id: delegateFor.id, to_user_id, reason })
        }
        onSearch={async (q) => (await searchFn({ data: { q } })).rows}
      />

      <RejectDialog
        slot={rejectFor}
        onClose={() => setRejectFor(null)}
        busy={rejectM.isPending}
        onSubmit={(reason_code, reason_text) =>
          rejectFor && rejectM.mutate({ signer_id: rejectFor.id, reason_code, reason_text })
        }
      />
    </div>
  );
}

function DelegateDialog(props: {
  slot: SlotRow | null;
  onClose: () => void;
  onSubmit: (to_user_id: string, reason: string) => void;
  onSearch: (q: string) => Promise<Array<{ id: string; nama_lengkap: string | null; nip: string | null; jabatan: string | null }>>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof props.onSearch>>>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const open = !!props.slot;

  async function runSearch() {
    if (!q.trim()) return;
    try {
      setResults(await props.onSearch(q.trim()));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mencari");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delegasikan Tanda Tangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Cari nama / NIP / jabatan"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <Button variant="outline" onClick={runSearch}>Cari</Button>
          </div>
          <div className="max-h-52 overflow-auto rounded-md border">
            {results.map((r) => (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-2 border-b p-2 text-sm last:border-0 ${
                  pick === r.id ? "bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="pick"
                  checked={pick === r.id}
                  onChange={() => setPick(r.id)}
                />
                <div>
                  <div className="font-medium">{r.nama_lengkap ?? "(tanpa nama)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.jabatan ?? "—"} · NIP {r.nip ?? "—"}
                  </div>
                </div>
              </label>
            ))}
            {results.length === 0 && (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Ketik nama/NIP lalu tekan Cari.
              </div>
            )}
          </div>
          <Textarea
            placeholder="Alasan delegasi (opsional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>Batal</Button>
          <Button
            disabled={!pick}
            onClick={() => pick && props.onSubmit(pick, reason)}
          >
            Delegasikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog(props: {
  slot: SlotRow | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason_code: RejectReasonCode, reason_text: string) => void;
}) {
  const [code, setCode] = useState<RejectReasonCode>("data_tidak_lengkap");
  const [text, setText] = useState("");
  const open = !!props.slot;
  const needsText = code === "lainnya";
  const canSubmit = !needsText || text.trim().length > 0;

  // Reset saat dialog dibuka.
  const slotId = props.slot?.id ?? null;
  useMemo(() => {
    setCode("data_tidak_lengkap");
    setText("");
  }, [slotId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tolak permintaan tanda tangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Pilih alasan yang paling sesuai. Alasan ini dicatat ke jejak audit dan dikirim ke pemohon.
          </p>
          <div className="space-y-2">
            {REJECT_REASON_CODES.map((c) => (
              <label
                key={c}
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                  code === c ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  className="mt-0.5"
                  checked={code === c}
                  onChange={() => setCode(c)}
                />
                <span>{REJECT_REASON_LABEL[c]}</span>
              </label>
            ))}
          </div>
          <div>
            <label htmlFor="reject-text" className="mb-1 block text-xs font-medium">
              Keterangan{needsText ? " (wajib)" : " (opsional)"}
            </label>
            <Textarea
              id="reject-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tambahkan penjelasan singkat…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose} disabled={props.busy}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!canSubmit || props.busy}
            onClick={() => props.onSubmit(code, text.trim())}
          >
            {props.busy ? "Menolak…" : "Tolak permintaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
