"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · галерея анкеты в каталоге (каталог 2.0, этап A)
 * app/components/catalog/CatalogGallery.tsx
 *
 * Фото — основа анкеты: крупное главное фото 3:4, миниатюры, просмотр на
 * весь экран со свайпом и стрелками. На каждом кадре именной водяной знак
 * менеджера (D3). Ссылки на фото приходят с сервера уже подписанными;
 * на этапе C они станут защищёнными копиями с впечатанным знаком.
 *
 * Клавиши в полноэкранном просмотре перехватываются раньше карточки
 * (capture + preventDefault), поэтому Esc закрывает только фото, а
 * стрелки листают фото, а не анкеты.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { WatermarkLayer } from "@/app/components/media/WatermarkLayer";
import { photoFirstCopy } from "@/lib/resident-catalog";

const ROUND_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/55 text-zinc-100 backdrop-blur transition hover:border-[#c9a961]/60 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a961]/60 disabled:pointer-events-none disabled:opacity-30";

const noSave = {
  draggable: false,
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  onDragStart: (e: React.DragEvent) => e.preventDefault(),
};

/**
 * Свайп влево/вправо: порог 40 px, вертикальная прокрутка не мешает.
 * swiped() — был ли последний жест свайпом: клик после свайпа не должен
 * открывать или закрывать просмотр.
 */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = useRef(false);
  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; last.current = false; },
      onPointerUp: (e: React.PointerEvent) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
          last.current = true;
          if (dx < 0) onNext(); else onPrev();
        }
      },
    },
    swiped: () => last.current,
  };
}

export function CatalogGallery({ photos, name, watermark, lang }: {
  photos: string[];
  name: string;
  watermark: string | null;
  lang: string;
}) {
  const pf = photoFirstCopy(lang);
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const count = photos.length;
  const prev = useCallback(() => setIdx((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIdx((i) => (i + 1) % count), [count]);
  const swipe = useSwipe(prev, next);

  useEffect(() => { setIdx(0); setFull(false); }, [photos]);
  if (!count) return null;
  const current = photos[Math.min(idx, count - 1)];

  return (
    <div className="space-y-2" aria-roledescription="gallery">
      <div
        className="relative mx-auto aspect-[3/4] w-full max-w-md touch-pan-y overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900 sm:max-w-none"
        {...swipe.handlers}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={`${name} · ${idx + 1}`} className="h-full w-full select-none object-cover" {...noSave} />
        <WatermarkLayer text={watermark} dense />
        <button type="button" onClick={() => { if (!swipe.swiped()) setFull(true); }} aria-label={pf.galleryOpen} title={pf.galleryOpen}
          className="absolute inset-0 z-[4] cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c9a961]/60" />
        <span className="pointer-events-none absolute right-2 top-2 z-[5] inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-zinc-200">
          <Expand size={10} aria-hidden /> {pf.galleryPos(idx + 1, count)}
        </span>
        {count > 1 && (
          <>
            <button type="button" className={`${ROUND_BTN} absolute left-2 top-1/2 z-[5] -translate-y-1/2`} onClick={prev} aria-label={pf.galleryPrev}><ChevronLeft size={18} aria-hidden /></button>
            <button type="button" className={`${ROUND_BTN} absolute right-2 top-1/2 z-[5] -translate-y-1/2`} onClick={next} aria-label={pf.galleryNext}><ChevronRight size={18} aria-hidden /></button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" role="tablist" aria-label={name}>
          {photos.map((src, i) => (
            <button key={src} type="button" role="tab" aria-selected={i === idx} aria-label={pf.galleryThumb(i + 1)} onClick={() => setIdx(i)}
              className={`relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border transition sm:w-16 ${i === idx ? "border-[#c9a961] ring-1 ring-[#c9a961]/60" : "border-zinc-800 opacity-70 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full select-none object-cover" loading="lazy" {...noSave} />
              <WatermarkLayer text={watermark} />
            </button>
          ))}
        </div>
      )}

      {full && <Lightbox photos={photos} idx={idx} name={name} watermark={watermark} lang={lang} onIdx={setIdx} onClose={() => setFull(false)} />}
    </div>
  );
}

function Lightbox({ photos, idx, name, watermark, lang, onIdx, onClose }: {
  photos: string[]; idx: number; name: string; watermark: string | null; lang: string;
  onIdx: (i: number) => void; onClose: () => void;
}) {
  const pf = photoFirstCopy(lang);
  const count = photos.length;
  const prev = useCallback(() => onIdx((idx - 1 + count) % count), [idx, count, onIdx]);
  const next = useCallback(() => onIdx((idx + 1) % count), [idx, count, onIdx]);
  const swipe = useSwipe(prev, next);
  const closeRef = useRef<HTMLButtonElement>(null);
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // раньше карточки анкеты: Esc закрывает только фото, стрелки листают фото
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowLeft" && count > 1) { e.preventDefault(); e.stopPropagation(); prev(); }
      else if (e.key === "ArrowRight" && count > 1) { e.preventDefault(); e.stopPropagation(); next(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); back?.focus({ preventScroll: true }); };
  }, [onClose, prev, next, count]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/95"
      role="dialog" aria-modal="true" aria-label={`${name} · ${pf.galleryPos(idx + 1, count)}`}
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) onClose(); downOnBackdrop.current = false; }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <span className="font-mono text-xs tabular-nums text-[#c9a961]" aria-live="polite">{pf.galleryPos(idx + 1, count)}</span>
        <button ref={closeRef} type="button" className={ROUND_BTN} onClick={onClose} aria-label={pf.galleryClose} title={pf.galleryClose}><X size={18} aria-hidden /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" {...swipe.handlers}
        onClick={(e) => { if (e.target === e.currentTarget && !swipe.swiped()) onClose(); }}>
        <figure className="relative max-h-full overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[idx]} alt={`${name} · ${idx + 1}`} className="block max-h-[calc(100dvh-7rem)] w-auto max-w-full select-none object-contain" {...noSave} />
          <WatermarkLayer text={watermark} dense />
        </figure>
        {count > 1 && (
          <>
            <button type="button" className={`${ROUND_BTN} absolute left-2 top-1/2 -translate-y-1/2 sm:left-4`} onClick={prev} aria-label={pf.galleryPrev}><ChevronLeft size={20} aria-hidden /></button>
            <button type="button" className={`${ROUND_BTN} absolute right-2 top-1/2 -translate-y-1/2 sm:right-4`} onClick={next} aria-label={pf.galleryNext}><ChevronRight size={20} aria-hidden /></button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default CatalogGallery;
