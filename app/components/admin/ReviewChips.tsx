/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · бейджи очереди проверки — app/components/admin/ReviewChips.tsx
 * «Ожидает KYC 1», «Ожидает KYC 2», «Запрос KYC 3» (amber-200).
 * Без хуков — работает и в серверных страницах, и в клиентских.
 * ──────────────────────────────────────────────────────────────────── */

import { ConciergeBell, FileText, PlaySquare, type LucideIcon } from "lucide-react";
import { hasPendingReview, reviewCopy, type ReviewFlags } from "@/lib/admin-review";

/**
 * Яркие бейджи «Ожидает KYC 1», «Ожидает KYC 2», «Запрос KYC 3» —
 * что именно ждёт решения у этой резидентки.
 */
export function ReviewChips({ flags, lang, className = "" }: { flags: ReviewFlags | null | undefined; lang: string; className?: string }) {
  if (!hasPendingReview(flags)) return null;
  const c = reviewCopy(lang);
  const items: Array<{ key: string; label: string; Icon: LucideIcon }> = [];
  if (flags.kyc1) items.push({ key: "kyc1", label: c.kyc1, Icon: FileText });
  if (flags.kyc2) items.push({ key: "kyc2", label: c.kyc2, Icon: PlaySquare });
  if (flags.kyc3) items.push({ key: "kyc3", label: c.kyc3, Icon: ConciergeBell });
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map(({ key, label, Icon }) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200/60 bg-amber-200/[0.14] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.18)]"
        >
          <Icon size={11} strokeWidth={2} aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
}

