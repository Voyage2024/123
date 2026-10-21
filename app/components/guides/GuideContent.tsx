import "@/app/components/guides/guide-prose.css";

/* ──────────────────────────────────────────────────────────────────────
 * Вывод текста гайда. На вход — HTML, уже очищенный на сервере
 * (lib/server/guide-content.ts → renderGuideContent). Оформление —
 * guide-prose.css: Cormorant в заголовках, золото #c9a961, таблицы,
 * картинки, цитаты. Один и тот же вид на сайте и в предпросмотре админки.
 * ──────────────────────────────────────────────────────────────────── */

export default function GuideContent({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`guide-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
