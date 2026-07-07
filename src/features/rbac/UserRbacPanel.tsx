// Inline RBAC detail panel: digunakan sebagai expandable row pada Manajemen User.
// Mengelola ASN type, system position, permission override, dan audit per-user
// langsung di halaman existing tanpa menu admin terpisah.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, Trash2, Loader2 } from "lucide-react";
import {
  rbacGetUser,
  rbacUpdateProfileMeta,
  rbacSetPermissionOverride,
  rbacRemovePermissionOverride,
  rbacAuditForUser,
} from "./admin.functions";
import {
  ASN_TYPES,
  POSITIONS,
  ASN_TYPE_LABEL,
  POSITION_LABEL,
  type AsnType,
  type SystemPosition,
} from "./constants";

type Override = {
  permission_code: string;
  granted: boolean;
  expires_at: string | null;
  reason: string | null;
};
type Catalog = { code: string; label: string; kategori: string; description: string | null };
type Audit = {
  id: string;
  created_at: string;
  aksi: string;
  entitas: string;
  actor_name: string;
  target_name: string;
};
type State = {
  profile: { asn_type: AsnType | null; system_position: SystemPosition | null } | null;
  overrides: Override[];
  effective: string[];
  catalog: Catalog[];
};

type Tab = "klasifikasi" | "permissions" | "audit";

export function UserRbacPanel({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("klasifikasi");
  const [s, setS] = useState<State | null>(null);
  const [audit, setAudit] = useState<Audit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    rbacGetUser({ data: { user_id: userId } }).then((r) => setS(r as unknown as State));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  useEffect(() => {
    if (tab === "audit" && audit === null) {
      rbacAuditForUser({ data: { user_id: userId, limit: 30 } }).then((r) =>
        setAudit(r.rows as unknown as Audit[]),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  async function saveMeta(patch: {
    asn_type?: AsnType | null;
    system_position?: SystemPosition | null;
  }) {
    setBusy(true);
    setMsg(null);
    try {
      await rbacUpdateProfileMeta({ data: { user_id: userId, ...patch } });
      setMsg("Tersimpan.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }
  async function setOverride(code: string, granted: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await rbacSetPermissionOverride({
        data: { user_id: userId, permission_code: code, granted },
      });
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }
  async function clearOverride(code: string) {
    setBusy(true);
    setMsg(null);
    try {
      await rbacRemovePermissionOverride({ data: { user_id: userId, permission_code: code } });
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  const overrideMap = useMemo(
    () => new Map((s?.overrides ?? []).map((o) => [o.permission_code, o])),
    [s?.overrides],
  );
  const effectiveSet = useMemo(() => new Set(s?.effective ?? []), [s?.effective]);
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Catalog[]>();
    for (const c of s?.catalog ?? []) {
      const arr = groups.get(c.kategori) ?? [];
      arr.push(c);
      groups.set(c.kategori, arr);
    }
    return Array.from(groups.entries());
  }, [s?.catalog]);

  const handleGrant = useCallback((code: string) => setOverride(code, true), []);
  const handleDeny = useCallback((code: string) => setOverride(code, false), []);
  const handleClear = useCallback((code: string) => clearOverride(code), []);

  if (!s) {
    return (
      <div className="px-4 py-6 text-xs text-muted-foreground">
        <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Memuat detail RBAC…
      </div>
    );
  }


  return (
    <div className="border-t border-border bg-surface/40 px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border">
        {(
          [
            ["klasifikasi", "Klasifikasi ASN"],
            [
              "permissions",
              `Permission (${effectiveSet.size} aktif · ${s.overrides.length} override)`,
            ],
            ["audit", "Audit RBAC"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold transition ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
        {msg && <span className="ml-auto text-[11px] text-muted-foreground">{msg}</span>}
      </div>

      {tab === "klasifikasi" && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Tipe ASN</span>
            <select
              disabled={busy}
              value={s.profile?.asn_type ?? ""}
              onChange={(e) => saveMeta({ asn_type: (e.target.value || null) as AsnType | null })}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— belum diatur —</option>
              {Object.values(ASN_TYPES).map((v) => (
                <option key={v} value={v}>
                  {ASN_TYPE_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Jabatan Sistem</span>
            <select
              disabled={busy}
              value={s.profile?.system_position ?? ""}
              onChange={(e) =>
                saveMeta({ system_position: (e.target.value || null) as SystemPosition | null })
              }
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">— belum diatur —</option>
              {Object.values(POSITIONS).map((v) => (
                <option key={v} value={v}>
                  {POSITION_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">
            Klasifikasi ini tidak menggantikan Role utama; digunakan untuk workflow approval,
            targeting, dan filter dashboard.
          </p>
        </div>
      )}

      {tab === "permissions" && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            ✓ hijau = aktif lewat role. <strong>Grant</strong> memaksa aktif; <strong>Deny</strong>{" "}
            memaksa nonaktif; Hapus override mengembalikan ke role default.
          </p>
          {groupedPermissions.map(([kategori, items]) => (
            <div key={kategori}>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {kategori}
              </div>
              <ul className="divide-y divide-border rounded-md border border-border bg-card">
                {items.map((p) => (
                  <PermissionRow
                    key={p.code}
                    perm={p}
                    override={overrideMap.get(p.code) ?? null}
                    active={effectiveSet.has(p.code)}
                    busy={busy}
                    onGrant={handleGrant}
                    onDeny={handleDeny}
                    onClear={handleClear}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div>
          {audit === null ? (
            <div className="text-xs text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Memuat audit…
            </div>
          ) : audit.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              Belum ada aktivitas RBAC pada user ini.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {audit.map((a) => (
                <li key={a.id} className="px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{a.aksi}</span>
                    <code className="text-[10px] text-muted-foreground">{a.entitas}</code>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Oleh: {a.actor_name || "—"} → Target: {a.target_name || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type PermissionRowProps = {
  perm: Catalog;
  override: Override | null;
  active: boolean;
  busy: boolean;
  onGrant: (code: string) => void;
  onDeny: (code: string) => void;
  onClear: (code: string) => void;
};

const PermissionRow = memo(function PermissionRow({
  perm,
  override,
  active,
  busy,
  onGrant,
  onDeny,
  onClear,
}: PermissionRowProps) {
  return (
    <li
      className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
      style={{ contentVisibility: "auto", containIntrinsicSize: "56px" }}
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}
      >
        {active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{perm.label}</span>
          <code className="text-[10px] text-muted-foreground">{perm.code}</code>
          {override && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${override.granted ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
            >
              {override.granted ? "GRANT" : "DENY"}
            </span>
          )}
        </div>
        {perm.description && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{perm.description}</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={busy}
          onClick={() => onGrant(perm.code)}
          className="rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[10px] font-semibold text-success hover:bg-success/20"
        >
          Grant
        </button>
        <button
          disabled={busy}
          onClick={() => onDeny(perm.code)}
          className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/20"
        >
          Deny
        </button>
        {override && (
          <button
            disabled={busy}
            onClick={() => onClear(perm.code)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted"
            aria-label="Hapus override"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </li>
  );
});
