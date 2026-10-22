"use client";

import { motion } from "framer-motion";
import { KeyRound, LayoutGrid, ListTodo, NotebookPen, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ToastProvider } from "@/app/bunker/_components/toast";
import { cx } from "@/app/bunker/_components/ui";

/* ──────────────────────────────────────────────────────────────────────
 * Оболочка бункера: нижняя навигация на iPhone, боковая — на десктопе.
 * Учитывает вырез и «домашнюю» полоску (black-translucent статус-бар
 * рисует контент под собой, поэтому сверху отступ env(safe-area-inset-top)).
 * ──────────────────────────────────────────────────────────────────── */

const NAV = [
  { href: "/bunker", label: "Хаб", icon: LayoutGrid },
  { href: "/bunker/tasks", label: "Задачи", icon: ListTodo },
  { href: "/bunker/finance", label: "Финансы", icon: Wallet },
  { href: "/bunker/notes", label: "Заметки", icon: NotebookPen },
  { href: "/bunker/vault", label: "Сейф", icon: KeyRound },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/bunker" ? pathname === "/bunker" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function BunkerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/bunker";

  return (
    <ToastProvider>
      <div className="bunker-root relative min-h-[100dvh] w-full bg-[#09090b] text-zinc-100">
        {/* мягкое золотое свечение сверху */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(201,169,97,0.10),transparent_65%)]"
        />

        {/* Десктоп: боковая панель */}
        <nav className="fixed inset-y-0 left-0 z-50 hidden w-[88px] flex-col items-center border-r border-white/[0.05] bg-[#0b0b0d]/90 py-6 backdrop-blur-xl md:flex">
          <Link href="/bunker" className="voyage-cormorant mb-8 text-2xl tracking-[0.2em] text-[#c9a961]" aria-label="Бункер">
            B
          </Link>
          <div className="flex flex-1 flex-col gap-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cx(
                    "relative flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium uppercase tracking-wider transition-colors",
                    active ? "text-[#e9d7a8]" : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="bunker-rail"
                      className="absolute inset-0 rounded-2xl border border-[#c9a961]/30 bg-[#c9a961]/10"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  <Icon className="relative h-5 w-5" strokeWidth={1.6} />
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </div>
          <Link href="/admin" className="text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-300">
            Voyage
          </Link>
        </nav>

        <main className="relative md:pl-[88px]">
          <div className="mx-auto w-full max-w-5xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 md:px-10 md:pb-16 md:pt-10">
            {children}
          </div>
        </main>

        {/* iPhone: нижняя навигация */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-[#09090b]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
          <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cx(
                    "relative flex h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                    active ? "text-[#e9d7a8]" : "text-zinc-500",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="bunker-tab"
                      className="absolute top-0 h-[2px] w-8 rounded-full bg-[#c9a961] shadow-[0_0_12px_rgba(201,169,97,0.8)]"
                      transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    />
                  )}
                  <motion.span whileTap={{ scale: 0.82 }} className="flex flex-col items-center gap-1">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 1.9 : 1.5} />
                    {label}
                  </motion.span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ToastProvider>
  );
}
