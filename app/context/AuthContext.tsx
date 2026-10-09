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
  setUser: (user: BaseUser | null) => void;
  /** Мгновенно обновляет имя/аватар в контексте на текущей вкладке после сохранения */
  updateProfile: (patch: ProfilePatch) => void;
  logout: () => Promise<void>;
  /** Перечитывает роль, имя и аватар из public.profiles */
  refreshRole: () => Promise<void>;
  hasRole: (allowed: readonly Role[]) => boolean;
  /** true, пока не известны и пользователь, и его роль */
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

type ProfileMeta = { role: Role; fullName: string | null; avatarUrl: string | null };

/**
 * Забирает роль, имя и аватар из public.profiles — источника правды.
 * При любой ошибке возвращает минимальную роль (resident), а не повышенную.
 */
async function fetchProfileMeta(userId: string): Promise<ProfileMeta> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Не удалось получить профиль пользователя:", error.message);
    return { role: DEFAULT_ROLE, fullName: null, avatarUrl: null };
  }

  const fullName = typeof data?.full_name === "string" ? data.full_name.trim() : "";

  return {
    role: isRole(data?.role) ? data.role : DEFAULT_ROLE,
    fullName: fullName || null,
    avatarUrl: (data?.avatar_url as string | null | undefined) ?? null,
  };
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
      if (hasAvatar && avatarUrl !== prev.avatarUrl) next = { ...next, avatarUrl };
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
    if (!userId) {
      setMeta(null);
      setMetaLoading(false);
      return;
    }

    let cancelled = false;
    setMetaLoading(true);

    fetchProfileMeta(userId).then((m) => {
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
    const m = await fetchProfileMeta(userId);
    setMeta({ userId, ...m });
    setMetaLoading(false);
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
  const avatarUrl = currentMeta?.avatarUrl ?? null;
  // profiles — источник правды; метадата сессии — пока профиль не загрузился
  const fullName = currentMeta?.fullName || baseUser?.fullName || FALLBACK_NAME;

  const user = useMemo<AppUser | null>(
    () => (baseUser ? { ...baseUser, fullName, avatarUrl } : null),
    [baseUser, fullName, avatarUrl]
  );

  const loading = authLoading || metaLoading || (!!baseUser && role === null);

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
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo<AuthContextType>(
    () => ({ user, role, setUser, updateProfile, logout, refreshRole, hasRole, loading }),
    [user, role, setUser, updateProfile, logout, refreshRole, hasRole, loading]
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
