/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Бейдж уровня KYC
 * app/components/profile/KycLevelBadge.tsx
 *
 * Четыре сегмента-«ступени» + подпись. Без хуков — работает и в серверных
 * компонентах. Тон:
 *   need (по умолчанию) — нейтральное требование кастинга;
 *   ok                  — у резидентки уровень есть (зелёный);
 *   miss                — не хватает (янтарный, без тревожного красного);
 *   own                 — уровень самой модели (золото на KYC 3).
 * ──────────────────────────────────────────────────────────────────── */

import { ShieldCheck } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { kycCopy, toKycLevel } from "@/lib/kyc-levels";

export type KycBadgeTone = "need" | "ok" | "miss" | "own";

const TONE: Record<KycBadgeTone, { box: string; on: string; off: string }> = {
  need: { box: "border-zinc-700/80 bg-zinc-900/70 text-zinc-200", on: "bg-zinc-200/80", off: "bg-zinc-700" },
  ok: { box: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100", on: "bg-emerald-300", off: "bg-emerald-300/20" },
  miss: { box: "border-amber-300/35 bg-amber-300/[0.08] text-amber-100", on: "bg-amber-200", off: "bg-amber-200/20" },
  own: { box: "border-amber-200/30 bg-amber-200/10 text-amber-100", on: "bg-amber-200", off: "bg-zinc-700" },
};

export function KycSteps({ level, tone = "need" }: { level: number; tone?: KycBadgeTone }) {
  const lvl = toKycLevel(level);
  const c = TONE[tone];
  return (
    <span aria-hidden className="inline-flex items-end gap-[2px]">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-[3px] rounded-full ${i <= lvl ? c.on : c.off}`} style={{ height: `${4 + i * 2}px` }} />
      ))}
    </span>
  );
}

export default function KycLevelBadge({
  level,
  lang,
  tone = "need",
  withName = true,
  title,
  className = "",
}: {
  level: number;
  lang: Lang;
  tone?: KycBadgeTone;
  /** Показывать название уровня («Видео-подтверждение») */
  withName?: boolean;
  /** Всплывающая подсказка; по умолчанию — описание уровня для резидентки */
  title?: string;
  className?: string;
}) {
  const t = kycCopy(lang);
  const lvl = toKycLevel(level);
  const c = TONE[tone];
  return (
    <span
      title={title ?? t.levels[lvl].resident}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-medium tracking-wide ${c.box} ${className}`}
    >
      {lvl === 3 ? <ShieldCheck className="size-3" strokeWidth={1.75} aria-hidden /> : <KycSteps level={lvl} tone={tone} />}
      <span>{t.label(lvl)}</span>
      {withName && <span className="font-normal opacity-75">· {t.levels[lvl].name}</span>}
    </span>
  );
}
