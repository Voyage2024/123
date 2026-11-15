"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Воронка модели для скаута и менеджера-скаута
 *
 *   Регистрация → Фото (KYC 0) → Паспорт (KYC 1) → Видео (KYC 2)
 *   → Одобрена клубом → В туре
 *
 * Только флаги этапов из voyage_model_readiness: без документов, фото
 * паспорта, заработка и контактов. Кнопка «Напомнить» шлёт модели готовый
 * шаблон в Telegram (не чаще раза в 20 часов, без свободного текста).
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { Bell, Check, Clock3, Loader2 } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { nudgeModel } from "@/app/actions/scouting";
import { BTN_GHOST } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { FUNNEL, funnelStates, nudgeAvailableAt, nudgeFor, type NudgeKind, type Readiness } from "@/lib/scouting/cabinet";
import { cabinetDict, cabinetError, nextText, type CabinetDict } from "@/lib/scouting/cabinet-i18n";
import { fmtDateTime, fmtDay, type UiLang } from "@/lib/tour-ops/time";

export function useCabinet(): { c: CabinetDict; lang: UiLang } {
  const { lang } = useLanguage();
  const ui = (["EN", "RU", "ES", "PT"].includes(String(lang)) ? lang : "RU") as UiLang;
  return useMemo(() => ({ c: cabinetDict(ui), lang: ui }), [ui]);
}

const NEXT_TONE: Record<string, string> = {
  restricted: "border-rose-400/30 bg-rose-400/[0.06] text-rose-100/90",
  not_approved: "border-rose-400/30 bg-rose-400/[0.06] text-rose-100/90",
  in_tour: "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-100",
  ready: "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-100",
  waiting: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
};

/** Шесть этапов строкой + подсказка «чего не хватает». */
export function ModelFunnel({ r, hasTour, tz }: { r: Readiness; hasTour: boolean; tz: string }) {
  const { c, lang } = useCabinet();
  const states = funnelStates(r, hasTour);
  const where = r.inTour
    ? `${r.inTour.city} · ${fmtDay(r.inTour.departsAt, tz, lang)}${r.inTour.returnsAt ? ` — ${fmtDay(r.inTour.returnsAt, tz, lang)}` : ""}`
    : "";
  const level = r.next === "kyc_review" ? r.kycPending ?? r.kycLevel + 1 : Math.max(r.requiredKyc ?? 1, r.kycLevel + 1);
  const hint = nextText(c, r.next, { level, castings: r.openCastingsOk, where });
  return (
    <div className="mt-3 space-y-2.5">
      <ol className="grid grid-cols-6 gap-1" aria-label={c.pages.models.title}>
        {FUNNEL.map((step) => {
          const st = states[step];
          return (
            <li key={step} className="min-w-0" title={`${c.funnel[step]} · ${c.state[st]}`}>
              <span
                className={`block h-1.5 rounded-full ${st === "done" ? "bg-amber-200/80" : st === "pending" ? "bg-amber-200/30" : "bg-zinc-800"}`}
                aria-hidden
              />
              <span className={`mt-1 flex items-center gap-0.5 truncate text-[9px] uppercase tracking-[0.08em] ${st === "done" ? "text-zinc-300" : st === "pending" ? "text-amber-100/70" : "text-zinc-600"}`}>
                {st === "done" ? <Check className="size-2.5 shrink-0" aria-hidden /> : st === "pending" ? <Clock3 className="size-2.5 shrink-0" aria-hidden /> : null}
                <span className="truncate">{c.funnel[step]}</span>
              </span>
              <span className="sr-only">{c.state[st]}</span>
            </li>
          );
        })}
      </ol>
      <p className={`rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug ${NEXT_TONE[r.next] ?? "border-amber-300/25 bg-amber-300/[0.05] text-amber-50/90"}`}>
        {hint}
        {r.lastSeenDays !== null && <span className="ml-1 text-[11px] text-zinc-500">· {c.lastSeen(r.lastSeenDays)}</span>}
      </p>
    </div>
  );
}

/** «Напомнить» — по текущему шагу или про конкретный кастинг. */
export function NudgeButton({
  modelId,
  kind,
  castingId,
  lastNudgeAt,
  compact = false,
  onResult,
}: {
  modelId: string;
  kind: NudgeKind;
  castingId?: string;
  lastNudgeAt: string | null;
  compact?: boolean;
  onResult: (text: string, tone: "emerald" | "amber" | "rose") => void;
}) {
  const { c, lang } = useCabinet();
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => nudgeAvailableAt(lastNudgeAt));
  const locked = lockedUntil !== null && lockedUntil > Date.now();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const send = async () => {
    setBusy(true);
    const r = await nudgeModel({ modelId, kind, castingId });
    setBusy(false);
    if (r.ok) {
      setLockedUntil(Date.now() + 20 * 60 * 60 * 1000);
      onResult(r.notified ? c.nudge.sent : c.nudge.sentNoTelegram, r.notified ? "emerald" : "amber");
      return;
    }
    if (r.code === "too_soon") {
      const at = r.nextAt ? Date.parse(r.nextAt) : Date.now() + 60 * 60 * 1000;
      setLockedUntil(at);
      onResult(c.nudge.tooSoon(fmtDateTime(new Date(at).toISOString(), tz, lang)), "amber");
      return;
    }
    onResult(r.code === "daily_limit" ? c.nudge.dailyLimit : cabinetError(c, r.code), "rose");
  };

  return (
    <button
      type="button"
      className={`${BTN_GHOST} ${compact ? "px-2.5 py-1 text-[11px]" : ""}`}
      disabled={busy || locked}
      onClick={send}
      title={locked && lockedUntil ? c.nudge.tooSoon(fmtDateTime(new Date(lockedUntil).toISOString(), tz, lang)) : `${c.nudge.button} ${c.nudge.kinds[kind]}`}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
      {compact ? (kind === "casting" ? c.showcase.tell : c.nudge.button) : `${c.nudge.button} ${c.nudge.kinds[kind]}`}
    </button>
  );
}

/** Кнопка для карточки модели: показывается, только если есть что напомнить. */
export function FunnelNudge({ modelId, r, lastNudgeAt, onResult }: { modelId: string; r: Readiness; lastNudgeAt: string | null; onResult: (text: string, tone: "emerald" | "amber" | "rose") => void }) {
  const kind = nudgeFor(r.next);
  if (!kind) return null;
  return <NudgeButton modelId={modelId} kind={kind} lastNudgeAt={lastNudgeAt} onResult={onResult} />;
}
