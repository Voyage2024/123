"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Скаутинг — общие мелочи интерфейса
 * (словарь, аватар, статус бонуса, диапазон дат тура).
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { initials, resolveAvatarUrl } from "@/lib/memberCards";
import { scoutDict, type ScoutDict } from "@/lib/scouting/i18n";
import { fmtDay, type UiLang } from "@/lib/tour-ops/time";
import { Chip } from "@/app/components/tour-ops/ops-ui";

export function useScout(): { s: ScoutDict; lang: UiLang } {
  const { lang } = useLanguage();
  const ui = (["EN", "RU", "ES", "PT"].includes(String(lang)) ? lang : "RU") as UiLang;
  return useMemo(() => ({ s: scoutDict(ui), lang: ui }), [ui]);
}

export function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" }) {
  const src = resolveAvatarUrl(url);
  const box = size === "sm" ? "size-8 text-[10px]" : "size-11 text-xs";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${box} shrink-0 rounded-full border border-zinc-800 object-cover`} />
  ) : (
    <span aria-hidden className={`${box} inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 font-medium text-zinc-400`}>
      {initials(name)}
    </span>
  );
}

export const BONUS_TONE: Record<string, string> = {
  pending: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  paid: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  void: "border-zinc-700 bg-zinc-800/40 text-zinc-400",
};

export function BonusStatus({ status, s }: { status: string; s: ScoutDict }) {
  const k = status === "paid" || status === "void" ? status : "pending";
  return <Chip className={BONUS_TONE[k]}>{s.bonusStatus[k]}</Chip>;
}

export const INVITE_TONE: Record<string, string> = {
  invited: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  accepted: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  declined: "border-zinc-700 bg-zinc-800/40 text-zinc-400",
  revoked: "border-zinc-700 bg-zinc-800/40 text-zinc-500",
  expired: "border-zinc-700 bg-zinc-800/40 text-zinc-500",
};

/** «12 ноя — 26 ноя» в часовом поясе зрителя */
export function tourRange(departsAt: string | null, returnsAt: string | null, tz: string, lang: UiLang): string {
  if (!departsAt) return "—";
  const a = fmtDay(departsAt, tz, lang);
  return returnsAt ? `${a} — ${fmtDay(returnsAt, tz, lang)}` : a;
}
