import type { LucideIcon } from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

/* ──────────────────────────────────────────────────────────────────────
 * RESIDENT PLACEHOLDER — единый шаблон «раздел в разработке».
 *
 * Тот же визуальный язык, что и в AdminPlaceholder: glassmorphism-карточка,
 * пунктирная amber-рамка с мягким свечением вокруг центральной иконки,
 * Cormorant Garamond для заголовка. Кнопка неактивна и несёт бейдж «Скоро»,
 * чтобы гость понимал: раздел существует, но пока закрыт.
 * ──────────────────────────────────────────────────────────────────── */

type ResidentPlaceholderProps = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  buttonText: string;
};

export default function ResidentPlaceholder({
  title,
  subtitle,
  icon: Icon,
  buttonText,
}: ResidentPlaceholderProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-10 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Мягкое амбиентное свечение сверху */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />

        {/* Иконка в пунктирной рамке со свечением */}
        <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-amber-400/10 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/40" />
          <Icon
            size={30}
            strokeWidth={1.25}
            className="relative text-amber-200/90"
          />
        </div>

        {/* Заголовок */}
        <h1
          className={`${cormorant.className} text-3xl font-medium tracking-wide text-zinc-50`}
        >
          {title}
        </h1>

        {/* Подзаголовок */}
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
          {subtitle}
        </p>

        {/* Неактивная CTA с бейджем «Скоро» */}
        <div className="mt-8">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-2.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-5 py-2.5 text-sm text-zinc-500"
          >
            <span className="tracking-wide">{buttonText}</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">
              Скоро
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
