"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · NAVBAR — app/components/Navbar.tsx
 *
 * Mobile-first:
 *   < md  — 56 px + вырез iPhone: [☰] VOYAGE ·········· [RU ▾] (аватар)
 *           профиль открывается шторкой снизу (bottom sheet, свайп вниз);
 *   ≥ md  — прежняя шапка: ползунок 4 языков + «пилюля» с именем и
 *           выпадающее меню (не шире экрана: max-w-[calc(100vw-2rem)]).
 *
 * Шапка больше никогда не шире экрана: раньше на 428 px (iPhone 13 Pro
 * Max) её содержимое занимало ~580 px — iOS из-за этого отдалял ВСЮ
 * страницу, и брейкпоинты Tailwind переставали срабатывать.
 *
 * ☰ открывает Sidebar через useMobileMenu (app/context/MobileMenuContext)
 * и показывается, только если на странице есть сайдбар (кабинет, админка).
 * Свою высоту шапка пишет в --nav-h — по ней отступает layout кабинета.
 *
 * Роль — из AuthContext (public.profiles.role): owner / admin / manager /
 * resident / guest, на языке интерфейса.
 * ──────────────────────────────────────────────────────────────────── */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Crown, LayoutDashboard, LogIn, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import UserAvatar from "@/app/components/UserAvatar";
import { useLanguage, LANGS, type Lang } from "@/app/context/LanguageContext";
import {
  useIsClient,
  useMobileMenu,
  useRegisterNavbar,
  useScrollLock,
} from "@/app/context/MobileMenuContext";

type Labels = {
  login: string;
  loginShort: string;
  dashboard: string;
  logout: string;
  member: string;
  openMenu: string;
  language: string;
  account: string;
  close: string;
  roles: Record<string, string>;
};

const t: Record<Lang, Labels> = {
  EN: {
    login: "Member Login",
    loginShort: "Sign in",
    dashboard: "Dashboard",
    logout: "Logout",
    member: "Member",
    openMenu: "Open menu",
    language: "Language",
    account: "Account",
    close: "Close",
    roles: { owner: "Owner", admin: "Admin", manager: "Manager", resident: "Resident", guest: "Guest" },
  },
  RU: {
    login: "Вход для резидентов",
    loginShort: "Войти",
    dashboard: "Кабинет",
    logout: "Выйти",
    member: "Резидент",
    openMenu: "Открыть меню",
    language: "Язык",
    account: "Аккаунт",
    close: "Закрыть",
    roles: { owner: "Владелец", admin: "Админ", manager: "Менеджер", resident: "Резидент", guest: "Гостья" },
  },
  ES: {
    login: "Acceso de miembros",
    loginShort: "Entrar",
    dashboard: "Panel",
    logout: "Cerrar sesión",
    member: "Miembro",
    openMenu: "Abrir menú",
    language: "Idioma",
    account: "Cuenta",
    close: "Cerrar",
    roles: { owner: "Propietario", admin: "Admin", manager: "Gerente", resident: "Residente", guest: "Invitada" },
  },
  PT: {
    login: "Área do membro",
    loginShort: "Entrar",
    dashboard: "Painel",
    logout: "Sair",
    member: "Membro",
    openMenu: "Abrir menu",
    language: "Idioma",
    account: "Conta",
    close: "Fechar",
    roles: { owner: "Proprietário", admin: "Admin", manager: "Gerente", resident: "Residente", guest: "Convidada" },
  },
};

const LANG_NAMES: Record<Lang, string> = {
  EN: "English",
  RU: "Русский",
  ES: "Español",
  PT: "Português",
};

/** Цвет подписи роли: руководство — золото, менеджер — небесный, остальные — нейтральный */
const ROLE_TONE: Record<string, string> = {
  owner: "text-amber-200",
  admin: "text-amber-200/80",
  manager: "text-sky-200/80",
  resident: "text-zinc-500",
  guest: "text-zinc-500",
};

/** Имя-заглушка из AuthContext (FALLBACK_NAME), когда full_name пуст */
const AUTH_FALLBACK_NAME = "Резидент";

// Смещение ползунка: 0px, 32px, 64px, 96px (каждая кнопка w-8 = 32px)
const SLIDER_OFFSET: Record<Lang, string> = {
  EN: "translateX(0px)",
  RU: "translateX(32px)",
  ES: "translateX(64px)",
  PT: "translateX(96px)",
};

/** Кривая iOS-шторок */
const IOS_EASE = "cubic-bezier(0.32,0.72,0,1)";

const DESKTOP = "(min-width: 768px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
}

/* ══════════════════════════════════════════════════════════════════
 * ЯЗЫК
 * ══════════════════════════════════════════════════════════════════ */

