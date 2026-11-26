"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity глазами менеджера (кастинг / тур)
 * app/components/media/ResidentVideoViewer.tsx
 *
 * Загружает видео через getResidentMediaForViewer: право решает база
 * (voyage_media_access). Нет права, нет согласия, видео скрыто или его
 * нет — показывается одна спокойная строка, без подробностей.
 * Открытие анкеты отмечается в «Кто смотрел» (recordResidentProfileView).
 * Этап 2: контекст catalog — анкету отмечает сама RPC карточки каталога,
 * поэтому recordView там выключен; watermark — именной знак менеджера.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { getResidentMediaForViewer, recordResidentProfileView } from "@/app/actions/resident-media-view";
import { formatDuration, mediaCopy, type MediaBundle } from "@/lib/resident-media";
import { VoyageVideoPlayer } from "@/app/components/media/VoyageVideoPlayer";
import { MomentBubble } from "@/app/components/media/MomentBubble";
import { MomentStoryViewer } from "@/app/components/media/MomentStoryViewer";

export function ResidentVideoViewer({
  residentId,
  context,
  contextId,
  lang,
  title,
  recordView = true,
  watermark = null,
}: {
  residentId: string;
  context: "casting" | "tour" | "catalog";
  contextId: string | null;
  lang: string;
  title?: string | null;
  recordView?: boolean;
  watermark?: string | null;
}) {
  const c = mediaCopy(lang);
  const [state, setState] = useState<{ key: string; bundle: MediaBundle | null } | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const key = `${residentId}:${context}:${contextId ?? ""}`;

  useEffect(() => {
    let alive = true;
    setStory(null);
    if (recordView && context !== "catalog") void recordResidentProfileView(residentId, context, contextId);
    void getResidentMediaForViewer(residentId, context, contextId).then((res) => {
      if (alive) setState({ key, bundle: res.ok ? res.bundle : null });
    });
    return () => { alive = false; };
  }, [context, contextId, key, recordView, residentId]);

  const loading = !state || state.key !== key;
  const bundle = loading ? null : state.bundle;
  const intro = bundle?.items.find((i) => i.kind === "intro" && i.src && i.status === "active") ?? null;
  const moments = bundle?.items.filter((i) => i.kind === "moment" && i.src && i.status === "active") ?? [];
  const labels = { play: c.play, pause: c.pause, mute: c.mute, unmute: c.unmute, fullscreen: c.fullscreen, watermark: c.watermark };

  return (
    <div className="rounded-2xl border border-[#c9a961]/15 bg-black/25 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        <Clapperboard size={11} className="text-[#c9a961]" /> Video Identity
        {bundle?.latestAt && <span className="ml-auto normal-case tracking-normal text-emerald-200/80">{c.freshness(new Date(bundle.latestAt).toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-PT" : "en-GB", { day: "numeric", month: "short" }))}</span>}
      </p>
      {loading ? (
        <p className="flex items-center gap-2 py-3 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" /> {c.loading}</p>
      ) : !intro && moments.length === 0 ? (
        <p className="py-2 text-xs text-zinc-600">{c.noVideo}</p>
      ) : (
        <div className="space-y-3">
          {intro?.src && (
            <div>
              <p className="mb-1.5 text-[10px] text-zinc-500">{c.intro} · {formatDuration(intro.durationMs)}</p>
              <VoyageVideoPlayer src={intro.src} poster={intro.poster} durationMs={intro.durationMs} labels={labels} watermark={watermark} className="mx-auto max-w-[280px]" />
            </div>
          )}
          {moments.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] text-zinc-500">{c.moments} · {moments.length}</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {moments.map((m, i) => <MomentBubble key={m.id} item={m} size={60} label={`${c.moments} ${i + 1}`} onOpen={() => setStory(i)} />)}
              </div>
            </div>
          )}
        </div>
      )}
      {story !== null && moments.length > 0 && <MomentStoryViewer items={moments} start={story} lang={lang} title={title} watermark={watermark} onClose={() => setStory(null)} />}
    </div>
  );
}

export default ResidentVideoViewer;
