/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — часы и длительности
 * app/(dashboard)/partner/_lib/clock.ts
 *
 * useNow()  — один общий таймер на всю страницу (тик раз в 30 с).
 *             На сервере и при гидрации возвращает 0 — «время неизвестно»:
 *             относительные сроки показываются только на клиенте, поэтому
 *             разметка сервера и клиента совпадает.
 * fmtDur()  — «2 ч 15 мин», «1 дн 22 ч», «3 дн» на языке интерфейса.
 * ──────────────────────────────────────────────────────────────────── */

import { useSyncExternalStore } from "react";
import type { Lang } from "@/app/context/LanguageContext";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const TICK_MS = 30_000;
let clockNow = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    clockNow = Date.now();
    timer = setInterval(() => {
      clockNow = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const getNow = () => {
  if (!clockNow) clockNow = Date.now();
  return clockNow;
};
const getServerNow = () => 0;

export function useNow() {
  return useSyncExternalStore(subscribe, getNow, getServerNow);
}

export type Units = { d: string; h: string; m: string; sep: string };

export const UNITS: Record<Lang, Units> = {
  EN: { d: "d", h: "h", m: "m", sep: "" },
  RU: { d: "дн", h: "ч", m: "мин", sep: " " },
  ES: { d: "d", h: "h", m: "min", sep: " " },
  PT: { d: "d", h: "h", m: "min", sep: " " },
};

/** 2 ч 15 мин · 1 дн 22 ч · 3 дн */
export function fmtDur(totalMin: number, u: Units) {
  const min = Math.max(0, Math.round(totalMin));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const part = (v: number, unit: string) => `${v}${u.sep}${unit}`;
  if (d >= 2) return part(d, u.d);
  if (d === 1) return h ? `${part(1, u.d)} ${part(h, u.h)}` : part(1, u.d);
  if (h > 0) return m ? `${part(h, u.h)} ${part(m, u.m)}` : part(h, u.h);
  return part(Math.max(1, m), u.m);
}

/** Сколько прошло с момента at (мс) — «3 ч» */
export function fmtAge(at: number, now: number, u: Units) {
  return fmtDur((now - at) / MIN, u);
}
