import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// AppRole mencakup role baru `admin_pemda` & `pimpinan`. Role lama tetap.
export type AppRole =
  | "warga"
  | "admin_opd"
  | "super_admin"
  | "admin_desa"
  | "asn"
  | "admin_pemda"
  | "pimpinan"
  | "admin_bkpsdm"
  | "kepala_bkpsdm";

export type AsnTypeValue = "pns" | "pppk_penuh_waktu" | "pppk_paruh_waktu" | "honorer";
export type SystemPositionValue =
  | "kepala_opd"
  | "sekretaris"
  | "kepala_bidang"
  | "kepala_sekolah"
  | "operator"
  | "verifikator"
  | "staff"
  | "guru"
  | "tenaga_teknis"
  | "lainnya";

export type AuthProfile = {
  nama_lengkap: string | null;
  nik: string | null;
  no_hp: string | null;
  desa: string | null;
  verified_at: string | null;
  verified_by: string | null;
  verification_status: string | null;
  requested_role: string | null;
};

// ---------------------------------------------------------------------------
// Context value types — disusun menjadi 3 slice agar consumer hanya
// re-render saat slice yang dibutuhkannya berubah (Wave 2 optimization).
// ---------------------------------------------------------------------------

type AuthUserCtxValue = {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  isVerified: boolean;
};

type AuthRolesCtxValue = {
  roles: AppRole[];
  permissions: Set<string>;
  asnType: AsnTypeValue | null;
  systemPosition: SystemPositionValue | null;
  pimpinanType: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAdminDesa: boolean;
  isAdminOpd: boolean;
  isAdminPemda: boolean;
  isPimpinan: boolean;
  isAdminBkpsdm: boolean;
  isKepalaBkpsdm: boolean;
  isWarga: boolean;
  isBupati: boolean;
  isElevated: boolean;
  isElevatedView: boolean;
  isAsn: boolean;
  isStaff: boolean;
  can: (permission: string) => boolean;
};

type AuthActionsCtxValue = {
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
};

// Full ctx tetap dipertahankan demi backward compatibility (useAuth).
type AuthCtx = AuthUserCtxValue & AuthRolesCtxValue & AuthActionsCtxValue;

