"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · премиальный видеоплеер
 * app/components/media/VoyageVideoPlayer.tsx
 *
 * Свои контролы (play, прогресс, звук, полный экран), playsInline для
 * iPhone Safari, без кнопки скачивания и «картинки в картинке», без
 * контекстного меню. Водяной знак «VOYAGE · private» поверх видео.
 * Полностью защитить видео от записи экрана нельзя — это сдерживание,
 * а не DRM; главная защита — короткие подписанные ссылки и журнал.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { formatDuration } from "@/lib/resident-media";

type Labels = { play: string; pause: string; mute: string; unmute: string; fullscreen: string; watermark: string };

export function VoyageVideoPlayer({
  src,
  poster,
  labels,
  durationMs,
  className = "",
  autoPlay = false,
  loop = false,
  onEnded,
  aspect = "aspect-[9/16]",
}: {
  src: string;
  poster?: string | null;
  labels: Labels;
  durationMs?: number;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  aspect?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState((durationMs ?? 0) / 1000);
  const [chrome, setChrome] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 2200);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
    poke();
  }, [poke]);

  const toggleMute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    poke();
  };

  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const el = wrap.current;
    if (!v || !el) return;
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.(); // iPhone Safari
  };

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = ref.current;
    if (!v || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur));
    poke();
  };

  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;

  return (
    <div
      ref={wrap}
      className={`group relative overflow-hidden rounded-2xl border border-amber-200/15 bg-black ${aspect} ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={poke}
    >
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        className="h-full w-full object-cover"
        onClick={toggle}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={() => { setPlaying(false); setChrome(true); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d); }}
        onEnded={() => { setPlaying(false); setChrome(true); onEnded?.(); }}
      />

      <span aria-hidden className="pointer-events-none absolute left-3 top-3 select-none text-[9px] font-semibold uppercase tracking-[0.3em] text-white/35 mix-blend-overlay">
        {labels.watermark}
      </span>

      {!playing && (
        <button type="button" onClick={toggle} aria-label={labels.play} className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/40 bg-black/45 text-amber-100 shadow-[0_0_30px_rgba(201,169,97,0.25)] backdrop-blur transition group-hover:scale-105">
            <Play size={22} className="translate-x-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-300 ${chrome || !playing ? "opacity-100" : "opacity-0"}`}>
        <div role="slider" aria-label="progress" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(time)} tabIndex={0} onPointerDown={seek} className="relative h-4 cursor-pointer touch-none py-1.5">
          <div className="h-1 rounded-full bg-white/15">
            <div className="h-1 rounded-full bg-gradient-to-r from-[#c9a961] to-amber-100" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-white/85">
          <button type="button" onClick={toggle} aria-label={playing ? labels.pause : labels.play} className="rounded-full p-1.5 hover:bg-white/10">
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <span className="font-mono text-[10px] text-white/60">{formatDuration(time * 1000)} / {formatDuration(dur * 1000)}</span>
          <span className="flex-1" />
          <button type="button" onClick={toggleMute} aria-label={muted ? labels.unmute : labels.mute} className="rounded-full p-1.5 hover:bg-white/10">
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button type="button" onClick={fullscreen} aria-label={labels.fullscreen} className="rounded-full p-1.5 hover:bg-white/10">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
