import "@/app/components/guides/guide-prose.css";
import GuideChecklist from "@/app/components/guides/GuideChecklist";
import type { GuideContentSegment, GuideLanguage } from "@/lib/guides";

/* ──────────────────────────────────────────────────────────────────────
 * Вывод текста гайда. На вход — сегменты из renderGuideContent
 * (lib/server/guide-content.ts): HTML уже очищен на сервере, чек-листы
 * пришли данными и рисуются интерактивным GuideChecklist.
 * Оформление HTML — guide-prose.css. Одинаково на сайте и в предпросмотре.
 * ──────────────────────────────────────────────────────────────────── */

type Props = {
  segments: GuideContentSegment[];
  language: GuideLanguage;
  /** slug гайда — ключ сохранения галочек; null — не сохранять (предпросмотр) */
  slug?: string | null;
  guideTitle?: string | null;
  className?: string;
};

export default function GuideContent({ segments, language, slug = null, guideTitle = null, className = "" }: Props) {
  let checklistIndex = 0;
  return (
    <div className={className}>
      {segments.map((segment, i) => {
        if (segment.type === "checklist") {
          const n = checklistIndex++;
          return (
            <GuideChecklist
              key={`c${i}`}
              data={segment.data}
              language={language}
              storageKey={slug ? `${slug}:${n}` : null}
              guideTitle={guideTitle}
            />
          );
        }
        return <div key={`h${i}`} className="guide-prose" dangerouslySetInnerHTML={{ __html: segment.html }} />;
      })}
    </div>
  );
}
