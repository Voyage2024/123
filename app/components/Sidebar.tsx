"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · SIDEBAR — app/components/Sidebar.tsx
 *
 *   ≥ md  — статичная колонка слева (w-72), начинается под шапкой (--nav-h).
 *   < md  — шторка-drawer слева поверх всего: открывается гамбургером в
 *           Navbar (useMobileMenu), закрывается тапом по фону, свайпом
 *           влево, Esc, крестиком и переходом по любой ссылке.
 *           Фон не прокручивается (iOS-safe lock), фокус заперт внутри.
 *   Если Navbar на странице нет — остаётся плавающая кнопка меню.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  GlassWater,
  Plane,
  Inbox,
  Trophy,
  Crown,
  ConciergeBell,
  UserPlus,
  Settings,
  MapPin,
  ClipboardList,
  Users,
  ShieldAlert,
  Map,
  KeyRound,
  Mail,
  Globe,
  Database,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import { useAuth, type Role } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import UserAvatar from "@/app/components/UserAvatar";
import { supabase } from "@/lib/supabase";
import { isClubAdmin } from "@/lib/access";
import { useMobileMenu, useRegisterSidebar, useScrollLock } from "@/app/context/MobileMenuContext";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600"],
});

type NavKey =
  | "myVoyage"
  | "myApplications"
  | "parties"
  | "tours"
  | "passport"
  | "leaderboard"
  | "concierge"
  | "inviteFriends"
  | "settings"
  | "overview"
  | "myLocation"
  | "applications"
  | "membershipRequests"
  | "directory"
  | "faceControl"
  | "events"
  | "gamification"
  | "invitations"
  | "profileSettings"
  | "roleManagement"
  | "adminParties"
  | "mapLocations"
  | "database";

type SectionKey = "club" | "console" | "management" | "administration" | "owner" | "account";

type NavItem = { key: NavKey; href: string; icon: LucideIcon };
type NavSection = { key: SectionKey; roles: readonly Role[]; items: NavItem[] };

const STAFF: readonly Role[] = ["manager", "admin", "owner"];