const UserCtx = createContext<AuthUserCtxValue | undefined>(undefined);
const RolesCtx = createContext<AuthRolesCtxValue | undefined>(undefined);
const ActionsCtx = createContext<AuthActionsCtxValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [asnType, setAsnType] = useState<AsnTypeValue | null>(null);
  const [systemPosition, setSystemPosition] = useState<SystemPositionValue | null>(null);
  const [pimpinanType, setPimpinanType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const DEBUG_AUTH = typeof import.meta !== "undefined" && import.meta.env?.DEV;
  const debug = useCallback(
    (...args: unknown[]) => {
      if (DEBUG_AUTH) console.debug("[auth]", ...args);
    },
    [DEBUG_AUTH],
  );

  const loadRoles = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (error) {
        debug("loadRoles error", error.message);
        return;
      }
      setRoles((data ?? []).map((r) => r.role as AppRole));
    },
    [debug],
  );

  const loadProfile = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("nama_lengkap,nik,no_hp,desa,verified_at,verified_by,asn_type,system_position,verification_status,requested_role" as any)
        .eq("id", uid)
        .maybeSingle();
      if (error) {
        debug("loadProfile error", error.message);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      setProfile(
        row
          ? {
              nama_lengkap: row.nama_lengkap,
              nik: row.nik,
              no_hp: row.no_hp,
              desa: row.desa,
              verified_at: row.verified_at,
              verified_by: row.verified_by,
              verification_status: row.verification_status ?? null,
              requested_role: row.requested_role ?? null,
            }
          : null,
      );
      setAsnType(row?.asn_type ?? null);
      setSystemPosition(row?.system_position ?? null);

      // Load pejabat aktif untuk derive isBupati & pimpinanType.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pej } = await (supabase as any)
        .from("pejabat")
        .select("pimpinan_type")
        .eq("user_id", uid)
        .eq("aktif", true)
        .maybeSingle();
      setPimpinanType((pej?.pimpinan_type as string | null) ?? null);
    },
    [debug],
  );

  const loadPermissions = useCallback(
    async (uid: string, attempt = 0): Promise<void> => {
      const { data, error } = await supabase.rpc("get_effective_permissions", { _user_id: uid });
      if (error) {
        debug("loadPermissions error", error.message, "attempt", attempt);
        // Exponential backoff retry: 3 attempts (400ms, 1200ms, 3600ms)
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * Math.pow(3, attempt)));
          return loadPermissions(uid, attempt + 1);
        }
        setPermissions(new Set());
        if (typeof window !== "undefined") {
          try {
            const mod = await import("sonner");
            mod.toast.error("Gagal memuat izin akses. Beberapa fitur mungkin tidak tersedia.", {
              id: "perm-load-fail",
            });
          } catch {
            /* sonner mungkin belum terpasang */
          }
        }
        return;
      }
      const codes = ((data as unknown as Array<{ code: string }> | null) ?? [])
        .map((r) => r.code)
        .filter(Boolean);
      setPermissions(new Set(codes));
    },
    [debug],
  );

  const loadAll = useCallback(
    async (uid: string) => {
      await Promise.all([loadRoles(uid), loadProfile(uid), loadPermissions(uid)]);
    },
    [loadRoles, loadProfile, loadPermissions],
  );

  useEffect(() => {
    let settled = false;
    let lastLoadedUid: string | null = null;
    let inflight: Promise<void> | null = null;
    const markSettled = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    const syncForSession = async (sess: Session | null, source: string) => {
      const uid = sess?.user?.id ?? null;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!uid) {
        lastLoadedUid = null;
        setRoles([]);
        setProfile(null);
        setPermissions(new Set());
        setAsnType(null);
        setSystemPosition(null);
        setPimpinanType(null);
        return;
      }
      if (uid === lastLoadedUid && inflight) {
        debug("syncForSession dedupe", source, uid);
        return inflight;
      }
      lastLoadedUid = uid;
      debug("syncForSession load", source, uid);
      inflight = loadAll(uid).finally(() => {
        inflight = null;
      });
      return inflight;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      debug("onAuthStateChange", event);
      setTimeout(() => {
        void syncForSession(sess, `event:${event}`);
      }, 0);
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        markSettled();
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: sess } }) => {
        void syncForSession(sess, "getSession").finally(markSettled);
      })
      .catch((e) => {
        debug("getSession failed", e);
        markSettled();
      });

    const safety = setTimeout(markSettled, 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: dengarkan perubahan profil pengguna saat ini.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row) return;
          setProfile({
            nama_lengkap: (row.nama_lengkap as string | null) ?? null,
            nik: (row.nik as string | null) ?? null,
            no_hp: (row.no_hp as string | null) ?? null,
            desa: (row.desa as string | null) ?? null,
            verified_at: (row.verified_at as string | null) ?? null,
            verified_by: (row.verified_by as string | null) ?? null,
            verification_status: (row.verification_status as string | null) ?? null,
            requested_role: (row.requested_role as string | null) ?? null,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Forced logout bila role berkurang (downgrade) sejak snapshot terakhir.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    let lastSnapshot = roles.slice().sort().join("|");
    const channel = supabase
      .channel(`roles-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
        async () => {
          const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
          const next = (data ?? [])
            .map((r) => r.role as AppRole)
            .slice()
            .sort()
            .join("|");
          if (next !== lastSnapshot) {
            const prev = new Set(lastSnapshot.split("|").filter(Boolean));
            const now = new Set(next.split("|").filter(Boolean));
            const downgraded = [...prev].some((r) => !now.has(r));
            lastSnapshot = next;
            if (downgraded) {
              await supabase.auth.signOut();
              if (typeof window !== "undefined") window.location.assign("/auth");
              return;
            }
            setRoles((data ?? []).map((r) => r.role as AppRole));
            await loadPermissions(uid);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadPermissions]);

  // Realtime: dengarkan perubahan permission override.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const channel = supabase
      .channel(`perms-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_permissions",
          filter: `user_id=eq.${uid}`,
        },
        () => {
          loadPermissions(uid);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadPermissions]);

  // Refetch saat tab kembali aktif (≥ 30 detik).
  useEffect(() => {
    if (!user?.id) return;
    if (typeof document === "undefined") return;
    const uid = user.id;
    let last = Date.now();
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      loadPermissions(uid);
      loadProfile(uid);
      loadRoles(uid);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [user?.id, loadPermissions, loadProfile, loadRoles]);

  // --- Derived flags & memoized slice values --------------------------------

  const isVerified = useMemo(
    () =>
      !!profile?.verified_at ||
      roles.includes("super_admin") ||
      roles.includes("admin_pemda") ||
      roles.includes("pimpinan") ||
      roles.includes("admin_opd") ||
      roles.includes("admin_desa"),
    [profile?.verified_at, roles],
  );

  const userValue = useMemo<AuthUserCtxValue>(
    () => ({ user, session, profile, loading, isVerified }),
    [user, session, profile, loading, isVerified],
  );

  const rolesValue = useMemo<AuthRolesCtxValue>(() => {
    const isSuperAdmin = roles.includes("super_admin");
    const isAdminPemda = roles.includes("admin_pemda");
    const isPimpinan = roles.includes("pimpinan");
    const isAdminDesa = roles.includes("admin_desa");
    const isAdminOpd = roles.includes("admin_opd");
    const isAsn = roles.includes("asn");
    const isAdminBkpsdm = roles.includes("admin_bkpsdm");
    const isKepalaBkpsdm = roles.includes("kepala_bkpsdm");
    const isWarga =
      roles.length === 0 ||
      (roles.includes("warga") &&
        !isSuperAdmin &&
        !isAdminPemda &&
        !isPimpinan &&
        !isAdminDesa &&
        !isAdminOpd &&
        !isAdminBkpsdm &&
        !isKepalaBkpsdm &&
        !isAsn);
    return {
      roles,
      permissions,
      asnType,
      systemPosition,
      pimpinanType,
      isAdmin: isAdminOpd || isSuperAdmin || isAdminDesa || isAdminPemda || isAdminBkpsdm,
      isSuperAdmin,
      isAdminDesa,
      isAdminOpd,
      isAdminPemda,
      isPimpinan,
      isAdminBkpsdm,
      isKepalaBkpsdm,
      isWarga,
      isBupati: isPimpinan && pimpinanType === "bupati",
      isElevated: isSuperAdmin || isAdminPemda || isAdminBkpsdm,
      isElevatedView: isSuperAdmin || isAdminPemda || isPimpinan || isKepalaBkpsdm,
      isAsn,
      isStaff:
        isSuperAdmin ||
        isAdminPemda ||
        isPimpinan ||
        isAdminOpd ||
        isAdminDesa ||
        isAsn ||
        isAdminBkpsdm ||
        isKepalaBkpsdm,
      can: (p: string) => isSuperAdmin || permissions.has(p),
    };
  }, [roles, permissions, asnType, systemPosition, pimpinanType]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);
  const refreshRoles = useCallback(async () => {
    if (user) await loadRoles(user.id);
  }, [user, loadRoles]);
  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);
  const refreshPermissions = useCallback(async () => {
    if (user) await loadPermissions(user.id);
  }, [user, loadPermissions]);

  const actionsValue = useMemo<AuthActionsCtxValue>(
    () => ({ signOut, refreshRoles, refreshProfile, refreshPermissions }),
    [signOut, refreshRoles, refreshProfile, refreshPermissions],
  );

  return (
    <ActionsCtx.Provider value={actionsValue}>
      <RolesCtx.Provider value={rolesValue}>
        <UserCtx.Provider value={userValue}>{children}</UserCtx.Provider>
      </RolesCtx.Provider>
    </ActionsCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks: slice-specific (new, preferred) + full back-compat `useAuth`.
// ---------------------------------------------------------------------------

export function useAuthUser(): AuthUserCtxValue {
  const v = useContext(UserCtx);
  if (!v) throw new Error("useAuthUser must be used within AuthProvider");
  return v;
}

export function useAuthRoles(): AuthRolesCtxValue {
  const v = useContext(RolesCtx);
  if (!v) throw new Error("useAuthRoles must be used within AuthProvider");
  return v;
}

export function useAuthActions(): AuthActionsCtxValue {
  const v = useContext(ActionsCtx);
  if (!v) throw new Error("useAuthActions must be used within AuthProvider");
  return v;
}

/**
 * Back-compat aggregator. Komponen baru sebaiknya pakai slice hook spesifik
 * (`useAuthUser`, `useAuthRoles`, `useAuthActions`) agar hanya re-render saat
 * slice yang dibaca berubah.
 */
export function useAuth(): AuthCtx {
  const u = useAuthUser();
  const r = useAuthRoles();
  const a = useAuthActions();
  return useMemo(() => ({ ...u, ...r, ...a }), [u, r, a]);
}
