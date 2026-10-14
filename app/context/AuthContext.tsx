"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Cookies from "js-cookie";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Роли
// ---------------------------------------------------------------------------
export const ROLES = ["owner", "admin", "manager", "resident"] as const;
export type Role = (typeof ROLES)[number];
export type ResidentSegment = "working" | "elite";
export const DEFAULT_ROLE: Role = "resident";

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------
/** То, что известно из сессии Supabase Auth (user_metadata) */
export type BaseUser = {
  id: string;
  email: string;
  fullName: string;
};

/** То, что отдаёт контекст: сессия + данные из public.profiles */
export type AppUser = BaseUser & {
  avatarUrl: string | null;
};

type ProfilePatch = Partial<Pick<AppUser, "fullName" | "avatarUrl">>;

type AuthContextType = {
  user: AppUser | null;
  role: Role | null;
  segment: ResidentSegment | null;
  setUser: (user: BaseUser | null) => void;
  /** Мгновенно обновляет имя/аватар в контексте на текущей вкладке после сохранения */
  updateProfile: (patch: ProfilePatch) => void;
  logout: () => Promise<void>;
  /** Перечитывает роль, имя и аватар из public.profiles */
  refreshRole: () => Promise<void>;
  hasRole: (allowed: readonly Role[]) => boolean;
  /** true, пока проверяются сессия или метаданные текущего профиля */
  loading: boolean;
};

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------
const TOKEN_COOKIE = "voyage_token";
const FALLBACK_NAME = "Резидент";

const setSessionCookie = () =>
  Cookies.set(TOKEN_COOKIE, "true", {
    expires: 7,
    sameSite: "lax",
    // На http://localhost кука с secure не сохраняется
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  });

const clearSessionCookie = () => Cookies.remove(TOKEN_COOKIE);

/** Непустая строка из user_metadata или null */
function readMetaString(u: SupabaseUser, key: string): string | null {
  const value = u.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const mapUser = (u: SupabaseUser): BaseUser => ({
  id: u.id,
  email: u.email ?? "",
  // full_name — стандарт. name — legacy-ключ у тех, кто ещё ни разу не пересохранял профиль
  fullName: readMetaString(u, "full_name") ?? readMetaString(u, "name") ?? FALLBACK_NAME,
});

type ProfileMeta = { role: Role | null; segment: ResidentSegment; fullName: string | null; avatarUrl: string | null };

const EMPTY_PROFILE_META: ProfileMeta = {
  // Do not synthesize `resident` when profile lookup fails. A missing/invalid role
  // must fail closed instead of silently changing the user's effective identity.
  role: null,
  segment: "working",
  fullName: null,
  avatarUrl: null,
};

/** Reads identity metadata from public.profiles, the source of truth for roles. */
async function fetchProfileMeta(userId: string): Promise<ProfileMeta> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role, full_name, avatar_url, segment")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Could not resolve user profile metadata:", {
        code: error.code,
        message: error.message,
      });
      return EMPTY_PROFILE_META;
    }

    if (!data) {
      console.error("Could not resolve user profile metadata: profile row is missing");
      return EMPTY_PROFILE_META;
    }

    const role = isRole(data.role) ? data.role : null;
    if (role === null) {
      console.error("Profile has an invalid role value; access will be denied");
    }

    const fullName = typeof data.full_name === "string" ? data.full_name.trim() : "";
    const storedAvatar = (data.avatar_url as string | null | undefined) ?? null;
    let avatarUrl = storedAvatar;

    // avatar_url may contain a Storage object path in the private user-uploads bucket.
    // Resolve it to a short-lived URL for rendering; never persist signed URLs.
    if (storedAvatar && !/^https?:\/\//i.test(storedAvatar)) {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("user-uploads")
          .createSignedUrl(storedAvatar, 60 * 60);
        if (signedError) {
          console.error("Could not resolve private profile avatar:", signedError.name);
          avatarUrl = null;
        } else {
          avatarUrl = signedData?.signedUrl ?? null;
        }
      } catch (error) {
        // A temporary Storage issue must not erase a successfully read account role.
        console.error("Could not resolve private profile avatar:",
          error instanceof Error ? error.message : "unknown error");
        avatarUrl = null;
      }
    }

    return {
      role,
      segment: data.segment === "elite" ? "elite" : "working",
      fullName: fullName || null,
      avatarUrl,
    };
  } catch (error) {
    console.error("Unexpected error while resolving user profile metadata:",
      error instanceof Error ? error.message : "unknown error");
    return EMPTY_PROFILE_META;
  }
}

