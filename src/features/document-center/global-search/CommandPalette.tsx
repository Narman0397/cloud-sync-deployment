// Command palette (Cmd/Ctrl+K) untuk navigasi cepat + search dokumen.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { dcSearch } from "@/lib/document-center.functions";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  PenLine,
  ShieldCheck,
  Archive,
  Activity,
  Boxes,
} from "lucide-react";

const ROUTES = [
  { label: "Dashboard Document Center", to: "/admin/document-center", icon: LayoutDashboard },
  { label: "Kotak Tugas", to: "/admin/document-center/inbox", icon: Inbox },
  { label: "Siklus Hidup (Kanban)", to: "/admin/document-center/lifecycle", icon: Activity },
  { label: "Semua Dokumen", to: "/admin/document-center/documents", icon: FileText },
  { label: "Antrian Tanda Tangan", to: "/admin/document-center/signature/queue", icon: PenLine },
  { label: "Spesimen & Sertifikat", to: "/admin/document-center/signature/specimens", icon: ShieldCheck },
  { label: "Monitoring TTE", to: "/admin/document-center/signature/monitoring", icon: Activity },
  { label: "Audit Trail TTE", to: "/admin/document-center/signature/audit", icon: FileText },
  { label: "Alur Kerja", to: "/admin/document-center/workflows", icon: Boxes },
  { label: "Template Dokumen", to: "/admin/document-center/templates", icon: FileText },
  { label: "Penomoran", to: "/admin/document-center/numbering", icon: FileText },
  { label: "Arsip", to: "/admin/document-center/archive", icon: Archive },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof dcSearch>>>>>([]);
  const navigate = useNavigate();
  const search = useServerFn(dcSearch);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    let cancel = false;
    const t = setTimeout(() => {
      search({ data: { q: q.trim() } })
        .then((r) => {
          if (!cancel) setHits(r);
        })
        .catch(() => {
          if (!cancel) setHits([]);
        });
    }, 200);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [q, search]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false}>
        <CommandInput placeholder="Cari halaman atau dokumen…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>Tidak ada hasil.</CommandEmpty>
          <CommandGroup heading="Halaman">
            {ROUTES.filter((r) => !q || r.label.toLowerCase().includes(q.toLowerCase())).map((r) => (
              <CommandItem
                key={r.to}
                value={r.label}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: r.to });
                }}
              >
                <r.icon className="mr-2 h-4 w-4" />
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {hits.length > 0 && (
            <CommandGroup heading="Dokumen & Tanda Tangan">
              {hits.map((h) => (
                <CommandItem
                  key={h.id}
                  value={h.label}
                  onSelect={() => {
                    setOpen(false);
                    if (h.kind === "doc") {
                      navigate({
                        to: "/admin/document-center/documents/$id",
                        params: { id: h.ref },
                      });
                    } else {
                      navigate({ to: "/admin/document-center/signature/queue" });
                    }
                  }}
                >
                  {h.kind === "doc" ? (
                    <FileText className="mr-2 h-4 w-4" />
                  ) : (
                    <PenLine className="mr-2 h-4 w-4" />
                  )}
                  <span className="truncate">{h.label}</span>
                  {h.hint && (
                    <span className="ml-auto text-[10px] text-muted-foreground">{h.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
