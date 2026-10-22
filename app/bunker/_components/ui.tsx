"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ──────────────────────────────────────────────────────────────────────
 * Бункер · базовые элементы интерфейса (Quiet Luxury / Cyber-Bunker).
 * Фон #09090b, поверхности #121215, акцент — золото #c9a961.
 * ──────────────────────────────────────────────────────────────────── */

export const GOLD = "#c9a961";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9a961]/80">{eyebrow}</p>
        )}
        <h1 className="voyage-cormorant truncate text-[34px] font-medium leading-none tracking-tight text-white md:text-[42px]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({
  children,
  className,
  onClick,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "div" | "button" | "section";
}) {
  const Tag = as;
  return (
    <Tag
      onClick={onClick}
      className={cx(
        "rounded-2xl border border-white/[0.06] bg-[#121215] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]",
        onClick && "w-full text-left transition-colors active:bg-[#17171b] md:hover:border-white/[0.1]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

type ButtonTone = "gold" | "ghost" | "outline" | "danger";

export function Button({
  tone = "gold",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  const tones: Record<ButtonTone, string> = {
    gold: "bg-[#c9a961] text-black hover:bg-[#d6b874] disabled:bg-[#c9a961]/40",
    ghost: "bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] disabled:text-zinc-600",
    outline: "border border-[#c9a961]/40 text-[#e3cf9e] hover:bg-[#c9a961]/10 disabled:opacity-40",
    danger: "bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-40",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        tones[tone],
        className,
      )}
      {...(rest as unknown as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white",
        className,
      )}
      {...(rest as unknown as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[15px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-[#c9a961]/60 focus:bg-black/60";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex gap-0.5 rounded-2xl border border-white/[0.06] bg-[#121215] p-1 sm:gap-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[13px] font-medium transition-colors sm:gap-1.5 sm:px-3",
              active ? "text-black" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-xl bg-[#c9a961]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span className={cx("relative z-10 text-[11px] tabular-nums", active ? "text-black/60" : "text-zinc-600")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  color?: string | null;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] transition-colors",
        active
          ? "border-[#c9a961]/60 bg-[#c9a961]/15 text-[#f1e2bb]"
          : "border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:text-zinc-200",
      )}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </motion.button>
  );
}

/** Цвет прогресса: красный → золотой → зелёный. */
export function progressColor(pct: number) {
  if (pct >= 100) return "#4ade80";
  if (pct >= 70) return "#a3d977";
  if (pct >= 40) return GOLD;
  if (pct >= 15) return "#f59e0b";
  return "#f87171";
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = progressColor(pct);
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
        style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 12px ${color}55` }}
      />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.08] px-6 py-12 text-center"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a961]/10 text-[#c9a961]">{icon}</div>
      <p className="text-[15px] font-medium text-zinc-200">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-white/[0.04]", className)} />;
}

/**
 * Шторка снизу (iPhone) / модальное окно по центру (десктоп).
 * Закрывается свайпом вниз, тапом по фону и Escape.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const controls = useDragControls();
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
            className={cx(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#111114] shadow-2xl shadow-black md:rounded-3xl",
              wide ? "md:max-w-3xl" : "md:max-w-lg",
            )}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-3 md:hidden"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            {title !== undefined && (
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-1 md:pt-5">
                <div className="voyage-cormorant min-w-0 truncate text-2xl text-white">{title}</div>
                <IconButton label="Закрыть" onClick={onClose}>
                  <X className="h-5 w-5" />
                </IconButton>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
            {footer && (
              <div className="border-t border-white/[0.06] bg-[#0d0d10] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Fab({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#c9a961] text-black shadow-[0_10px_30px_-6px_rgba(201,169,97,0.6)] md:bottom-8 md:right-8"
    >
      {children}
    </motion.button>
  );
}

/** Удаление в два тапа: первый «взводит», второй подтверждает (3 секунды). */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Точно удалить?",
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button tone="danger" onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : children}
    </Button>
  );
}
