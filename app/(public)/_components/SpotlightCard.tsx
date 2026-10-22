"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/* ──────────────────────────────────────────────────────────────────────
 * Карточка с золотым Spotlight/Glow Hover для главной.
 * Курсор двигает CSS-переменные --spot-x / --spot-y (через ref, без
 * ререндеров), за ним плывёт мягкое свечение заливки и золотой блик
 * по рамке; при наведении по карточке один раз проходит перелив.
 * На тач-устройствах свечение включается по фокусу/тапу из центра.
 * Внутри можно использовать group-hover/spot:… для своих элементов.
 * ──────────────────────────────────────────────────────────────────── */

// Фирменное золото клуба (то же, что в кабинете резидента)
export const GOLD = "#c9a961";

// Рамка рисуется градиентом, а маска вырезает середину — остаётся контур 1px
const BORDER_MASK: CSSProperties = {
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  maskComposite: "exclude",
};

export default function SpotlightCard({
  children,
  className = "",
  glowSize = 420,
}: {
  children: ReactNode;
  className?: string;
  /** Радиус свечения заливки в px */
  glowSize?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      style={{ "--spot-x": "50%", "--spot-y": "30%" } as CSSProperties}
      className={`group/spot relative isolate overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-zinc-900/70 to-zinc-950/80 backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-500 ease-out hover:-translate-y-0.5 hover:border-[#c9a961]/25 hover:shadow-[0_30px_80px_-40px_rgba(201,169,97,0.35)] focus-within:border-[#c9a961]/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`}
    >
      {/* Свечение заливки за курсором */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100 group-focus-within/spot:opacity-100"
        style={{
          background: `radial-gradient(${glowSize}px circle at var(--spot-x) var(--spot-y), rgba(201,169,97,0.13), transparent 45%)`,
        }}
      />
      {/* Золотой блик по рамке */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100 group-focus-within/spot:opacity-100"
        style={{
          ...BORDER_MASK,
          background: `radial-gradient(260px circle at var(--spot-x) var(--spot-y), rgba(201,169,97,0.75), transparent 45%)`,
        }}
      />
      {/* Перелив: диагональная полоса проходит по карточке при наведении */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-[60%] w-[45%] -skew-x-12 bg-gradient-to-r from-transparent via-[#c9a961]/[0.09] to-transparent transition-[left] duration-[1100ms] ease-out group-hover/spot:left-[130%] motion-reduce:hidden"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
