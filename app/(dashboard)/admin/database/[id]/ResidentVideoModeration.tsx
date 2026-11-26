"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity в карточке резидентки (owner/admin)
 * app/(dashboard)/admin/database/[id]/ResidentVideoModeration.tsx
 *
 * Видит всё, включая скрытое резидентки (scope «Только я») и скрытое
 * администрацией. Скрыть можно только с причиной (3–500 символов) —
 * резидентка увидит её у себя. Каждое действие пишется в audit_logs.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Clapperboard, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { getResidentMediaForViewer, staffSetMediaHidden } from "@/app/actions/resident-media-view";
import { MEDIA_COPY, formatDuration, type MediaBundle, type MediaItem } from "@/lib/resident-media";
import { VoyageVideoPlayer } from "@/app/components/media/VoyageVideoPlayer";
import { MomentStoryViewer } from "@/app/components/media/MomentStoryViewer";
import { MomentBubble } from "@/app/components/media/MomentBubble";

const c = MEDIA_COPY.RU;
const SCOPE_LABEL: Record<string, string> = {
  engaged: "Менеджерам, с которыми работает",
  hidden: "Только она (скрыто от менеджеров)",
  catalog: "Каталог (этап 2)",
};

export default function ResidentVideoModeration({ profileId }: { profileId: string }) {
  const [bundle, setBundle] = useState<MediaBundle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [hideFor, setHideFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<number | null>(null);

  useEffect(() => {
    void getResidentMediaForViewer(profileId, "admin", null).then((res) => {
      if (res.ok) { setBundle(res.bundle); setState("ready"); }
      else setState(res.reason === "schema" ? "missing" : "error");
    });
  }, [profileId]);

  const act = async (item: MediaItem, hide: boolean) => {
    setBusy(item.id);
    setError(null);
    const res = await staffSetMediaHidden(profileId, item.id, hide, hide ? reason : null);
    setBusy(null);
    if (!res.ok) { setError(res.reason === "invalid" ? "Укажите причину: от 3 до 500 символов." : "Не удалось сохранить. Обновите страницу."); return; }
    setBundle(res.bundle);
    setHideFor(null);
    setReason("");
  };

  const intro = bundle?.items.find((i) => i.kind === "intro") ?? null;
  const moments = bundle?.items.filter((i) => i.kind === "moment") ?? [];
  const labels = { play: c.play, pause: c.pause, mute: c.mute, unmute: c.unmute, fullscreen: c.fullscreen, watermark: c.watermark };

  const row = (item: MediaItem, label: string) => (
    <li key={item.id} className="rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-200">{label}</span>
        <span className="font-mono text-[10px] text-zinc-500">{formatDuration(item.durationMs)} · {item.source === "upload" ? "загрузка" : "камера сайта"} · {new Date(item.recordedAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}</span>
        {item.status === "hidden_by_staff" ? <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-200">Скрыто · {item.hiddenReason}</span> : <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[10px] text-emerald-200">Активно</span>}
        <span className="flex-1" />
        {item.status === "hidden_by_staff" ? (
          <button type="button" disabled={busy === item.id} onClick={() => void act(item, false)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:border-emerald-300/40 disabled:opacity-50">{busy === item.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Вернуть</button>
        ) : (
          <button type="button" onClick={() => { setHideFor(hideFor === item.id ? null : item.id); setReason(""); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/25 px-2.5 py-1.5 text-[11px] text-rose-200 hover:bg-rose-400/10"><EyeOff size={12} /> Скрыть</button>
        )}
      </div>
      {hideFor === item.id && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Причина (её увидит резидентка)" className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-300/40" />
          <button type="button" disabled={busy === item.id || reason.trim().length < 3} onClick={() => void act(item, true)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 disabled:opacity-40">{busy === item.id ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />} Скрыть от менеджеров</button>
        </div>
      )}
    </li>
  );

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-5" aria-label="Video Identity">
      <div className="flex flex-wrap items-center gap-2">
        <Clapperboard size={16} className="text-amber-200/80" />
        <h2 className="font-serif text-xl text-zinc-100">Video Identity</h2>
        {bundle && <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-zinc-800 px-2.5 py-1 text-[10px] text-zinc-400"><Lock size={11} /> {bundle.consent ? SCOPE_LABEL[bundle.scope] ?? bundle.scope : "Согласие не дано: менеджеры не видят"}</span>}
      </div>
      {state === "loading" && <p className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" /> Загружаем видео…</p>}
      {state === "missing" && <p className="text-xs text-zinc-500">Миграция 20261130090000_resident_video_identity.sql ещё не применена.</p>}
      {state === "error" && <p className="text-xs text-rose-200">Не удалось загрузить видео.</p>}
      {state === "ready" && !intro && moments.length === 0 && <p className="text-xs text-zinc-500">Резидентка пока не добавила видео.</p>}
      {state === "ready" && (intro || moments.length > 0) && (
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>{intro?.src ? <VoyageVideoPlayer src={intro.src} poster={intro.poster} durationMs={intro.durationMs} labels={labels} /> : <div className="flex aspect-[9/16] items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-[11px] text-zinc-600">Визитки нет</div>}</div>
          <div className="min-w-0 space-y-3">
            {moments.length > 0 && <div className="flex flex-wrap gap-2.5">{moments.map((m, i) => <MomentBubble key={m.id} item={m} size={60} label={`Момент ${i + 1}`} onOpen={() => setStory(i)} />)}</div>}
            <ul className="space-y-2">
              {intro && row(intro, "Визитка")}
              {moments.map((m, i) => row(m, `Момент ${i + 1}${m.topic && m.topic in c.topics ? ` · ${c.topics[m.topic as keyof typeof c.topics].label}` : ""}`))}
            </ul>
            {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
            <p className="text-[10.5px] leading-5 text-zinc-600">Просмотр этой карточки записывается в журнал резидентки как «Администрация VOYAGE» и в audit_logs. Скрытие убирает видео у менеджеров сразу; резидентка видит причину.</p>
          </div>
        </div>
      )}
      {story !== null && moments.length > 0 && <MomentStoryViewer items={moments.filter((m) => m.src)} start={story} lang="RU" onClose={() => setStory(null)} />}
    </section>
  );
}
