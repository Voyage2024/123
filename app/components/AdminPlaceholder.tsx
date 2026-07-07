"use client";

import { Crown, Loader2, Lock, type LucideIcon } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN PLACEHOLDER — общий каркас для разделов админки «в разработке».
 *
 * Держит единый заголовок (Crown + Admin badge + Cormorant H1), тот же
 * admin-guard, что на Overview/Directory, и центральный Empty State.
 * Разделы отличаются только пропсами — вёрстка и стиль общие, поэтому
 * все заглушки выглядят как один продукт.
 *
 * Когда раздел «оживёт», замените <AdminPlaceholder … /> на реальную
 * страницу — guard и шапку можно скопировать отсюда.
 * ──────────────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = "fridelltubaugh129@gmail.com";
const SERIF = { fontFamily: "'Cormorant Garamond', serif" } as const;

interface AdminPlaceholderProps {
  eyebrow: string; // мелкий лейбл над заголовком (напр. «Заявки»)
  title: string; // H1 (Cormorant)
  subtitle: string; // подзаголовок
  icon: LucideIcon; // крупная иконка Empty State
  emptyTitle: string; // заголовок пустого состояния
  emptyText: string; // приглушённое пояснение
  actionLabel: string; // подпись пока неактивной кнопки
}

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-md ${className}`}
    >
      <div className="absolute left-0 right-0 top-0 h-px bg-zinc-700/20" />
      {children}
    </div>
  );
}

export default function AdminPlaceholder({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  emptyTitle,
  emptyText,
  actionLabel,
}: AdminPlaceholderProps) {
  const { user, loading: authLoading } = useAuth();

  const isAdmin =
    !!user?.email &&
    user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

  // ── Guard 1: сессия ещё проверяется ──────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-300/70" />
      </div>
    );
  }

  // ── Guard 2: не админ ────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <GlassCard className="w-full max-w-sm">
          <div className="flex flex-col items-center p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-800/30 bg-amber-950/30 text-amber-300/70">
              <Lock className="h-5 w-5" />
            </div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Access Denied
            </p>
            <h1 className="mb-2 text-2xl text-zinc-100" style={SERIF}>
              Только для администраторов
            </h1>
            <p className="text-xs leading-relaxed text-zinc-500">
              Эта область доступна только администраторам клуба.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── Раздел ───────────────────────────────────────────────────────
  return (
    <div className="relative text-zinc-100">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full opacity-[0.03]"
          style={{
            background:
              "radial-gradient(circle, rgba(212,168,83,0.4) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative">
        {/* ── Header ────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="mb-2 flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-200/60" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              {eyebrow}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-300/80">
              Admin
            </span>
          </div>
          <h1 className="mb-2 text-4xl text-zinc-100 md:text-5xl" style={SERIF}>
            {title}
          </h1>
          <p className="text-xs tracking-wide text-zinc-500">{subtitle}</p>
        </header>

        {/* ── Empty State ───────────────────────────────────────── */}
        <GlassCard>
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center md:py-28">
            {/* крупная иконка в мягком amber-свечении */}
            <div className="relative mb-6">
              <div
                className="absolute inset-0 rounded-2xl opacity-40 blur-xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(212,168,83,0.25) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-amber-500/25 bg-zinc-950/40 text-amber-200/70">
                <Icon className="h-8 w-8" strokeWidth={1.25} />
              </div>
            </div>

            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Раздел в разработке
            </p>
            <h2 className="mb-2 text-2xl text-zinc-100" style={SERIF}>
              {emptyTitle}
            </h2>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-zinc-500">
              {emptyText}
            </p>

            {/* Пока неактивная кнопка действия */}
            <button
              type="button"
              disabled
              title="Скоро"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-amber-500/25 bg-amber-950/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-amber-200/50 opacity-60"
            >
              {actionLabel}
              <span className="rounded-full border border-zinc-700/50 bg-zinc-900/60 px-1.5 py-0.5 text-[8px] tracking-widest text-zinc-500">
                Скоро
              </span>
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
