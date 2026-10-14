"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — общие слова и форматирование для страниц пульта
 * app/(dashboard)/partner/_lib/format.ts
 *
 * usePartnerFormat() → { lang, c, fmt }
 *   c    — общий словарь (типы проектов, «назад», «через», поиск, фильтры)
 *   fmt  — даты, длительности, числа, деньги, города на языке интерфейса
 *
 * Относительное время и даты считаются только на клиенте (useNow):
 * на сервере fmt.ready = false и вместо них прочерк — гидрация без
 * расхождений, даже если часовой пояс сервера другой.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo } from "react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { MIN, UNITS, fmtDur, useNow, type Units } from "./clock";
import { cityLabel } from "./cities";
import type { Payer, ProjectKey } from "./command";

/** Русское склонение: 1 тур · 2 тура · 5 туров */
export function ru(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
/** EN / ES / PT: 1 tour · 2 tours */
export const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

export type Common = {
  locale: string;
  demo: string;
  demoHint: string;
  projects: Record<ProjectKey, string>;
  payer: Record<Payer, string>;
  ago: (d: string) => string;
  in: (d: string) => string;
  search: string;
  clear: string;
  nothing: string;
  reset: string;
  table: string;
};

export const COMMON: Record<Lang, Common> = {
  EN: {
    locale: "en-GB",
    demo: "Demo data",
    demoHint: "The screen shows sample data until it is connected to the database.",
    projects: { shoot: "shoot", show: "show", campaign: "campaign", event: "event" },
    payer: { manager: "manager", participant: "participant", split: "split" },
    ago: (d) => `${d} ago`,
    in: (d) => `in ${d}`,
    search: "Search",
    clear: "Clear",
    nothing: "Nothing matches these filters.",
    reset: "Reset filters",
    table: "Show as table",
  },
  RU: {
    locale: "ru-RU",
    demo: "Демо-данные",
    demoHint: "Экран показывает пример данных, пока его не подключили к базе.",
    projects: { shoot: "съёмка", show: "показ", campaign: "кампейн", event: "ивент" },
    payer: { manager: "менеджер", participant: "участница", split: "пополам" },
    ago: (d) => `${d} назад`,
    in: (d) => `через ${d}`,
    search: "Поиск",
    clear: "Очистить",
    nothing: "По этим фильтрам ничего нет.",
    reset: "Сбросить фильтры",
    table: "Показать таблицей",
  },
  ES: {
    locale: "es-ES",
    demo: "Datos de demostración",
    demoHint: "La pantalla muestra datos de ejemplo hasta conectarla a la base.",
    projects: { shoot: "sesión", show: "desfile", campaign: "campaña", event: "evento" },
    payer: { manager: "gerente", participant: "participante", split: "a medias" },
    ago: (d) => `hace ${d}`,
    in: (d) => `en ${d}`,
    search: "Buscar",
    clear: "Borrar",
    nothing: "Nada coincide con estos filtros.",
    reset: "Quitar filtros",
    table: "Ver como tabla",
  },
  PT: {
    locale: "pt-BR",
    demo: "Dados de demonstração",
    demoHint: "A tela mostra dados de exemplo até ser conectada ao banco.",
    projects: { shoot: "ensaio", show: "desfile", campaign: "campanha", event: "evento" },
    payer: { manager: "gerente", participant: "participante", split: "dividido" },
    ago: (d) => `há ${d}`,
    in: (d) => `em ${d}`,
    search: "Buscar",
    clear: "Limpar",
    nothing: "Nada corresponde a esses filtros.",
    reset: "Limpar filtros",
    table: "Ver como tabela",
  },
};

export function makeFormat(c: Common, u: Units, now: number, lang: Lang) {
  const ready = now > 0;
  const span = (ms: number) => fmtDur(ms / MIN, u);
  return {
    ready,
    now,
    units: u,
    /** «2 ч 15 мин» до момента */
    until: (at: number) => (ready ? span(at - now) : "—"),
    /** «3 дн» с момента */
    since: (at: number) => (ready ? span(now - at) : "—"),
    /** «3 дн назад» */
    ago: (at: number) => (ready ? c.ago(span(now - at)) : "—"),
    /** «через 2 ч» */
    in: (at: number) => (ready ? c.in(span(at - now)) : "—"),
    date: (at: number, o: Intl.DateTimeFormatOptions) => (ready ? new Intl.DateTimeFormat(c.locale, o).format(at) : "—"),
    range: (a: number, b: number) => {
      if (!ready) return "—";
      const df = new Intl.DateTimeFormat(c.locale, { day: "numeric", month: "short" });
      return typeof df.formatRange === "function" ? df.formatRange(a, b) : `${df.format(a)} – ${df.format(b)}`;
    },
    num: (n: number, digits = 0) =>
      new Intl.NumberFormat(c.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    money: (amount: number, currency: string) => {
      try {
        return new Intl.NumberFormat(c.locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
      } catch {
        return `${amount} ${currency}`;
      }
    },
    city: (raw: string | null) => cityLabel(raw, lang),
  };
}
export type Fmt = ReturnType<typeof makeFormat>;

export function usePartnerFormat() {
  const { lang } = useLanguage();
  const now = useNow();
  const c = COMMON[lang] ?? COMMON.EN;
  const fmt = useMemo(() => makeFormat(c, UNITS[lang] ?? UNITS.EN, now, lang), [c, lang, now]);
  return { lang, c, fmt };
}
