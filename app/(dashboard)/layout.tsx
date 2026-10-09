import Sidebar from "../components/Sidebar";

/* ──────────────────────────────────────────────────────────────────────
 * DASHBOARD LAYOUT — app/(dashboard)/layout.tsx
 *
 * Ширина строго равна экрану:
 *   • min-w-0 у <main> — без него flex-элемент растягивается по самому
 *     широкому потомку (таблица, длинная строка) и iOS отдаляет страницу;
 *   • overflow-x-clip у обёртки — ничто не создаст горизонтальную прокрутку
 *     (clip, а не hidden: не ломает position: sticky внутри страниц).
 *
 * Отступ сверху на телефоне = реальная высота шапки (--nav-h ставит Navbar,
 * с учётом выреза iPhone). На десктопе отступы прежние.
 * Нижний отступ уважает «домашнюю» полоску iPhone.
 * ──────────────────────────────────────────────────────────────────── */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] w-full max-w-full overflow-x-clip bg-zinc-950">
      <Sidebar />

      <main className="min-w-0 flex-1 md:ml-72">
        <div className="mx-auto w-full max-w-6xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[calc(var(--nav-h,3.5rem)+0.5rem)] sm:px-6 md:px-12 md:py-14">
          {children}
        </div>
      </main>
    </div>
  );
}