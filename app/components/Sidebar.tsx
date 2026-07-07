"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  GlassWater,
  Plane,
  Trophy,
  ConciergeBell,
  Users,
  ShieldAlert,
  Map,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import { useAuth } from "@/app/context/AuthContext";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

/* ──────────────────────────────────────────────────────────────────────
 * SIDEBAR — умное меню с разделением ролей.
 *
 * Тот же ADMIN_EMAIL и то же регистронезависимое сравнение, что и на
 * /admin, чтобы «истина о роли» жила в одном месте по всему приложению.
 * Пока сессия грузится (loading), рендерим скелет — иначе админ на первом
 * кадре увидит резидентское меню (user ещё null), и оно «прыгнет».
 * ──────────────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = "fridelltubaugh129@gmail.com";

type NavItem = { label: string; href: string; icon: LucideIcon };

const residentNav: NavItem[] = [
  { label: "My Voyage", href: "/dashboard", icon: CreditCard },
  { label: "Тусовки", href: "/dashboard/parties", icon: GlassWater },
  { label: "Туры", href: "/dashboard/tours", icon: Plane },
  { label: "Геймификация", href: "/dashboard/gamification", icon: Trophy },
  { label: "Консьерж", href: "/dashboard/concierge", icon: ConciergeBell },
  { label: "Настройки", href: "/dashboard/settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Directory", href: "/admin/directory", icon: Users },
  { label: "Face Control", href: "/admin/face-control", icon: ShieldAlert },
  { label: "Туры / Тусовки", href: "/admin/events", icon: Map },
  { label: "Gamification", href: "/admin/gamification", icon: Trophy },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

// Индексные маршруты активны только при точном совпадении, иначе
// «/admin» подсвечивался бы и на «/admin/directory» (оба startsWith).
const INDEX_ROUTES = new Set(["/admin", "/dashboard"]);

function isActive(href: string, pathname: string) {
  if (pathname === href) return true;
  if (INDEX_ROUTES.has(href)) return false;
  return pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isAdmin =
    !!user?.email &&
    user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

  const navItems = isAdmin ? adminNav : residentNav;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl md:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-zinc-800/80 px-8 py-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/30">
          <span
            className={`${cormorant.className} text-lg font-medium text-amber-200/90`}
          >
            V
          </span>
        </div>
        <div>
          <p
            className={`${cormorant.className} text-xl font-medium tracking-[0.2em] text-zinc-50`}
          >
            VOYAGE
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            {isAdmin ? "Admin Console" : "Private Club"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8">
        {loading ? (
          // Скелет на время проверки сессии — убирает мигание меню роли.
          <ul className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/60" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-3 rounded-md border-l px-4 py-3 text-sm transition-colors ${
                      active
                        ? "border-amber-500/50 bg-zinc-900/50 text-zinc-100"
                        : "border-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-100"
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.5}
                      className={
                        active
                          ? "text-amber-300/80"
                          : "text-zinc-500 group-hover:text-zinc-300"
                      }
                    />
                    <span className="tracking-wide">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {/* Role footer */}
      <div className="border-t border-zinc-800/80 px-6 py-5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] ${
            isAdmin
              ? "border-amber-500/30 bg-amber-950/40 text-amber-300/80"
              : "border-zinc-800/60 bg-zinc-900/40 text-zinc-500"
          }`}
        >
          {isAdmin ? "Administrator" : "Resident"}
        </span>
      </div>
    </aside>
  );
}