/** Десктоп: прежний ползунок на 4 языка */
function LangSlider({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="relative hidden rounded-full border border-white/10 bg-zinc-900/70 p-1 md:flex">
      <span
        aria-hidden
        className="absolute left-1 top-1 h-7 w-8 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.35)] transition-transform duration-300 ease-out"
        style={{ transform: SLIDER_OFFSET[lang] }}
      />
      {LANGS.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLang(code)}
            className={`relative z-10 h-7 w-8 text-[11px] font-semibold tracking-wider transition-colors duration-300 ${
              active ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}

/** Мобильная: одна компактная кнопка «RU ▾» + список языков */
function LangPicker({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${LANG_NAMES[lang]}`}
        className={`flex h-9 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold tracking-[0.14em] transition-colors ${
          open ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-white/10 bg-zinc-900/70 text-zinc-200"
        }`}
      >
        {lang}
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        className={`absolute right-0 top-full mt-2 w-44 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-200 ${
          open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {LANGS.map((code) => {
          const active = code === lang;
          return (
            <li key={code} role="option" aria-selected={active}>
              <button
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors ${
                  active ? "bg-amber-200/10 text-amber-100" : "text-zinc-300 active:bg-white/5"
                }`}
              >
                <span className="w-6 font-mono text-[11px] tracking-wider text-zinc-500">{code}</span>
                <span className="flex-1">{LANG_NAMES[code]}</span>
                {active && <Check aria-hidden className="h-4 w-4 text-amber-200" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ПРОФИЛЬ
 * ══════════════════════════════════════════════════════════════════ */

type ProfileView = {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  displayName: string;
  roleLabel: string | null;
  roleTone: string;
  isLeadership: boolean;
  loading: boolean;
  labels: Labels;
};

function RoleLine({ roleLabel, roleTone, isLeadership, loading, labels }: Omit<ProfileView, "user" | "displayName">) {
  if (roleLabel) {
    return (
      <p className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] ${roleTone}`}>
        {isLeadership && <Crown className="h-3 w-3 shrink-0" strokeWidth={1.6} aria-hidden />}
        <span className="truncate">{roleLabel}</span>
      </p>
    );
  }
  if (loading) return <span aria-hidden className="block h-2.5 w-16 animate-pulse rounded bg-white/10" />;
  return <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{labels.member}</p>;
}

/** Мобильная шторка профиля: снизу, со свайпом вниз, поверх всего */
function ProfileSheet({
  open,
  onClose,
  onLogout,
  view,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  view: ProfileView;
}) {
  const isClient = useIsClient();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLAnchorElement>(null);
  const touch = useRef<{ y: number; dy: number } | null>(null);
  const [drag, setDrag] = useState(0);

  useScrollLock(open);

  // закрытая шторка недоступна ни для фокуса, ни для скринридера
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.inert = !open;
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    firstRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!isClient) return null;

  const { user, displayName, labels } = view;

  return createPortal(
    <div className={`fixed inset-0 z-[80] overflow-hidden md:hidden ${open ? "" : "pointer-events-none"}`}>
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-md transition-opacity duration-300"
        style={{ opacity: open ? 1 - Math.min(drag / 400, 0.6) : 0 }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onTouchStart={(e) => {
          touch.current = { y: e.touches[0].clientY, dy: 0 };
        }}
        onTouchMove={(e) => {
          if (!touch.current) return;
          const dy = Math.max(0, e.touches[0].clientY - touch.current.y);
          touch.current.dy = dy;
          setDrag(dy);
        }}
        onTouchEnd={() => {
          const dy = touch.current?.dy ?? 0;
          touch.current = null;
          setDrag(0);
          if (dy > 90) onClose();
        }}
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-amber-200/20 bg-zinc-950/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
        style={{
          transform: open ? `translateY(${drag}px)` : "translateY(calc(100% + 6rem))",
          transition: drag ? "none" : `transform 520ms ${IOS_EASE}`,
        }}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <div className="flex items-center gap-3.5 px-1 pb-4">
          <UserAvatar user={user} className="h-12 w-12" textClassName="text-sm" />
          <div className="min-w-0">
            <RoleLine {...view} />
            <p id={titleId} className="mt-0.5 truncate text-lg text-amber-100">
              {displayName}
            </p>
            {user.email && <p className="truncate text-xs text-zinc-500">{user.email}</p>}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          <Link
            ref={firstRef}
            href="/dashboard"
            onClick={onClose}
            className="flex min-h-[52px] items-center gap-3.5 px-4 text-[15px] text-zinc-100 transition-colors active:bg-white/5"
          >
            <LayoutDashboard className="h-[18px] w-[18px] text-amber-200/80" strokeWidth={1.6} aria-hidden />
            {labels.dashboard}
          </Link>
          <div className="mx-4 h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex min-h-[52px] w-full items-center gap-3.5 px-4 text-left text-[15px] text-rose-300 transition-colors active:bg-white/5"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
            {labels.logout}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-[15px] font-medium text-zinc-300 transition-colors active:bg-white/5"
        >
          {labels.close}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ШАПКА
 * ══════════════════════════════════════════════════════════════════ */

export default function Navbar() {
  const { user, role, loading, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const menu = useMobileMenu();

  const navRef = useRef<HTMLElement>(null);
  useRegisterNavbar(navRef);

  const [menuOpen, setMenuOpen] = useState(false); // десктоп: выпадающее меню
  const [sheetOpen, setSheetOpen] = useState(false); // мобильная: шторка
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const menuRef = useRef<HTMLDivElement>(null);

  // переход по ссылке закрывает всё
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMenuOpen(false);
    setSheetOpen(false);
  }

  const labels = t[lang];

  // Подпись роли на текущем языке; неизвестную роль показываем как есть
  const roleLabel = role ? (labels.roles[role] ?? role) : null;
  const roleTone = ROLE_TONE[role ?? ""] ?? "text-zinc-500";
  const isLeadership = role === "owner" || role === "admin";

  // Без имени AuthContext подставляет «Резидент» — для любой роли это
  // выглядело бы как понижение, поэтому берём часть почты до @
  const hasRealName = !!user?.fullName && user.fullName !== AUTH_FALLBACK_NAME;
  const emailName = user?.email?.split("@")[0] ?? "";
  const displayName = hasRealName && user ? user.fullName : emailName || roleLabel || labels.member;

  const showBurger = !!user && menu.hasSidebar;

  // Десктоп: закрытие выпадающего меню по клику снаружи и по Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openProfile = () => {
    menu.close();
    if (isDesktop) setMenuOpen((v) => !v);
    else setSheetOpen(true);
  };

  const view: ProfileView | null = user
    ? { user, displayName, roleLabel, roleTone, isLeadership, loading, labels }
    : null;

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-zinc-950/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="mx-auto flex h-14 w-full items-center justify-between gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:h-[76px] md:gap-4 md:px-8">
        {/* Слева: ☰ + логотип */}
        <div className="flex min-w-0 items-center">
          {showBurger && (
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                menu.toggle();
              }}
              aria-label={labels.openMenu}
              aria-expanded={menu.isOpen}
              aria-controls="voyage-mobile-sidebar"
              className="mr-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-200 transition-colors active:bg-white/10 md:hidden"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <Link
            href="/"
            className={`truncate text-[15px] font-light tracking-[0.32em] text-amber-200 transition-opacity hover:opacity-80 md:pl-0 md:text-xl md:tracking-[0.35em] ${
              showBurger ? "" : "pl-2"
            }`}
          >
            VOYAGE
          </Link>
        </div>

        {/* Справа: язык + профиль */}
        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          <LangSlider lang={lang} setLang={setLang} />
          <LangPicker lang={lang} setLang={setLang} label={labels.language} />

          {user && view ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={openProfile}
                aria-haspopup={isDesktop ? "menu" : "dialog"}
                aria-expanded={isDesktop ? menuOpen : sheetOpen}
                aria-label={roleLabel ? `${displayName} · ${roleLabel}` : displayName}
                className="relative flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/70 p-0.5 text-sm text-zinc-200 transition-colors hover:border-amber-200/40 active:scale-[0.97] md:py-1.5 md:pl-1.5 md:pr-3"
              >
                <UserAvatar user={user} className="h-8 w-8 md:h-7 md:w-7" textClassName="text-[11px]" />
                {isLeadership && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-950 bg-amber-200 md:hidden"
                  >
                    <Crown className="h-2 w-2 text-zinc-950" strokeWidth={2.5} />
                  </span>
                )}
                <span className="hidden max-w-[140px] truncate md:inline">{displayName}</span>
                <ChevronDown
                  aria-hidden
                  className={`hidden h-4 w-4 text-zinc-500 transition-transform duration-200 md:block ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* десктоп: выпадающее меню, никогда не шире экрана */}
              <div
                role="menu"
                aria-label={labels.account}
                className={`absolute right-0 mt-2 hidden w-56 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-200 md:block ${
                  menuOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
                }`}
              >
                <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                  <UserAvatar user={user} className="h-9 w-9" textClassName="text-xs" />
                  <div className="min-w-0">
                    <RoleLine {...view} />
                    <p className="truncate text-sm text-amber-200">{displayName}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  role="menuitem"
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-amber-200"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {labels.dashboard}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  {labels.logout}
                </button>
              </div>

              {/* мобильная: шторка снизу */}
              <ProfileSheet
                open={sheetOpen && !isDesktop}
                onClose={closeSheet}
                onLogout={() => void logout()}
                view={view}
              />
            </div>
          ) : (
            <Link
              href="/login"
              className="flex h-9 items-center gap-2 rounded-full border border-amber-200/30 px-3.5 text-[13px] tracking-wide text-amber-200 transition-all duration-300 hover:border-amber-200 hover:bg-amber-200 hover:text-zinc-950 md:h-auto md:px-5 md:py-2 md:text-sm"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              <span className="md:hidden">{labels.loginShort}</span>
              <span className="hidden md:inline">{labels.login}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
