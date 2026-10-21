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
 *
 *   Меню резидента — плоский список и одна ветка:
 *   «Глобальный рейтинг» → «Баллы тура», «Паспорт Voyage».
 *   Подпункты висят на тонких линиях-ветвях от иконки родителя,
 *   ветка сворачивается шевроном и сама раскрывается при переходе внутрь.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Sparkles,
  FileText,
  GlassWater,
  Plane,
  Radar,
  Trophy,
  Coins,
  BadgeCheck,
  ConciergeBell,
  Gift,
  UserPlus,
  Settings,
  ClipboardList,
  Users,
  ShieldAlert,
  Map,
  KeyRound,
  Mail,
  Globe,
  Database,
  BookOpen,
  LogOut,
  Menu,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth, type Role } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import UserAvatar from "@/app/components/UserAvatar";
import { cormorant } from "@/app/components/profile/fonts";
import { supabase } from "@/lib/supabase";
import { isClubAdmin } from "@/lib/access";
import { useMobileMenu, useRegisterSidebar, useScrollLock } from "@/app/context/MobileMenuContext";

type NavKey =
  | "myVoyage"
  | "myApplications"
  | "parties"
  | "tourPoints"
  | "voyagePassport"
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
  | "guides"
  | "negotiations"
  | "database"
  | "command"
  | "castings"
  | "mapTours"
  | "manifest"
  | "pulse"
  | "blacklist"
  | "keys";

type SectionKey = "club" | "market" | "operations" | "intelligence" | "authority" | "console" | "management" | "administration" | "owner" | "account";

/** children — подпункты: рисуются веткой под родителем */
type NavItem = { key: NavKey; href: string; icon: LucideIcon; children?: readonly NavItem[] };
type NavSection = { key: SectionKey; roles: readonly Role[]; items: NavItem[] };

const STAFF: readonly Role[] = ["manager", "admin", "owner"];

const ADMIN: readonly Role[] = ["admin", "owner"];

