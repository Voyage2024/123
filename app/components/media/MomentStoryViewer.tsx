"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · просмотр Moments в стиле stories
 * app/components/media/MomentStoryViewer.tsx
 *
 * Полоски прогресса сверху, тап по правой/левой половине — дальше/назад,
 * удержание — пауза, ← → и Esc на клавиатуре. Кружок в центре, как его
 * записали. Автопереход к следующему моменту по окончании.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { mediaCopy, type MediaItem, type MomentTopic } from "@/lib/resident-media";
import { WatermarkLayer } from "@/app/components/media/WatermarkLayer";

export function MomentStoryViewer({
  items,
  start,
  lang,
  title,
  onClose,
  watermark = null,
}: {
  items: MediaItem[];
  start: number;
  lang: string;
  title?: string | null;
  onClose: () => void;
  /** Каталог (этап 2): именной водяной знак менеджера. */
  watermark?: string | null;
}) {
  const c = mediaCopy(lang);
  const [index, setIndex] = useState(Math.max(0, Math.min(start, items.length - 1)));
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const item = items[index] ?? null;

  const go = useCallback((delta: number) => {
    setProgress(0);
    setIndex((i) => {
      const next = i + delta;
      if (next >= items.length) { onClose(); return i; }
      return Math.max(0, next);
    });
  }, [items.length, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    // iPhone не даёт автозапуск со звуком без жеста: пробуем со звуком, иначе без.
    v.muted = muted;
    void v.play().catch(() => { v.muted = true; setMuted(true); void v.play().catch(() => undefined); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- перезапуск только при смене момента
  }, [index]);

  const onPointerDown = () => {
    held.current = false;
    holdTimer.current = setTimeout(() => { held.current = true; ref.current?.pause(); }, 220);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (held.current) { void ref.current?.play().catch(() => undefined); held.current = false; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
  };

  if (!item) return null;
  const topic = item.topic && item.topic in c.topics ? c.topics[item.topic as MomentTopic].label : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={c.moments} onContextMenu={(e) => e.preventDefault()}>
      <div className="mx-auto flex w-full max-w-md gap-1 px-4 pt-4">
        {items.map((it, i) => (
          <span key={it.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full rounded-full bg-[#c9a961]" style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-3 text-xs text-zinc-300">
        <span className="min-w-0 truncate">
          {title && <span className="font-medium text-zinc-100">{title}</span>}
          {topic && <span className="ml-2 rounded-full border border-[#c9a961]/30 px-2 py-0.5 text-[10px] text-amber-100">{topic}</span>}
          <span className="ml-2 text-zinc-500">{new Date(item.recordedAt).toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-PT" : "en-GB", { day: "numeric", month: "short" })}</span>
        </span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => { const v = ref.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} aria-label={muted ? c.unmute : c.mute} className="rounded-full p-2 hover:bg-white/10">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button type="button" onClick={onClose} aria-label={c.close} className="rounded-full p-2 hover:bg-white/10"><X size={18} /></button>
        </span>
      </div>

      <div className="relative flex flex-1 select-none items-center justify-center px-4" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="relative aspect-square w-[min(86vw,440px)] overflow-hidden rounded-full border border-amber-200/25 bg-zinc-950 shadow-[0_0_80px_rgba(201,169,97,0.15)]">
          {item.src ? (
            <video
              key={item.id}
              ref={ref}
              src={item.src}
              poster={item.poster ?? undefined}
              playsInline
              preload="auto"
              controlsList="nodownload"
              disablePictureInPicture
              className="h-full w-full object-cover"
              onTimeUpdate={(e) => { const v = e.currentTarget; const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : item.durationMs / 1000; setProgress(d ? Math.min(1, v.currentTime / d) : 0); }}
              onEnded={() => go(1)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">{c.failed}</div>
          )}
          <span aria-hidden className="pointer-events-none absolute bottom-[12%] left-1/2 -translate-x-1/2 select-none text-[9px] font-semibold uppercase tracking-[0.3em] text-white/30">{c.watermark}</span>
          <WatermarkLayer text={watermark} />
        </div>
      </div>
      <p className="pb-5 text-center text-[10px] text-zinc-600">{index + 1} / {items.length}</p>
    </div>
  );
}
