/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · кольцо «Живость анкеты» рядом с заполненностью
 * app/components/catalog/VideoIdentityRing.tsx
 *
 * Этап 2: кольцо Video Identity (визитка, Moment, свежесть видео).
 * Каталог 2.0, этап A (D3): кольцо по желанию и НЕ влияет на процент
 * заполненности — 100% достижимы с одними фото. Пустые сегменты не
 * подаются как недостаток: подпись приглашает, а не упрекает.
 * Сегменты сейчас: визитка и Moment; Live Snap добавится на этапе B.
 * Имя файла прежнее, чтобы не трогать импорты. Без хуков.
 * ──────────────────────────────────────────────────────────────────── */

import { photoFirstCopy, type Freshness } from "@/lib/resident-catalog";

export type VideoRingSummary = { hasIntro: boolean; hasMoment: boolean; latestAt: string | null };

export function freshnessOf(latestAt: string | null, now = Date.now()): Freshness {
  if (!latestAt) return "none";
  const t = Date.parse(latestAt);
  if (Number.isNaN(t)) return "none";
  const days = (now - t) / 86_400_000;
  return days <= 30 ? "fresh" : days <= 90 ? "aging" : "stale";
}

export default function VideoIdentityRing({ summary, lang }: { summary: VideoRingSummary | null; lang: string }) {
  const pf = photoFirstCopy(lang);
  const parts = [
    { key: "intro", label: pf.ringIntro, on: !!summary?.hasIntro, color: "#c9a961" },
    { key: "moment", label: pf.ringMoment, on: !!summary?.hasMoment, color: "#e9d6a0" },
  ];
  const done = parts.filter((p) => p.on);
  const R = 15;
  const C = 2 * Math.PI * R;
  const seg = C / parts.length;
  const gap = 3;

  return (
    <a
      href="#video-identity"
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition hover:border-[#c9a961]/40"
      aria-label={`${pf.ringTitle}: ${done.length ? done.map((p) => p.label).join(", ") : pf.ringAdd}. ${pf.ringNote}`}
    >
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
        {parts.map((p, i) => (
          <g key={p.key}>
            <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"
              strokeDasharray={`${seg - gap} ${C - seg + gap}`} strokeDashoffset={-i * seg} />
            {p.on && (
              <circle cx="20" cy="20" r={R} fill="none" stroke={p.color} strokeWidth="4"
                strokeDasharray={`${seg - gap} ${C - seg + gap}`} strokeDashoffset={-i * seg} />
            )}
          </g>
        ))}
      </svg>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500">{pf.ringTitle}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-400">
          {done.length ? (
            done.map((p) => <span key={p.key} className="text-amber-100">✓ {p.label}</span>)
          ) : (
            <span className="text-zinc-300 underline-offset-4 group-hover:underline">{pf.ringAdd}</span>
          )}
        </span>
        <span className="mt-0.5 block text-[10px] leading-4 text-zinc-600">{pf.ringNote}</span>
      </span>
    </a>
  );
}
