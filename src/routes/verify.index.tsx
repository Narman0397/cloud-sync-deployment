// Publik: verifikasi keaslian dokumen dengan memasukkan SHA-256 hash
// dan (opsional) token verifikasi. Server yang mengecek registry resmi.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { verifyByHash, verifyUploadedPdf } from "@/features/digital-signature";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ScanLine, X as XIcon } from "lucide-react";
import { QrScanner } from "@/components/asn/QrScanner";

export const Route = createFileRoute("/verify/")({
  head: () => ({
    meta: [
      { title: "Verifikasi Dokumen — Portal Publik" },
      {
        name: "description",
        content: "Verifikasi keaslian dokumen resmi dengan SHA-256 hash atau unggah PDF.",
      },
    ],
  }),
  component: Page,
});

const MAX_UPLOAD = 20 * 1024 * 1024;

type Result =
  | { kind: "match"; signed_at: string; token?: string | null }
  | { kind: "mismatch"; reason: string }
  | null;

function Page() {
  const verifyH = useServerFn(verifyByHash);
  const verifyU = useServerFn(verifyUploadedPdf);
  const navigate = useNavigate();
  const [hash, setHash] = useState("");
  const [token, setToken] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [scanning, setScanning] = useState(false);

  function handleScan(text: string) {
    // Ekstrak token dari URL /verify/<token> atau /verify-doc/<token> atau /v/<token>
    const m = text.match(/\/(?:verify(?:-doc)?|v)\/([^/?#]+)/i);
    const t = m?.[1] ?? text.trim();
    if (!t) {
      toast.error("QR tidak berisi token verifikasi");
      return;
    }
    setScanning(false);
    void navigate({ to: "/verify/$token", params: { token: t } });
  }

  async function checkByHash() {
    if (!/^[a-f0-9]{64}$/i.test(hash.trim())) {
      toast.error("Hash harus 64 karakter hex SHA-256");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await verifyH({
        data: { hash: hash.trim().toLowerCase(), token: token.trim() || undefined },
      });
      if (r.match) {
        setResult({ kind: "match", signed_at: r.signed_at as string, token: r.verification_token });
      } else {
        setResult({ kind: "mismatch", reason: r.reason });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal verifikasi");
    } finally {
      setBusy(false);
    }
  }

  async function checkByFile() {
    if (!file) return;
    if (file.size === 0 || file.size > MAX_UPLOAD) {
      toast.error("File tidak valid (maks 20MB)");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const r = await verifyU({
        data: { pdfBase64: btoa(bin), token: token.trim() || undefined },
      });
      if (r.match) {
        setResult({ kind: "match", signed_at: r.signed_at as string, token: r.verification_token });
      } else {
        setResult({ kind: "mismatch", reason: r.reason });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal verifikasi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container mx-auto flex-1 space-y-6 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="font-display text-2xl font-bold">Verifikasi Dokumen</h1>
          <p className="text-sm text-muted-foreground">
            Pastikan keaslian dokumen resmi dengan memasukkan SHA-256 hash atau
            mengunggah PDF. Server yang menghitung hash — data client tidak dipercaya.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>Pindai QR Dokumen</span>
                <Button
                  size="sm"
                  variant={scanning ? "outline" : "default"}
                  onClick={() => setScanning((v) => !v)}
                >
                  {scanning ? (
                    <>
                      <XIcon className="mr-1 h-4 w-4" /> Tutup Pemindai
                    </>
                  ) : (
                    <>
                      <ScanLine className="mr-1 h-4 w-4" /> Buka Kamera
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            {scanning && (
              <CardContent>
                <QrScanner onResult={handleScan} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Arahkan kamera ke QR pada dokumen resmi untuk verifikasi otomatis.
                </p>
              </CardContent>
            )}
          </Card>



          <Card>
            <CardHeader>
              <CardTitle>Verifikasi via Hash</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="SHA-256 hash (64 karakter hex)"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
              />
              <Input
                placeholder="Token verifikasi (opsional)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button onClick={checkByHash} disabled={busy}>
                {busy ? "Memeriksa…" : "Verifikasi Hash"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verifikasi via Upload PDF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button onClick={checkByFile} disabled={!file || busy}>
                {busy ? "Memverifikasi…" : "Verifikasi PDF"}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardContent className="pt-6">
                {result.kind === "match" ? (
                  <div className="flex items-start gap-3 text-emerald-700">
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                    <div>
                      <div className="font-semibold">Dokumen COCOK</div>
                      <div className="text-xs text-muted-foreground">
                        Ditandatangani {new Date(result.signed_at).toLocaleString("id-ID")}
                      </div>
                      {result.token && (
                        <div className="mt-1 text-xs">
                          Token:{" "}
                          <a
                            className="font-mono text-primary underline"
                            href={`/verify/${result.token}`}
                          >
                            {result.token}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 text-red-700">
                    <XCircle className="h-6 w-6 shrink-0" />
                    <div>
                      <div className="font-semibold">Tidak Cocok</div>
                      <div className="text-xs text-muted-foreground">
                        {result.reason === "revoked"
                          ? "Dokumen telah dicabut."
                          : result.reason === "expired"
                            ? "Dokumen telah kedaluwarsa."
                            : "Hash tidak ditemukan di registry resmi. Dokumen mungkin telah dimodifikasi."}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
