import "server-only";

import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type {
  GuideChecklistData,
  GuideChecklistGroup,
  GuideContentSegment,
} from "@/lib/guides";

/* ──────────────────────────────────────────────────────────────────────
 * Текст гайда → безопасный HTML (только на сервере)
 *
 *   1. marked (GFM): Markdown, таблицы |a|b|, ~~зачёркнутый~~, переносы.
 *      HTML внутри текста marked пропускает как есть…
 *   2. …а sanitize-html оставляет только разрешённые теги и атрибуты:
 *      никаких <script>, on*-обработчиков, style и javascript:-ссылок.
 *   3. Таблицы оборачиваются в прокручиваемый контейнер, картинки
 *      получают lazy-загрузку, # в тексте становится <h2> (h1 у страницы
 *      один — заголовок гайда).
 *   4. Чек-листы — блок <div class="guide-checklist" data-title="…"> с
 *      ### группами и пунктами «- [ ]» / «- [x]», а также любые подряд
 *      идущие «- [ ]» вне блока — вынимаются из текста ДО рендера и
 *      отдаются данными: страница рисует их интерактивным компонентом
 *      GuideChecklist (галочки, прогресс, localStorage, копирование).
 *
 * Используется страницей /guides/[slug] и предпросмотром в админке.
 * ──────────────────────────────────────────────────────────────────── */

const marked = new Marked({ gfm: true, breaks: true, async: false });

const IFRAME_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"];

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
    "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup", "abbr",
    "blockquote", "ul", "ol", "li", "dl", "dt", "dd",
    "a", "img", "figure", "figcaption", "picture", "source",
    "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td",
    "code", "pre", "kbd", "span", "div", "details", "summary", "iframe", "input",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
    source: ["srcset", "type", "media"],
    th: ["colspan", "rowspan", "scope", "align"],
    td: ["colspan", "rowspan", "align"],
    col: ["span"],
    ol: ["start", "reversed"],
    abbr: ["title"],
    iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "loading"],
    // статичные чекбоксы задач (если чек-лист оказался там, где его нельзя оживить, например в таблице)
    input: ["type", "checked", "disabled"],
    div: ["class", "id", "data-title"],
    "*": ["class", "id"],
  },
  // Свои оформительские классы — только с префиксом guide- (см. guide-prose.css)
  allowedClasses: { "*": ["guide-*"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"], source: ["https", "http"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: IFRAME_HOSTS,
  // iframe с чужого хоста остаётся без src — такой убираем целиком
  // input — только чекбокс задачи, и только «для чтения»
  exclusiveFilter: (frame) =>
    (frame.tag === "iframe" && !frame.attribs.src) || (frame.tag === "input" && frame.attribs.type !== "checkbox"),
  transformTags: {
    h1: "h2",
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs,
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy", decoding: "async", alt: attribs.alt ?? "" },
    }),
    iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    input: (tagName, attribs) => ({ tagName, attribs: { ...attribs, type: "checkbox", disabled: "" } }),
  },
};

// Внутри пункта чек-листа — только строчная разметка
const SANITIZE_INLINE: sanitizeHtml.IOptions = {
  allowedTags: ["strong", "b", "em", "i", "u", "s", "del", "mark", "code", "a", "br", "small"],
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  transformTags: { a: SANITIZE.transformTags!.a },
};

export type RenderedGuide = {
  /** Текст по порядку: HTML-куски и чек-листы */
  segments: GuideContentSegment[];
  /** Есть ли что показывать */
  hasContent: boolean;
  /** Первая картинка статьи — для og:image */
  firstImage: string | null;
};