const NAV_SECTIONS: NavSection[] = [
  // ── Резидент ──────────────────────────────────────────────
  {
    key: "club",
    roles: ["resident"],
    items: [
      { key: "myVoyage", href: "/dashboard", icon: CreditCard },
      { key: "myApplications", href: "/dashboard/applications", icon: Inbox },
      { key: "parties", href: "/dashboard/parties", icon: GlassWater },
      { key: "tours", href: "/dashboard/tours", icon: Plane },
      { key: "passport", href: "/dashboard/gamification", icon: Trophy },
      // Глобальный рейтинг клуба (Influence Index). Туры — локальные соревнования внутри тура
      { key: "leaderboard", href: "/dashboard/leaderboard", icon: Crown },
      { key: "concierge", href: "/dashboard/concierge", icon: ConciergeBell },
      { key: "inviteFriends", href: "/dashboard/invite", icon: UserPlus },
      { key: "settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
  // ── Общая главная для персонала: сводка клуба (Overview) ───
  {
    key: "console",
    roles: STAFF,
    items: [{ key: "overview", href: "/admin/directory", icon: LayoutDashboard }],
  },
  // ── Manager+ ──────────────────────────────────────────────
  {
    key: "management",
    roles: STAFF,
    items: [
      { key: "myLocation", href: "/admin/location", icon: MapPin },
      { key: "applications", href: "/admin/applications", icon: ClipboardList },
    ],
  },
  // ── Admin+ ────────────────────────────────────────────────
  {
    key: "administration",
    roles: ["admin", "owner"],
    items: [
      // Всё ниже — только owner и admin (в БД то же правило: club_is_admin)
      // Справочник резидентов и KYC живёт в корне админки
      { key: "directory", href: "/admin", icon: Users },
      // Заявки на вступление с главной (/admin/requests)
      { key: "membershipRequests", href: "/admin/requests", icon: UserPlus },
      { key: "faceControl", href: "/admin/face-control", icon: ShieldAlert },
      { key: "gamification", href: "/admin/gamification", icon: Trophy },
      { key: "invitations", href: "/admin/invites", icon: Mail },
      { key: "events", href: "/admin/events", icon: Map },
      // Тусовки создают и правят owner и admin (бывший global-tours)
      { key: "adminParties", href: "/admin/parties", icon: GlassWater },
      { key: "mapLocations", href: "/admin/map-locations", icon: Globe },
    ],
  },
  // ── Owner ─────────────────────────────────────────────────
  {
    key: "owner",
    roles: ["owner"],
    items: [
      { key: "roleManagement", href: "/admin/roles", icon: KeyRound },
      { key: "database", href: "/admin/database", icon: Database },
    ],
  },
  // ── Аккаунт: настройки профиля для всего персонала ─────────
  {
    key: "account",
    roles: STAFF,
    items: [{ key: "profileSettings", href: "/admin/settings", icon: Settings }],
  },
];

// Корневые адреса подсвечиваются только при точном совпадении
// (иначе «Справочник» /admin горел бы на каждой странице админки)
const INDEX_ROUTES = new Set(["/admin", "/dashboard"]);

function isActive(href: string, pathname: string) {
  if (pathname === href) return true;
  if (INDEX_ROUTES.has(href)) return false;
  return pathname.startsWith(href + "/");
}

/* ── Переводы ─────────────────────────────────────────────────────── */

const translations = {
  EN: {
    subtitle: {
      resident: "Private Club",
      manager: "Manager Console",
      admin: "Admin Console",
      owner: "Owner Console",
    },
    sections: {
      club: "Club",
      console: "Console",
      management: "Management",
      administration: "Administration",
      owner: "Owner",
      account: "Account",
    },
    nav: {
      myVoyage: "My Voyage",
      myApplications: "My Applications",
      parties: "Parties / Themes",
      tours: "Tours",
      passport: "My Passport",
      leaderboard: "Global Ranking",
      concierge: "Concierge",
      inviteFriends: "Invite Friends",
      settings: "Settings",
      overview: "Overview",
      myLocation: "My Location",
      applications: "Resident Applications",
      membershipRequests: "Membership Requests",
      directory: "Directory",
      faceControl: "Face Control",
      events: "Tours / Parties",
      gamification: "Gamification",
      invitations: "Invitations",
      profileSettings: "Profile Settings",
      roleManagement: "Role Management",
      adminParties: "Manage Parties",
      mapLocations: "Map Locations",
      database: "Full Database",
    },
    roles: { owner: "Owner", admin: "Administrator", manager: "Manager", resident: "Resident" },
    logout: "Sign out",
    pendingInvites: (n: number) => `${n} awaiting review`,
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menu: "Menu",
  },
  RU: {
    subtitle: {
      resident: "Закрытый клуб",
      manager: "Панель менеджера",
      admin: "Панель админа",
      owner: "Панель владельца",
    },
    sections: {
      club: "Клуб",
      console: "Консоль",
      management: "Управление",
      administration: "Администрирование",
      owner: "Владелец",
      account: "Аккаунт",
    },
    nav: {
      myVoyage: "Мой Voyage",
      myApplications: "Мои заявки",
      parties: "Тусовки / Темы",
      tours: "Туры",
      passport: "Мой паспорт",
      leaderboard: "Глобальный рейтинг",
      concierge: "Консьерж",
      inviteFriends: "Пригласить друзей",
      settings: "Настройки",
      overview: "Обзор",
      myLocation: "Моя локация",
      applications: "Заявки резидентов",
      membershipRequests: "Заявки на вступление",
      directory: "Справочник",
      faceControl: "Фейс-контроль",
      events: "Туры / Тусовки",
      gamification: "Геймификация",
      invitations: "Приглашения",
      profileSettings: "Настройки профиля",
      roleManagement: "Управление ролями",
      adminParties: "Управление тусовками",
      mapLocations: "Локации карты",
      database: "Полная база",
    },
    roles: { owner: "Владелец", admin: "Администратор", manager: "Менеджер", resident: "Резидент" },
    logout: "Выйти",
    pendingInvites: (n: number) => `${n} на модерации`,
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    menu: "Меню",
  },
  ES: {
    subtitle: {
      resident: "Club Privado",
      manager: "Panel de gerente",
      admin: "Panel de admin",
      owner: "Panel del propietario",
    },
    sections: {
      club: "Club",
      console: "Consola",
      management: "Gestión",
      administration: "Administración",
      owner: "Propietario",
      account: "Cuenta",
    },
    nav: {
      myVoyage: "Mi Voyage",
      myApplications: "Mis solicitudes",
      parties: "Fiestas / Temas",
      tours: "Tours",
      passport: "Mi pasaporte",
      leaderboard: "Ranking global",
      concierge: "Conserje",
      inviteFriends: "Invitar amigos",
      settings: "Ajustes",
      overview: "Resumen",
      myLocation: "Mi ubicación",
      applications: "Solicitudes",
      membershipRequests: "Solicitudes de ingreso",
      directory: "Directorio",
      faceControl: "Control de acceso",
      events: "Tours / Fiestas",
      gamification: "Gamificación",
      invitations: "Invitaciones",
      profileSettings: "Ajustes del perfil",
      roleManagement: "Gestión de roles",
      adminParties: "Gestionar fiestas",
      mapLocations: "Ubicaciones del mapa",
      database: "Base de datos",
    },
    roles: { owner: "Propietario", admin: "Administrador", manager: "Gerente", resident: "Residente" },
    logout: "Cerrar sesión",
    pendingInvites: (n: number) => `${n} en moderación`,
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    menu: "Menú",
  },
  PT: {
    subtitle: {
      resident: "Clube Privado",
      manager: "Painel do gerente",
      admin: "Painel do admin",
      owner: "Painel do proprietário",
    },
    sections: {
      club: "Clube",
      console: "Console",
      management: "Gestão",
      administration: "Administração",
      owner: "Proprietário",
      account: "Conta",
    },
    nav: {
      myVoyage: "Meu Voyage",
      myApplications: "Minhas solicitações",
      parties: "Festas / Temas",
      tours: "Tours",
      passport: "Meu passaporte",
      leaderboard: "Ranking global",
      concierge: "Concierge",
      inviteFriends: "Convidar amigos",
      settings: "Configurações",
      overview: "Visão geral",
      myLocation: "Minha localização",
      applications: "Solicitações",
      membershipRequests: "Pedidos de adesão",
      directory: "Diretório",
      faceControl: "Controle de acesso",
      events: "Tours / Festas",
      gamification: "Gamificação",
      invitations: "Convites",
      profileSettings: "Config. do perfil",
      roleManagement: "Gestão de funções",
      adminParties: "Gerenciar festas",
      mapLocations: "Localizações do mapa",
      database: "Banco de dados",
    },
    roles: { owner: "Proprietário", admin: "Administrador", manager: "Gerente", resident: "Residente" },
    logout: "Sair",
    pendingInvites: (n: number) => `${n} em moderação`,
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    menu: "Menu",
  },
} as const;

type LangKey = keyof typeof translations;

/** Сколько записей ждут решения — счётчик у «Заявок на вступление» и «Приглашений».
 *  Запрос идёт только у owner/admin (RLS всё равно не отдаст их другим). */
function usePendingCount(table: "club_invites" | "guest_applications", enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = async () => {
      const { count: n, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (alive && !error) setCount(n ?? 0); // нет миграции — просто без счётчика
    };
    void load();
    const channel = supabase
      .channel(`voyage-sidebar-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => void load())
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [table, enabled]);
  return count;
}

const ROLE_BADGE: Record<Role, string> = {
  owner: "border-amber-400/40 bg-amber-950/50 text-amber-200",
  admin: "border-amber-500/30 bg-amber-950/40 text-amber-300/80",
  manager: "border-sky-400/25 bg-sky-950/40 text-sky-300/80",
  resident: "border-zinc-800/60 bg-zinc-900/40 text-zinc-500",
};

const DESKTOP = "(min-width: 768px)";
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => false);
}

/** Кривая iOS-шторок */
const IOS_EASE = "cubic-bezier(0.32,0.72,0,1)";
/** Сколько протащить влево, чтобы шторка закрылась */
const SWIPE_CLOSE_PX = 72;

export default function Sidebar() {
  const { user, role, loading, logout } = useAuth();
  const { lang } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { isOpen, open, close, hasNavbar } = useMobileMenu();
  useRegisterSidebar();

  const mobileOpen = isOpen && !isDesktop;
  useScrollLock(mobileOpen);

  const clubAdmin = isClubAdmin(role);
  const pendingInvites = usePendingCount("club_invites", clubAdmin);
  const pendingApplications = usePendingCount("guest_applications", clubAdmin);
  const pendingFor: Partial<Record<NavKey, number>> = {
    invitations: pendingInvites,
    membershipRequests: pendingApplications,
  };

  const t = translations[(lang as LangKey) in translations ? (lang as LangKey) : "EN"];

  const sections = useMemo(
    () => (role ? NAV_SECTIONS.filter((s) => s.roles.includes(role)) : []),
    [role]
  );

  const showSectionTitles = sections.length > 1;

  // переход на другую страницу — шторка закрывается
  useEffect(() => {
    close();
  }, [pathname, close]);

  // на десктопе шторки нет: повернули iPad / растянули окно — закрываем
  useEffect(() => {
    if (isDesktop && isOpen) close();
  }, [isDesktop, isOpen, close]);

  /* ── доступность шторки: inert, фокус внутрь, Esc, Tab по кругу ── */
  const drawerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = drawerRef.current;
    if (el) el.inert = !mobileOpen;
    if (!mobileOpen || !el) return;

    const prev = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = el.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [mobileOpen, close]);

  /* ── свайп влево закрывает шторку (вертикальная прокрутка не мешает) ── */
  const touch = useRef<{ x: number; y: number; dx: number; axis: "x" | "y" | null } | null>(null);
  const [dragX, setDragX] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, dx: 0, axis: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const p = e.touches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (s.axis !== "x") return;
    s.dx = Math.min(0, dx);
    setDragX(s.dx);
  };
  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    if (s?.axis === "x" && s.dx < -SWIPE_CLOSE_PX) close();
    setDragX(0);
  };

  // фон гаснет вместе со свайпом (320 — ширина шторки на телефоне)
  const backdropOpacity = mobileOpen ? Math.max(0, 1 + dragX / 320) : 0;

  const handleLogout = useCallback(async () => {
    close();
    await logout();
    router.push("/login");
  }, [close, logout, router]);

  const renderContent = (mobile: boolean) => (
    <>
      <div
        className={`flex items-center gap-3 border-b border-zinc-800/80 ${
          mobile ? "px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]" : "px-8 py-8"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/30">
          <span className={`${cormorant.className} text-lg font-medium text-amber-200/90`}>V</span>
        </div>
        <div className="min-w-0">
          <p className={`${cormorant.className} text-xl font-medium tracking-[0.2em] text-zinc-50`}>
            VOYAGE
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            {role ? t.subtitle[role] : " "}
          </p>
        </div>
        {mobile && (
          <button
            ref={closeBtnRef}
            type="button"
            onClick={close}
            aria-label={t.closeMenu}
            className="-mr-2 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100 active:bg-white/10"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <nav
        aria-label={t.menu}
        className={`flex-1 overflow-y-auto overscroll-contain ${mobile ? "px-3 py-5" : "px-4 py-8"}`}
      >
        {loading ? (
          <ul className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/60" />
              </li>
            ))}
          </ul>
        ) : (
          <div className={mobile ? "space-y-6" : "space-y-7"}>
            {sections.map((section) => (
              <div key={section.key}>
                {showSectionTitles && section.key !== "console" && (
                  <p className="mb-2 px-4 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    {t.sections[section.key]}
                  </p>
                )}
                <ul className="space-y-1">
                  {section.items.map(({ key, href, icon: Icon }) => {
                    const active = isActive(href, pathname);
                    return (
                      <li key={key}>
                        <Link
                          href={href}
                          onClick={mobile ? close : undefined}
                          aria-current={active ? "page" : undefined}
                          className={`group flex items-center gap-3 rounded-md border-l px-4 transition-colors ${
                            mobile ? "min-h-12 py-3 text-[15px] active:bg-zinc-900/70" : "py-3 text-sm"
                          } ${
                            active
                              ? "border-amber-500/50 bg-zinc-900/50 text-zinc-100"
                              : "border-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-100"
                          }`}
                        >
                          <Icon
                            size={mobile ? 18 : 17}
                            strokeWidth={1.5}
                            className={`shrink-0 ${
                              active ? "text-amber-300/80" : "text-zinc-500 group-hover:text-zinc-300"
                            }`}
                          />
                          <span className="truncate tracking-wide">{t.nav[key]}</span>
                          {(pendingFor[key] ?? 0) > 0 && (
                            <span
                              className="ml-auto inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-200 px-1.5 py-px font-mono text-[10px] font-medium text-zinc-950"
                              title={t.pendingInvites(pendingFor[key] ?? 0)}
                            >
                              <span aria-hidden>{pendingFor[key]}</span>
                              <span className="sr-only">{t.pendingInvites(pendingFor[key] ?? 0)}</span>
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div
        className={`border-t border-zinc-800/80 ${
          mobile ? "px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4" : "px-6 py-5"
        }`}
      >
        {user ? (
          <div className="mb-4 flex items-center gap-3">
            <UserAvatar user={user} className="h-10 w-10" textClassName="text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">{user.fullName}</p>
              <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
            </div>
          </div>
        ) : (
          loading && (
            <div className="mb-4 flex items-center gap-3">
              <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-800/60" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-800/60" />
                <div className="h-2.5 w-36 animate-pulse rounded bg-zinc-800/40" />
              </div>
            </div>
          )
        )}
        <div className="flex items-center justify-between">
          {role ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] ${ROLE_BADGE[role]}`}
            >
              {t.roles[role]}
            </span>
          ) : (
            <span className="h-5 w-20 animate-pulse rounded-full bg-zinc-800/60" />
          )}
          {user && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={`flex items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-amber-200/80 ${
                mobile ? "-mr-2 min-h-11 px-2" : ""
              }`}
            >
              <LogOut size={13} strokeWidth={1.5} />
              {t.logout}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Десктоп: статичная колонка, начинается под шапкой */}
      <aside
        className="fixed bottom-0 left-0 z-40 hidden w-72 flex-col border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl md:flex"
        style={{ top: "var(--nav-h, 0px)" }}
      >
        {renderContent(false)}
      </aside>

      {/* Запасная кнопка — только если на странице нет Navbar с гамбургером */}
      {!hasNavbar && !mobileOpen && (
        <button
          type="button"
          onClick={open}
          aria-label={t.openMenu}
          aria-controls="voyage-mobile-sidebar"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/30 bg-zinc-950/90 text-amber-200 shadow-lg shadow-black/40 backdrop-blur-md md:hidden"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
      )}

      {/* Мобильная: шторка слева поверх всего */}
      <div className={`fixed inset-0 z-[70] overflow-hidden md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div
          aria-hidden
          onClick={close}
          className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity duration-300"
          style={{ opacity: backdropOpacity }}
        />
        <aside
          ref={drawerRef}
          id="voyage-mobile-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label={t.menu}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] touch-pan-y flex-col border-r border-amber-200/10 bg-zinc-950/95 pl-[env(safe-area-inset-left)] shadow-[24px_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          style={{
            transform: mobileOpen ? `translateX(${dragX}px)` : "translateX(calc(-100% - 8rem))",
            transition: dragX ? "none" : `transform 520ms ${IOS_EASE}`,
          }}
        >
          {renderContent(true)}
        </aside>
      </div>
    </>
  );
}
