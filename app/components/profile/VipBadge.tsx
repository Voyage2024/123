/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ЗНАК 3-ГО УРОВНЯ (VIP BADGE)
 * app/components/profile/VipBadge.tsx
 *
 * Знак максимального доверия: резидентка прошла KYC 3 — личную встречу
 * или видеозвонок с консьержем клуба (profiles.kyc_level >= 3).
 *
 *   <VipSeal />        — сама печать: щит с гравировкой, корона и галочка
 *   <VipBadge />       — плашка «Верифицирована консьержем» (pill / compact)
 *   <VipAvatarMark />  — печать в углу аватара или фото
 *
 * Без хуков и без "use client": работает и в серверных компонентах
 * (admin/database/[id]), и в клиентских. SVG без <defs>/id — несколько
 * знаков на странице не конфликтуют, а скрытые копии (md:hidden и т.п.)
 * не ломают отрисовку остальных.
 * ──────────────────────────────────────────────────────────────────── */

import type { Lang } from "@/app/context/LanguageContext";

/** Уровень KYC, с которого показывается знак */
export const KYC_ELITE_LEVEL = 3;

export function isKycElite(level: unknown): boolean {
  const n = Number(level);
  return Number.isFinite(n) && n >= KYC_ELITE_LEVEL;
}

type BadgeCopy = { label: string; short: string; tooltip: string };

export const VIP_BADGE_COPY: Record<Lang, BadgeCopy> = {
  RU: {
    label: "Верифицирована консьержем",
    short: "VIP · Уровень III",
    tooltip: "Высший уровень доверия VOYAGE: личность подтверждена на личной встрече с консьержем клуба.",
  },
  EN: {
    label: "Concierge Verified",
    short: "VIP · Level III",
    tooltip: "VOYAGE's highest level of trust: identity confirmed in person with the club concierge.",
  },
  ES: {
    label: "Verificada por el concierge",
    short: "VIP · Nivel III",
    tooltip: "El máximo nivel de confianza de VOYAGE: identidad confirmada en persona con el concierge del club.",
  },
  PT: {
    label: "Verificada pelo concierge",
    short: "VIP · Nível III",
    tooltip: "O nível máximo de confiança da VOYAGE: identidade confirmada pessoalmente com o concierge do clube.",
  },
};

const copyFor = (lang?: Lang | string | null): BadgeCopy => {
  const key = String(lang ?? "EN").toUpperCase() as Lang;
  return VIP_BADGE_COPY[key] ?? VIP_BADGE_COPY.EN;
};

/* ══════════════════════════════════════════════════════════════════
 * ПЕЧАТЬ
 * ══════════════════════════════════════════════════════════════════ */

export function VipSeal({
  className = "h-4 w-4",
  glow = true,
  title,
}: {
  className?: string;
  /** Мягкое янтарное свечение вокруг печати */
  glow?: boolean;
  /** Подпись для скринридеров; без неё печать декоративная */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`shrink-0 text-amber-200 ${
        glow ? "drop-shadow-[0_0_5px_rgba(253,230,138,0.55)]" : ""
      } ${className}`}
    >
      {title && <title>{title}</title>}
      {/* щит */}
      <path
        d="M12 1.9 19.8 4.9v6.2c0 5-3.3 9-7.8 10.9C7.5 20.1 4.2 16.1 4.2 11.1V4.9L12 1.9Z"
        fill="currentColor"
        fillOpacity={0.16}
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      {/* гравировка — внутренний контур */}
      <path
        d="M12 4.2 17.7 6.4v4.8c0 3.7-2.4 6.8-5.7 8.3-3.3-1.5-5.7-4.6-5.7-8.3V6.4L12 4.2Z"
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={0.55}
        strokeDasharray="0.9 0.7"
        strokeLinejoin="round"
      />
      {/* корона */}
      <path
        d="M9.15 7.55 10.45 8.9 12 7.05 13.55 8.9 14.85 7.55 14.4 10H9.6l-.45-2.45Z"
        fill="currentColor"
      />
      {/* галочка */}
      <path
        d="m9.1 13.2 2 1.95 3.8-3.75"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ПЛАШКА
 * ══════════════════════════════════════════════════════════════════ */

export function VipBadge({
  lang,
  variant = "pill",
  className = "",
}: {
  lang?: Lang | string | null;
  /**
   * pill    — печать + «Верифицирована консьержем»
   * compact — печать + «VIP · Уровень III» (тесные карточки, списки)
   * seal    — только печать с подсказкой (рядом с именем в строке)
   */
  variant?: "pill" | "compact" | "seal";
  className?: string;
}) {
  const c = copyFor(lang);

  if (variant === "seal") {
    return (
      <span title={c.tooltip} className={`inline-flex items-center align-middle ${className}`}>
        <VipSeal className="h-[1.1em] w-[1.1em]" title={c.label} />
      </span>
    );
  }

  const compact = variant === "compact";
  return (
    <span
      title={c.tooltip}
      className={`relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-amber-200/45 bg-[linear-gradient(100deg,rgba(253,230,138,0.18)_0%,rgba(253,230,138,0.05)_45%,rgba(253,230,138,0.16)_100%)] font-semibold uppercase text-amber-100 shadow-[0_0_20px_-8px_rgba(253,230,138,0.75),inset_0_1px_0_rgba(253,230,138,0.22)] ${
        compact ? "px-2 py-0.5 text-[9px] tracking-[0.14em]" : "px-2.5 py-1 text-[10px] tracking-[0.18em]"
      } ${className}`}
    >
      <VipSeal className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span>{compact ? c.short : c.label}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ПЕЧАТЬ НА АВАТАРЕ
 * ══════════════════════════════════════════════════════════════════ */

/** Кладётся внутрь `relative`-обёртки аватара или фото */
export function VipAvatarMark({
  lang,
  size = "md",
  className = "-bottom-1 -right-1",
}: {
  lang?: Lang | string | null;
  size?: "sm" | "md" | "lg";
  /** Позиция внутри обёртки */
  className?: string;
}) {
  const c = copyFor(lang);
  const box = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-9 w-9" : "h-7 w-7";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]";
  return (
    <span
      title={c.tooltip}
      className={`absolute z-10 flex items-center justify-center rounded-full border border-amber-200/60 bg-zinc-950 shadow-[0_0_14px_-2px_rgba(253,230,138,0.55)] ${box} ${className}`}
    >
      <VipSeal className={icon} title={c.label} />
    </span>
  );
}