const TASK_LINE = /^\s{0,3}[-*+]\s+\[([ xX])\]\s+(.+)$/;
const PLAIN_ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.+)$/;
const CHECKLIST_OPEN = /^\s*<div\s+class=(["'])guide-checklist\1([^>]*)>\s*$/i;
const CHECKLIST_CLOSE = /^\s*<\/div>\s*$/i;
const FENCE = /^\s{0,3}(```|~~~)/;
const GROUP_HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

const decode = (value: string) =>
  value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Короткий стабильный id пункта по тексту: правка соседних пунктов не сбивает галочки */
function itemId(group: string | null, text: string, seen: Map<string, number>): string {
  let h = 5381;
  const key = `${group ?? ""}\u0000${text}`;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  const base = (h >>> 0).toString(36);
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n > 1 ? `${base}-${n}` : base;
}

function renderInlineText(md: string): { html: string; text: string } {
  const html = sanitizeHtml(marked.parseInline(md) as string, SANITIZE_INLINE);
  const text = decode(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, " ").trim();
  return { html, text };
}

function parseChecklist(lines: string[], title: string | null): GuideChecklistData | null {
  const groups: GuideChecklistGroup[] = [];
  const seen = new Map<string, number>();
  let current: GuideChecklistGroup | null = null;

  for (const line of lines) {
    // группа — «### Заголовок» или строка целиком жирным «**Заголовок**»
    const heading = GROUP_HEADING.exec(line) ?? /^\s*\*\*([^*]+)\*\*\s*:?\s*$/.exec(line);
    if (heading) {
      current = { title: renderInlineText(heading[1]).text || null, items: [] };
      groups.push(current);
      continue;
    }
    // внутри блока пунктом считается и «- [ ] …», и простое «- …»
    const task = TASK_LINE.exec(line);
    const plain = task ? null : PLAIN_ITEM.exec(line);
    const body = task?.[2] ?? plain?.[1];
    if (!body) continue; // прочий текст внутри блока игнорируем
    if (!current) {
      current = { title: null, items: [] };
      groups.push(current);
    }
    const { html, text } = renderInlineText(body);
    if (!text) continue;
    current.items.push({ id: itemId(current.title, text, seen), html, text, checked: task?.[1].toLowerCase() === "x" });
  }

  const filled = groups.filter((g) => g.items.length);
  return filled.length ? { title, groups: filled } : null;
}

function renderMarkdown(text: string): string {
  if (!text.trim()) return "";
  const raw = marked.parse(text) as string;
  return sanitizeHtml(raw, SANITIZE)
    .replace(/<table(\s[^>]*)?>/g, '<div class="guide-table"><table$1>')
    .replace(/<\/table>/g, "</table></div>");
}

export function renderGuideContent(source: string | null | undefined): RenderedGuide {
  const lines = (source ?? "").replace(/\r\n/g, "\n").split("\n");
  const segments: GuideContentSegment[] = [];
  let buffer: string[] = [];
  let inFence = false;

  const flush = () => {
    const html = renderMarkdown(buffer.join("\n"));
    if (html.trim()) segments.push({ type: "html", html });
    buffer = [];
  };
  const pushChecklist = (data: GuideChecklistData | null, fallback: string[]) => {
    if (!data) {
      buffer.push(...fallback);
      return;
    }
    flush();
    segments.push({ type: "checklist", data });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) {
      buffer.push(line);
      continue;
    }

    // Блок <div class="guide-checklist" data-title="…"> … </div>
    const open = CHECKLIST_OPEN.exec(line);
    if (open) {
      const end = lines.findIndex((l, j) => j > i && CHECKLIST_CLOSE.test(l));
      if (end !== -1) {
        const titleAttr = /data-title=(["'])(.*?)\1/i.exec(open[2])?.[2];
        const body = lines.slice(i + 1, end);
        pushChecklist(parseChecklist(body, titleAttr ? decode(titleAttr).trim() || null : null), lines.slice(i, end + 1));
        i = end;
        continue;
      }
    }

    // Обычные задачи «- [ ]» подряд (пустые строки между ними допустимы)
    if (TASK_LINE.test(line)) {
      let end = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (TASK_LINE.test(lines[j])) end = j;
        else if (lines[j].trim()) break;
      }
      const block = lines.slice(i, end + 1);
      pushChecklist(parseChecklist(block.filter((l) => TASK_LINE.test(l)), null), block);
      i = end;
      continue;
    }

    buffer.push(line);
  }
  flush();

  const firstHtml = segments.map((s) => (s.type === "html" ? s.html : "")).join("");
  const firstImage = /<img[^>]+src="(https?:\/\/[^"]+)"/i.exec(firstHtml)?.[1] ?? null;
  return {
    segments,
    hasContent: segments.length > 0,
    firstImage: firstImage ? firstImage.replace(/&amp;/g, "&") : null,
  };
}
