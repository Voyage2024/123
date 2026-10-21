import "server-only";

import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

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
    "code", "pre", "kbd", "span", "div", "details", "summary", "iframe",
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
    "*": ["class", "id"],
  },
  // Свои оформительские классы — только с префиксом guide- (см. guide-prose.css)
  allowedClasses: { "*": ["guide-*"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"], source: ["https", "http"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: IFRAME_HOSTS,
  // iframe с чужого хоста остаётся без src — такой убираем целиком
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
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
  },
};

export type RenderedGuide = {
  html: string;
  /** Первая картинка статьи — для og:image */
  firstImage: string | null;
};

export function renderGuideContent(source: string | null | undefined): RenderedGuide {
  const text = (source ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return { html: "", firstImage: null };

  const raw = marked.parse(text) as string;
  const clean = sanitizeHtml(raw, SANITIZE)
    .replace(/<table(\s[^>]*)?>/g, '<div class="guide-table"><table$1>')
    .replace(/<\/table>/g, "</table></div>");

  const firstImage = /<img[^>]+src="(https?:\/\/[^"]+)"/i.exec(clean)?.[1] ?? null;
  return { html: clean, firstImage: firstImage ? firstImage.replace(/&amp;/g, "&") : null };
}