// ---------------------------------------------------------------------------
// Контекст
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [baseUser, setBaseUser] = useState<BaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Данные профиля храним вместе с id пользователя, которому они принадлежат:
  // при смене аккаунта старые данные ни на мгновение не применятся к новому юзеру.
  // Отдельно от baseUser — чтобы TOKEN_REFRESHED их не затирал.
  const [meta, setMeta] = useState<({ userId: string } & ProfileMeta) | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  // Не перерисовываем всё приложение, если пришёл тот же самый пользователь
  // (например, при TOKEN_REFRESHED)
  const setUser = useCallback((next: BaseUser | null) => {
    setBaseUser((prev) => {
      if (
        prev &&
        next &&
        prev.id === next.id &&
        prev.email === next.email &&
        prev.fullName === next.fullName
      ) {
        return prev;
      }
      return next ? { id: next.id, email: next.email, fullName: next.fullName } : null;
    });
  }, []);

  /**
   * Переносит свежие user_metadata (full_name, avatar_url) в данные профиля.
   * Синхронная функция: вызывается прямо из onAuthStateChange без запросов к Supabase.
   * Если профиль ещё грузится — ничего не делаем: fetchProfileMeta вернёт уже
   * обновлённую строку (настройки пишут в profiles раньше, чем в метадату).
   */
  const applyMetadataToProfile = useCallback((u: SupabaseUser) => {
    const md = u.user_metadata ?? {};
    const fullName = readMetaString(u, "full_name");
    const hasAvatar = Object.prototype.hasOwnProperty.call(md, "avatar_url");
    const avatarUrl = readMetaString(u, "avatar_url");

    setMeta((prev) => {
      if (!prev || prev.userId !== u.id) return prev;
      let next = prev;
      if (fullName && fullName !== prev.fullName) next = { ...next, fullName };
      if (hasAvatar && avatarUrl && /^https?:\/\//i.test(avatarUrl) && avatarUrl !== prev.avatarUrl) next = { ...next, avatarUrl };
      return next;
    });
  }, []);

  // --- 1. Сессия Supabase Auth ---------------------------------------------
  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (sbUser) {
        setUser(mapUser(sbUser));
        setSessionCookie();
      } else {
        setUser(null);
        clearSessionCookie();
      }
      setAuthLoading(false);
    };

    bootstrapAuth();

    // Внутри этого колбэка нельзя делать await-запросы к Supabase (возможен deadlock),
    // поэтому здесь только синхронные обновления стейта.
    //
    // USER_UPDATED приходит после supabase.auth.updateUser() в настройках.
    // supabase-js транслирует auth-события в другие вкладки того же origin
    // (BroadcastChannel), поэтому Сайдбар и Футер обновятся везде.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setUser(null);
        clearSessionCookie();
        return;
      }

      setUser(mapUser(session.user));
      setSessionCookie();

      if (event === "USER_UPDATED") {
        applyMetadataToProfile(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, applyMetadataToProfile]);

  // --- 2. Роль, имя и аватар из public.profiles ------------------------------
  const userId = baseUser?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setMeta(null);
      setMetaLoading(false);
      return;
    }

    setMetaLoading(true);
    void fetchProfileMeta(userId).then((m) => {
      if (cancelled) return;
      setMeta({ userId, ...m });
      setMetaLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshRole = useCallback(async () => {
    if (!userId) return;
    setMetaLoading(true);
    try {
      const m = await fetchProfileMeta(userId);
      setMeta({ userId, ...m });
    } finally {
      setMetaLoading(false);
    }
  }, [userId]);

  // --- 3. Мгновенное обновление после сохранения в настройках --------------
  // Страховка для текущей вкладки на случай, если updateUser упал,
  // а запись в profiles прошла.
  const updateProfile = useCallback((patch: ProfilePatch) => {
    if (patch.fullName !== undefined) {
      const fullName = patch.fullName;
      setBaseUser((prev) => (prev && prev.fullName !== fullName ? { ...prev, fullName } : prev));
      setMeta((prev) => (prev && prev.fullName !== fullName ? { ...prev, fullName } : prev));
    }
    if (patch.avatarUrl !== undefined) {
      const avatarUrl = patch.avatarUrl;
      setMeta((prev) => (prev && prev.avatarUrl !== avatarUrl ? { ...prev, avatarUrl } : prev));
    }
  }, []);

  // Данные профиля отдаём только если они относятся к текущему пользователю
  const currentMeta = baseUser && meta?.userId === baseUser.id ? meta : null;
  const role: Role | null = currentMeta?.role ?? null;
  const segment: ResidentSegment | null = currentMeta?.segment ?? null;
  const avatarUrl = currentMeta?.avatarUrl ?? null;
  // profiles — источник правды; метадата сессии — пока профиль не загрузился
  const fullName = currentMeta?.fullName || baseUser?.fullName || FALLBACK_NAME;

  const user = useMemo<AppUser | null>(
    () => (baseUser ? { ...baseUser, fullName, avatarUrl } : null),
    [baseUser, fullName, avatarUrl]
  );

  // role === null can mean a completed lookup failed or the profile is invalid.
  // Keep loading tied to the lookup lifecycle; RoleGuard can then deny access for null.
  const loading = authLoading || (!!baseUser && (metaLoading || currentMeta === null));

  const hasRole = useCallback(
    (allowed: readonly Role[]) => role !== null && allowed.includes(role),
    [role]
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Ошибка при выходе:", err);
    } finally {
      clearSessionCookie();
      setMeta(null);
      setMetaLoading(false);
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo<AuthContextType>(
    () => ({ user, role, segment, setUser, updateProfile, logout, refreshRole, hasRole, loading }),
    [user, role, segment, setUser, updateProfile, logout, refreshRole, hasRole, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return context;
}
