/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · кольцо Video Identity рядом с заполненностью (этап 2)
 * app/components/catalog/VideoIdentityRing.tsx
 *
 * Три сегмента: визитка, хотя бы один Moment, свежесть видео
 * (до 30 дней / 30–90 / старше 90 — решение D2). Без хуков.
 * ──────────────────────────────────────────────────────────────────── */

import { catalogCopy, type Freshness } from "@/lib/resident-catalog";

export type VideoRingSummary = { hasIntro: boolean; hasMoment: boolean; latestAt: string | null };

export function freshnessOf(latestAt: string | null, now = Date.now()): Freshness {
  if (!latestAt) return "none";
  const t = Date.parse(latestAt);
  if (Number.isNaN(t)) return "none";
  const days = (now - t) / 86_400_000;
  return days <= 30 ? "fresh" : days <= 90 ? "aging" : "stale";
}

const FRESH_FILL: Record<Freshness, number> = { fresh: 1, aging: 0.6, stale: 0.25, none: 0 };

export default function VideoIdentityRing({ summary, lang }: { summary: VideoRingSummary | null; lang: string }) {
  const c = catalogCopy(lang);
  const fresh = freshnessOf(summary?.latestAt ?? null);
  const parts = [
    { key: "intro", label: c.ringIntro, fill: summary?.hasIntro ? 1 : 0, color: "#c9a961" },
    { key: "moments", label: c.ringMoments, fill: summary?.hasMoment ? 1 : 0, color: "#e9d6a0" },
    { key: "fresh", label: `${c.ringFresh}: ${c.freshness[fresh]}`, fill: FRESH_FILL[fresh], color: fresh === "fresh" ? "#6ee7b7" : fresh === "aging" ? "#fcd34d" : "#a1a1aa" },
  ];
  const R = 15;
  const C = 2 * Math.PI * R;
  const seg = C / 3;
  const gap = 3;

  return (
    <a
      href="#video-identity"
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition hover:border-[#c9a961]/40"
      aria-label={`${c.ringTitle}: ${parts.map((p) => p.label).join(", ")}`}
    >
      <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden>
        {parts.map((p, i) => (
          <g key={p.key}>
            <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"
              strokeDasharray={`${seg - gap} ${C - seg + gap}`} strokeDashoffset={-i * seg} />
            {p.fill > 0 && (
              <circle cx="20" cy="20" r={R} fill="none" stroke={p.color} strokeWidth="4" strokeLinecap="butt"
                strokeDasharray={`${(seg - gap) * p.fill} ${C - (seg - gap) * p.fill}`} strokeDashoffset={-i * seg} />
            )}
          </g>
        ))}
      </svg>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.ringTitle}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-400">
          <span className={summary?.hasIntro ? "text-amber-100" : ""}>{summary?.hasIntro ? "✓" : "○"} {c.ringIntro}</span>
          <span className={summary?.hasMoment ? "text-amber-100" : ""}>{summary?.hasMoment ? "✓" : "○"} {c.ringMoments}</span>
          <span>{c.freshness[fresh]}</span>
        </span>
      </span>
    </a>
  );
}