const NAV_SECTIONS: NavSection[] = [
  // ── Resident workspace ───────────────────────────────────────────────
  {
    key: "club",
    roles: ["resident"],
    items: [
      { key: "myVoyage", href: "/dashboard", icon: LayoutDashboard },
      { key: "castings", href: "/dashboard/castings", icon: Sparkles },
      { key: "mapTours", href: "/dashboard/map", icon: Map },
      { key: "myApplications", href: "/dashboard/applications", icon: FileText },
      // Глобальный рейтинг клуба (Influence Index) — «марафон».
      // Внутри него: «спринт» текущего тура и паспорт со штампами.
      {
        key: "leaderboard",
        href: "/dashboard/leaderboard",
        icon: Trophy,
        children: [
          { key: "tourPoints", href: "/dashboard/tours", icon: Coins },
          { key: "voyagePassport", href: "/dashboard/gamification", icon: BadgeCheck },
        ],
      },
      { key: "concierge", href: "/dashboard/concierge", icon: ConciergeBell },
      { key: "parties", href: "/dashboard/parties", icon: GlassWater },
      { key: "inviteFriends", href: "/dashboard/invite", icon: Gift },
      { key: "settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
  // ── Partner workspace: manager, admin and owner ─────────────────────
  {
    key: "market",
    roles: STAFF,
    items: [
      { key: "command", href: "/partner", icon: LayoutDashboard },
      { key: "castings", href: "/partner/castings", icon: ClipboardList },
    ],
  },
  {
    key: "operations",
    roles: STAFF,
    items: [{ key: "manifest", href: "/partner/manifest", icon: Plane }],
  },
  {
    key: "intelligence",
    roles: STAFF,
    items: [
      { key: "pulse", href: "/partner/pulse", icon: Activity },
      { key: "blacklist", href: "/partner/blacklist", icon: ShieldAlert },
    ],
  },
  {
    key: "authority",
    roles: STAFF,
    items: [{ key: "keys", href: "/partner/keys", icon: KeyRound }],
  },

  // ── Administrative workspace: owner and admin only ──────────────────
  {
    key: "console",
    roles: ADMIN,
    items: [{ key: "overview", href: "/admin/directory", icon: LayoutDashboard }],
  },
  {
    key: "administration",
    roles: ADMIN,
    items: [
      { key: "directory", href: "/admin", icon: Users },
      { key: "database", href: "/admin/database", icon: Database },
      { key: "applications", href: "/admin/applications", icon: ClipboardList },
      { key: "negotiations", href: "/admin/negotiations", icon: Radar },
      { key: "membershipRequests", href: "/admin/requests", icon: UserPlus },
      { key: "faceControl", href: "/admin/face-control", icon: ShieldAlert },
      { key: "concierge", href: "/admin/concierge", icon: ConciergeBell },
      { key: "events", href: "/admin/events", icon: Map },
      { key: "gamification", href: "/admin/gamification", icon: Trophy },
      { key: "invitations", href: "/admin/invites", icon: Mail },
      { key: "adminParties", href: "/admin/parties", icon: GlassWater },
      { key: "mapLocations", href: "/admin/map-locations", icon: Globe },
      { key: "guides", href: "/admin/guides", icon: BookOpen },
    ],
  },
  // Role management remains owner-only, matching the existing RBAC contract.
  {
    key: "owner",
    roles: ["owner"],
    items: [{ key: "roleManagement", href: "/admin/roles", icon: KeyRound }],
  },
  // Personal settings are the one /admin route that remains available to staff.
  {
    key: "account",
    roles: STAFF,
    items: [{ key: "profileSettings", href: "/admin/settings", icon: Settings }],
  },
];

// Корневые адреса подсвечиваются только при точном совпадении
// (иначе «Справочник» /admin горел бы на каждой странице админки)
const INDEX_ROUTES = new Set(["/admin", "/dashboard", "/partner"]);

function isActive(href: string, pathname: string) {
  if (pathname === href) return true;
  if (INDEX_ROUTES.has(href)) return false;
  return pathname.startsWith(href + "/");
}

/** Открыт ли один из подпунктов группы */
function isChildActive(item: NavItem, pathname: string) {
  return !!item.children?.some((c) => isActive(c.href, pathname));
}

/* ── Переводы ─────────────────────────────────────────────────────── */

const translations = {
  EN: {
    subtitle: {
      resident: "Private Club",
      manager: "Partner Command",
      admin: "Admin Console",
      owner: "Owner Console",
    },
    sections: {
      club: "Club",
      market: "Market",
      operations: "Operations",
      intelligence: "Intelligence",
      authority: "Authority",
      console: "Console",
      management: "Management",
      administration: "Administration",
      owner: "Owner",
      account: "Account",
    },
    nav: {
      myVoyage: "My Voyage",
      myApplications: "My Applications",
      parties: "Themes / Parties",
      tourPoints: "Tour Points",
      voyagePassport: "Voyage Passport",
      leaderboard: "Global Ranking",
      concierge: "Concierge",
      inviteFriends: "Invite Friends",
      settings: "Settings",
      overview: "Overview",
      myLocation: "My Location",
      applications: "Resident Applications",
      negotiations: "Control Tower",
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
      guides: "Guides",
      database: "Full Database",
      command: "Command",
      castings: "Castings",
      mapTours: "Tour Map",
      manifest: "Manifest",
      pulse: "Pulse",
      blacklist: "Blacklist",
      keys: "Keys",
    },
    roles: { owner: "Owner", admin: "Administrator", manager: "Manager", resident: "Resident" },
    logout: "Sign out",
    pendingInvites: (n: number) => `${n} awaiting review`,
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menu: "Menu",
    expand: "Expand",
    collapse: "Collapse",
  },
  RU: {
    subtitle: {
      resident: "Закрытый клуб",
      manager: "Штаб партнёра",
      admin: "Панель админа",
      owner: "Панель владельца",
    },
    sections: {
      club: "Клуб",
      market: "Рынок",
      operations: "Операции",
      intelligence: "Разведка",
      authority: "Власть",
      console: "Консоль",
      management: "Управление",
      administration: "Администрирование",
      owner: "Владелец",
      account: "Аккаунт",
    },
    nav: {
      myVoyage: "Мой Voyage",
      myApplications: "Мои заявки",
      parties: "Темы / Тусовки",
      tourPoints: "Баллы тура",
      voyagePassport: "Паспорт Voyage",
      leaderboard: "Глобальный рейтинг",
      concierge: "Консьерж",
      inviteFriends: "Пригласить друзей",
      settings: "Настройки",
      overview: "Обзор",
      myLocation: "Моя локация",
      applications: "Заявки резидентов",
      negotiations: "Переговоры",
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
      guides: "Гайды",
      database: "Полная база",
      command: "Штаб",
      castings: "Кастинги",
      mapTours: "Карта туров",
      manifest: "Манифест",
      pulse: "Пульс",
      blacklist: "Чёрный список",
      keys: "Ключи",
    },
    roles: { owner: "Владелец", admin: "Администратор", manager: "Менеджер", resident: "Резидент" },
    logout: "Выйти",
    pendingInvites: (n: number) => `${n} на модерации`,
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    menu: "Меню",
    expand: "Развернуть",
    collapse: "Свернуть",
  },
  ES: {
    subtitle: {
      resident: "Club Privado",
      manager: "Centro del partner",
      admin: "Panel de admin",
      owner: "Panel del propietario",
    },
    sections: {
      club: "Club",
      market: "Mercado",
      operations: "Operaciones",
      intelligence: "Inteligencia",
      authority: "Autoridad",
      console: "Consola",
      management: "Gestión",
      administration: "Administración",
      owner: "Propietario",
      account: "Cuenta",
    },
    nav: {
      myVoyage: "Mi Voyage",
      myApplications: "Mis solicitudes",
      parties: "Temas / Fiestas",
      tourPoints: "Puntos del tour",
      voyagePassport: "Pasaporte Voyage",
      leaderboard: "Ranking global",
      concierge: "Conserje",
      inviteFriends: "Invitar amigos",
      settings: "Ajustes",
      overview: "Resumen",
      myLocation: "Mi ubicación",
      applications: "Solicitudes",
      negotiations: "Torre de control",
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
      guides: "Guías",
      database: "Base de datos",
      command: "Mando",
      castings: "Castings",
      mapTours: "Mapa de tours",
      manifest: "Manifiesto",
      pulse: "Pulso",
      blacklist: "Lista negra",
      keys: "Llaves",
    },
    roles: { owner: "Propietario", admin: "Administrador", manager: "Gerente", resident: "Residente" },
    logout: "Cerrar sesión",
    pendingInvites: (n: number) => `${n} en moderación`,
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    menu: "Menú",
    expand: "Expandir",
    collapse: "Contraer",
  },
  PT: {
    subtitle: {
      resident: "Clube Privado",
      manager: "Central do parceiro",
      admin: "Painel do admin",
      owner: "Painel do proprietário",
    },
    sections: {
      club: "Clube",
      market: "Mercado",
      operations: "Operações",
      intelligence: "Inteligência",
      authority: "Autoridade",
      console: "Console",
      management: "Gestão",
      administration: "Administração",
      owner: "Proprietário",
      account: "Conta",
    },
    nav: {
      myVoyage: "Meu Voyage",
      myApplications: "Minhas solicitações",
      parties: "Temas / Festas",
      tourPoints: "Pontos do tour",
      voyagePassport: "Passaporte Voyage",
      leaderboard: "Ranking global",
      concierge: "Concierge",
      inviteFriends: "Convidar amigos",
      settings: "Configurações",
      overview: "Visão geral",
      myLocation: "Minha localização",
      applications: "Solicitações",
      negotiations: "Torre de controle",
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
      guides: "Guias",
      database: "Banco de dados",
      command: "Comando",
      castings: "Castings",
      mapTours: "Mapa de tours",
      manifest: "Manifesto",
      pulse: "Pulso",
      blacklist: "Lista negra",
      keys: "Chaves",
    },
    roles: { owner: "Proprietário", admin: "Administrador", manager: "Gerente", resident: "Residente" },
    logout: "Sair",
    pendingInvites: (n: number) => `${n} em moderação`,
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    menu: "Menu",
    expand: "Expandir",
    collapse: "Recolher",
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

/** Ось ветки: центр иконки родителя (1px border-l + 16px pl-4 + половина иконки) */
const BRANCH_X = "left-[25px]";

export default function Sidebar() {
  const { user, role, segment, loading, logout } = useAuth();
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

  const sections = useMemo(() => {
    if (!role) return [];
    return NAV_SECTIONS.filter((section) => section.roles.includes(role)).map((section) => {
      if (role !== "resident" || section.key !== "club" || segment !== "elite") return section;
      // ELITE keeps event application history and passport access, but not the
      // ordinary Working tour-points shortcut. The applications page hides its
      // Tours tab for Elite residents and defaults directly to Events.
      return {
        ...section,
        items: section.items.map((item) => item.key === "leaderboard" && item.children
          ? { ...item, children: item.children.filter((child) => child.key !== "tourPoints") }
          : item),
      };
    });
  }, [role, segment]);

  const showSectionTitles = sections.length > 1;

  /* ── ветки меню: по умолчанию раскрыты, шевроном сворачиваются ── */
  const [collapsed, setCollapsed] = useState<ReadonlySet<NavKey>>(() => new Set());

  const toggleGroup = useCallback((key: NavKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // перешли на подпункт свёрнутой ветки — раскрываем её, чтобы активный пункт был виден
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    const reopen = sections
      .flatMap((s) => s.items)
      .filter((item) => collapsed.has(item.key) && isChildActive(item, pathname));
    if (reopen.length) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        reopen.forEach((item) => next.delete(item.key));
        return next;
      });
    }
  }

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

  /* ── строка меню верхнего уровня ─────────────────────────────────── */
  const renderLink = (
    { key, href, icon: Icon }: NavItem,
    mobile: boolean,
    { active, childActive = false, withToggle = false }: { active: boolean; childActive?: boolean; withToggle?: boolean }
  ) => (
    <Link
      href={href}
      onClick={mobile ? close : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-md border-l pl-4 transition-colors ${
        withToggle ? (mobile ? "pr-14" : "pr-11") : "pr-4"
      } ${mobile ? "min-h-12 py-3 text-[15px] active:bg-zinc-900/70" : "py-3 text-sm"} ${
        active
          ? "border-amber-500/50 bg-zinc-900/50 text-zinc-100"
          : childActive
            ? "border-transparent text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-100"
            : "border-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-100"
      }`}
    >
      <Icon
        size={mobile ? 18 : 17}
        strokeWidth={1.5}
        className={`shrink-0 ${
          active
            ? "text-amber-300/80"
            : childActive
              ? "text-amber-300/60"
              : "text-zinc-500 group-hover:text-zinc-300"
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
  );

  /* ── ветка: родитель + подпункты на тонких золотых линиях ─────────── */
  const renderGroup = (item: NavItem, mobile: boolean) => {
    const children = item.children ?? [];
    const active = isActive(item.href, pathname);
    const childActive = isChildActive(item, pathname);
    const expanded = !collapsed.has(item.key);
    const panelId = `voyage-nav-${mobile ? "m" : "d"}-${item.key}`;
    const toggleLabel = `${expanded ? t.collapse : t.expand}: ${t.nav[item.key]}`;

    return (
      <li key={item.key}>
        <div className="relative">
          {renderLink(item, mobile, { active, childActive, withToggle: true })}

          {/* ствол ветки: от иконки родителя вниз, к подпунктам */}
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-0 ${BRANCH_X} top-[calc(50%_+_0.75rem)] w-px bg-gradient-to-b from-amber-200/35 to-zinc-700/70 transition-opacity duration-300 ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          />

          <button
            type="button"
            onClick={() => toggleGroup(item.key)}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={toggleLabel}
            className={`absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/40 ${
              mobile ? "h-11 w-11 active:bg-white/10" : "h-8 w-8"
            }`}
          >
            <ChevronDown
              size={mobile ? 18 : 15}
              strokeWidth={1.5}
              className={`transition-transform duration-300 ${expanded ? "" : "-rotate-90"}`}
            />
          </button>
        </div>

        {/* плавное раскрытие без замера высоты: grid-rows 0fr ↔ 1fr;
            свёрнутая ветка — inert (ни фокуса, ни скринридера) */}
        <div
          id={panelId}
          ref={(el) => {
            if (el) el.inert = !expanded;
          }}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="pb-1">
              {children.map((child, i) => {
                const on = isActive(child.href, pathname);
                const last = i === children.length - 1;
                const ChildIcon = child.icon;
                return (
                  <li key={child.key} className="relative">
                    {/* колено ветки «└» */}
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute ${BRANCH_X} top-0 h-1/2 w-3 rounded-bl-[6px] border-b border-l transition-colors duration-300 ${
                        on ? "border-amber-300/60" : "border-zinc-700/70"
                      }`}
                    />
                    {/* продолжение ствола к следующему подпункту */}
                    {!last && (
                      <span
                        aria-hidden
                        className={`pointer-events-none absolute bottom-0 ${BRANCH_X} top-1/2 w-px bg-zinc-700/70`}
                      />
                    )}
                    <Link
                      href={child.href}
                      onClick={mobile ? close : undefined}
                      aria-current={on ? "page" : undefined}
                      className={`group ml-10 flex items-center gap-2.5 rounded-md px-3 transition-colors ${
                        mobile ? "min-h-11 py-2.5 text-[14px] active:bg-zinc-900/70" : "py-2 text-[13px]"
                      } ${on ? "bg-zinc-900/60 text-amber-100" : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-100"}`}
                    >
                      <ChildIcon
                        size={mobile ? 16 : 15}
                        strokeWidth={1.5}
                        className={`shrink-0 ${on ? "text-amber-300/80" : "text-zinc-600 group-hover:text-zinc-300"}`}
                      />
                      <span className="truncate tracking-wide">{t.nav[child.key]}</span>
                      {on && (
                        <span
                          aria-hidden
                          className="ml-auto h-1 w-1 shrink-0 rounded-full bg-amber-300/80 shadow-[0_0_6px_rgba(252,211,77,0.6)]"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </li>
    );
  };

  const renderContent = (mobile: boolean) => (
    <>
      <div
        className={`flex items-center gap-3 border-b border-zinc-800/80 ${
          mobile ? "px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]" : "px-8 py-8"
        }`}
      >
        <Link
          href="/"
          aria-label="VOYAGE - Home"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-amber-200/40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/30">
            <span className={`${cormorant.className} text-lg font-medium text-amber-200/90`}>V</span>
          </div>
          <div className="min-w-0">
            <p className={`${cormorant.className} text-xl font-medium tracking-[0.2em] text-zinc-50`}>
              VOYAGE
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              {role ? t.subtitle[role] : " "}
            </p>
          </div>
        </Link>
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
                  {section.items.map((item) =>
                    item.children?.length ? (
                      renderGroup(item, mobile)
                    ) : (
                      <li key={item.key}>
                        {renderLink(item, mobile, { active: isActive(item.href, pathname) })}
                      </li>
                    )
                  )}
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
