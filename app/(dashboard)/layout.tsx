import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LayoutDashboard, Compass, Award, Wallet } from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Destinations", href: "/destinations", icon: Compass },
  { label: "My Status", href: "/status", icon: Award },
  { label: "Wallet", href: "/wallet", icon: Wallet },
];

// ─────────────────────────────────────────────────────────────
// DASHBOARD LAYOUT — приватная зона.
// Рендерится ТОЛЬКО для маршрутов внутри группы (dashboard).
// Здесь живёт Sidebar + проверка авторизации.
// Публичные страницы (/, /destinations, /tours) сюда не попадают.
// ─────────────────────────────────────────────────────────────
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- Auth guard (ЗАГЛУШКА — замени на свою реальную проверку сессии) ---
  // Пример: читаем httpOnly-куку сессии. Нет сессии → редирект на /login.
  const session = (await cookies()).get("voyage_session")?.value;
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — только в приватной зоне */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl md:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-8 py-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/30">
            <span className={`${cormorant.className} text-lg font-medium text-amber-200/90`}>
              V
            </span>
          </div>
          <div>
            <p className={`${cormorant.className} text-xl font-medium tracking-[0.2em] text-zinc-50`}>
              VOYAGE
            </p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Private Club
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8">
          <p className="px-4 pb-3 text-[10px] uppercase tracking-[0.25em] text-zinc-600">
            Menu
          </p>
          <ul className="space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === 0;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-md border-l px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? "border-amber-200/60 bg-zinc-900/60 text-zinc-50"
                        : "border-transparent text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/40 hover:text-zinc-100"
                    }`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.5}
                      className={isActive ? "text-amber-200/80" : "text-zinc-500 group-hover:text-zinc-300"}
                    />
                    <span className="tracking-wide">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer badge */}
        <div className="border-t border-zinc-800/80 px-6 py-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              Member Since
            </p>
            <p className={`${cormorant.className} mt-1 text-sm text-zinc-300`}>
              2026
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-72">
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
