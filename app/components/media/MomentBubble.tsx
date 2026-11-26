"use client";

import { Play, EyeOff } from "lucide-react";
import { formatDuration, type MediaItem } from "@/lib/resident-media";

/** Кружок Moment: обложка, длительность, метка «скрыто». */
export function MomentBubble({
  item,
  label,
  size = 72,
  onOpen,
  dimmed = false,
}: {
  item: MediaItem;
  label: string;
  size?: number;
  onOpen: () => void;
  dimmed?: boolean;
}) {
  const hidden = item.status === "hidden_by_staff";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      style={{ width: size, height: size }}
      className={`group relative shrink-0 overflow-hidden rounded-full border p-[2px] transition hover:scale-[1.04] ${hidden ? "border-rose-400/40" : "border-[#c9a961]/60"} ${dimmed ? "opacity-60" : ""}`}
    >
      <span className="block h-full w-full overflow-hidden rounded-full bg-zinc-900">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- подписанная ссылка на 10 минут
          <img src={item.poster} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950" />
        )}
      </span>
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20 opacity-0 transition group-hover:opacity-100">
        <Play size={16} className="text-white" fill="currentColor" />
      </span>
      {hidden && <span className="absolute right-1 top-1 rounded-full bg-rose-500/90 p-0.5 text-white"><EyeOff size={10} /></span>}
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-1.5 font-mono text-[9px] text-white/80">{formatDuration(item.durationMs)}</span>
    </button>
  );
}
