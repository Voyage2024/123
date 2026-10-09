"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Crown, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import UserAvatar from "@/app/components/UserAvatar";
import { useLanguage, LANGS, type Lang } from "@/app/context/LanguageContext";

/* Роль — из AuthContext (public.profiles.role, источник правды).
 * Подпись над именем больше не захардкожена: owner / admin / manager /
 * resident / guest, на языке интерфейса. Пока роль грузится — плейсхолдер,
 * а не «Резидент», чтобы руководство не видело себя «разжалованным». */

type Labels = {
  login: string;
  dashboard: string;
  logout: string;
  member: string;
  roles: Record<string, string>;
};

const t: Record<Lang, Labels> = {
  EN: {
    login: "Member Login",
    dashboard: "Dashboard",
    logout: "Logout",
    member: "Member",
    roles: { owner: "Owner", admin: "Admin", manager: "Manager", resident: "Resident", guest: "Guest" },
  },
  RU: {
    login: "Вход для резидентов",
    dashboard: "Кабинет",
    logout: "Выйти",
    member: "Резидент",
    roles: { owner: "Владелец", admin: "Админ", manager: "Менеджер", resident: "Резидент", guest: "Гостья" },
  },
  ES: {
    login: "Acceso de miembros",
    dashboard: "Panel",
    logout: "Cerrar sesión",
    member: "Miembro",
    roles: { owner: "Propietario", admin: "Admin", manager: "Gerente", resident: "Residente", guest: "Invitada" },
  },
  PT: {
    login: "Área do membro",
    dashboard: "Painel",
    logout: "Sair",
    member: "Membro",
    roles: { owner: "Proprietário", admin: "Admin", manager: "Gerente", resident: "Residente", guest: "Convidada" },
  },
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

export default function Navbar() {
  const { user, role, loading, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Закрытие выпадающего меню по клику снаружи и по Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 bg-zinc-950/60 backdrop-blur-md border-b border-white/5">
      {/* Логотип */}
      <Link
        href="/"
        className="text-xl font-light tracking-[0.35em] text-amber-200 transition-opacity hover:opacity-80"
      >
        VOYAGE
      </Link>

      <div className="flex items-center gap-4">
        {/* Переключатель языков */}
        <div
          role="radiogroup"
          aria-label="Language"
          className="relative flex rounded-full border border-white/10 bg-zinc-900/70 p-1"
        >
          <span
            aria-hidden
            className="absolute top-1 left-1 h-7 w-8 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.35)] transition-transform duration-300 ease-out"
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

        {/* Авторизация */}
        {user ? (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={roleLabel ? `${displayName} · ${roleLabel}` : displayName}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/70 py-1.5 pl-1.5 pr-3 text-sm text-zinc-200 transition-colors hover:border-amber-200/40"
            >
              <UserAvatar user={user} className="h-7 w-7" textClassName="text-[11px]" />
              <span className="max-w-[140px] truncate">{displayName}</span>
              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              role="menu"
              className={`absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-200 ${
                menuOpen
                  ? "pointer-events-auto scale-100 opacity-100"
                  : "pointer-events-none scale-95 opacity-0"
              }`}
            >
              <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                <UserAvatar user={user} className="h-9 w-9" textClassName="text-xs" />
                <div className="min-w-0">
                  {roleLabel ? (
                    <p className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] ${roleTone}`}>
                      {isLeadership && <Crown className="h-3 w-3 shrink-0" strokeWidth={1.6} aria-hidden />}
                      <span className="truncate">{roleLabel}</span>
                    </p>
                  ) : loading ? (
                    <span aria-hidden className="block h-2.5 w-16 animate-pulse rounded bg-white/10" />
                  ) : (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{labels.member}</p>
                  )}
                  <p className="truncate text-sm text-amber-200">{displayName}</p>
                </div>
              </div>
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-amber-200"
              >
                <LayoutDashboard className="h-4 w-4" />
                {labels.dashboard}
              </Link>
              <button
                type="button"
                role="menuitem"
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
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full border border-amber-200/30 px-5 py-2 text-sm tracking-wide text-amber-200 transition-all duration-300 hover:border-amber-200 hover:bg-amber-200 hover:text-zinc-950"
          >
            <LogIn className="h-4 w-4" />
            {labels.login}
          </Link>
        )}
      </div>
    </nav>
  );
}
