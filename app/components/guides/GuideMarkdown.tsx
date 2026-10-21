import type { ReactNode } from "react";

/* ──────────────────────────────────────────────────────────────────────
 * Мини-рендер markdown для текста гайдов (public.guides.content).
 *
 * Поддерживает то, что нужно для статьи: заголовки #/##/###, абзацы,
 * списки (- * и 1.), цитаты >, разделитель ---, **жирный**, *курсив*,
 * `код` и [ссылки](https://…). Всё собирается в React-элементы, HTML из
 * базы не вставляется, поэтому XSS через текст гайда невозможен.
 * Работает и в серверных, и в клиентских компонентах (без хуков).
 * ──────────────────────────────────────────────────────────────────── */

const SERIF = "var(--font-cormorant), Georgia, serif";

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "hr" };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isBlank = (line: string) => !line.trim();
  const listMatch = (line: string) => /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(line);

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: heading[2].replace(/\s#+\s*$/, "") });
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }

    const first = listMatch(line);
    if (first) {
      const ordered = Boolean(first[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = listMatch(lines[i]);
        if (m && Boolean(m[2]) === ordered) {
          items.push(m[3]);
          i++;
        } else if (!isBlank(lines[i]) && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ` ${lines[i].trim()}`; // перенос строки внутри пункта
          i++;
        } else break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i].trim()) &&
      !/^\s*>/.test(lines[i]) &&
      !listMatch(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(trimmed)) return trimmed;
  return null;
}

const INLINE = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let n = 0;

  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    const key = `${keyPrefix}-${n++}`;

    if (match[2] ?? match[3]) {
      nodes.push(
        <strong key={key} className="font-semibold text-zinc-100">
          {renderInline(match[2] ?? match[3], key)}
        </strong>,
      );
    } else if (match[4]) {
      nodes.push(
        <code key={key} className="rounded-md border border-zinc-800 bg-zinc-900/70 px-1.5 py-0.5 text-[0.9em] text-amber-100/90">
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      const href = safeHref(match[6]);
      const external = href ? /^https?:\/\//i.test(href) : false;
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="text-[#c9a961] underline decoration-[#c9a961]/40 underline-offset-4 transition-colors hover:text-amber-100 hover:decoration-amber-100/60"
          >
            {renderInline(match[5], key)}
          </a>
        ) : (
          <span key={key}>{match[5]}</span>
        ),
      );
    } else if (match[7] ?? match[8]) {
      nodes.push(
        <em key={key} className="italic text-zinc-200">
          {renderInline(match[7] ?? match[8], key)}
        </em>,
      );
    }

    last = at + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderLines(lines: string[], key: string): ReactNode[] {
  return lines.flatMap((line, idx) => [
    ...(idx > 0 ? [<br key={`${key}-br-${idx}`} />] : []),
    ...renderInline(line, `${key}-${idx}`),
  ]);
}

export default function GuideMarkdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <div className="space-y-6 text-[17px] leading-8 text-zinc-300 font-light">
      {blocks.map((block, idx) => {
        const key = `b${idx}`;
        switch (block.type) {
          case "heading": {
            if (block.level === 1) {
              return (
                <h2 key={key} className="pt-6 text-3xl md:text-4xl font-light leading-tight text-zinc-50" style={{ fontFamily: SERIF }}>
                  {renderInline(block.text, key)}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3 key={key} className="pt-4 text-2xl md:text-3xl font-light leading-snug text-zinc-50" style={{ fontFamily: SERIF }}>
                  {renderInline(block.text, key)}
                </h3>
              );
            }
            return (
              <h4 key={key} className="pt-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#c9a961]">
                {renderInline(block.text, key)}
              </h4>
            );
          }
          case "hr":
            return (
              <div key={key} className="flex items-center justify-center gap-3 py-4" aria-hidden>
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-[#c9a961]/40" />
                <span className="h-1.5 w-1.5 rotate-45 bg-[#c9a961]/60" />
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-[#c9a961]/40" />
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="rounded-r-2xl border-l-2 border-[#c9a961]/60 bg-[#c9a961]/[0.04] py-4 pl-6 pr-5 text-xl leading-relaxed text-zinc-200"
                style={{ fontFamily: SERIF }}
              >
                {renderLines(block.lines, key)}
              </blockquote>
            );
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={key} className="space-y-3">
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`} className="flex gap-4">
                    {block.ordered ? (
                      <span className="mt-0.5 min-w-6 text-xl leading-7 text-[#c9a961]" style={{ fontFamily: SERIF }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    ) : (
                      <span className="mt-[0.8rem] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#c9a961]/70" aria-hidden />
                    )}
                    <span>{renderInline(item, `${key}-${i}`)}</span>
                  </li>
                ))}
              </Tag>
            );
          }
          default:
            return <p key={key}>{renderLines(block.lines, key)}</p>;
        }
      })}
    </div>
  );
}
