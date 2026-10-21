"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · интерактивный чек-лист в гайде («Проверка готовности»)
 *
 * Данные приходят с сервера (lib/server/guide-content.ts): группы и
 * пункты, inline-HTML пунктов уже очищен. Здесь только поведение:
 *   • клик по строке ставит/снимает круглую галочку;
 *   • состояние хранится в localStorage по slug гайда и номеру
 *     чек-листа на странице — можно обновить страницу и продолжить;
 *   • «Сбросить» снимает все галочки и стирает сохранённое;
 *   • «Скопировать список» кладёт в буфер текст с ✅ / ⬜ по группам —
 *     удобно вставить в «Избранное» Telegram или в Заметки.
 * Подписи — на языке гайда.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCopy, RotateCcw, Sparkles } from "lucide-react";
import type { GuideChecklistData, GuideLanguage } from "@/lib/guides";

const SERIF = "var(--font-cormorant), Georgia, serif";

const copy: Record<GuideLanguage, {
  title: string;
  of: string;
  reset: string;
  copy: string;
  copied: string;
  copyFailed: string;
  done: string;
  ready: string;
}> = {
  ru: {
    title: "Проверка готовности",
    of: "из",
    reset: "Сбросить",
    copy: "Скопировать список",
    copied: "Скопировано в буфер ✓",
    copyFailed: "Не удалось скопировать",
    done: "Всё готово. Хорошего полёта!",
    ready: "Готово",
  },
  en: {
    title: "Readiness check",
    of: "of",
    reset: "Reset",
    copy: "Copy the list",
    copied: "Copied to clipboard ✓",
    copyFailed: "Could not copy",
    done: "All set. Have a great flight!",
    ready: "Done",
  },
  es: {
    title: "Lista de preparación",
    of: "de",
    reset: "Restablecer",
    copy: "Copiar la lista",
    copied: "Copiado al portapapeles ✓",
    copyFailed: "No se pudo copiar",
    done: "Todo listo. ¡Buen vuelo!",
    ready: "Listo",
  },
  pt: {
    title: "Checklist de preparação",
    of: "de",
    reset: "Limpar",
    copy: "Copiar a lista",
    copied: "Copiado para a área de transferência ✓",
    copyFailed: "Não foi possível copiar",
    done: "Tudo pronto. Boa viagem!",
    ready: "Pronto",
  },
};

type Props = {
  data: GuideChecklistData;
  language: GuideLanguage;
  /** Ключ сохранения, например "chemodan-v-tur:0". Без него состояние не сохраняется (предпросмотр в админке) */
  storageKey?: string | null;
  /** Заголовок гайда — первой строкой в скопированном тексте */
  guideTitle?: string | null;
};

const STORAGE_PREFIX = "voyage-guide-checklist:";

function readSaved(key: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : null;
  } catch {
    return null;
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ниже — запасной способ для старых браузеров и http */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function GuideChecklist({ data, language, storageKey = null, guideTitle = null }: Props) {
  const t = copy[language] ?? copy.ru;
  const allIds = useMemo(() => data.groups.flatMap((g) => g.items.map((i) => i.id)), [data]);
  const defaults = useMemo(
    () => new Set(data.groups.flatMap((g) => g.items.filter((i) => i.checked).map((i) => i.id))),
    [data],
  );

  // Первый рендер — как на сервере (отметки из разметки), сохранённое подтягиваем после монтирования
  const [checked, setChecked] = useState<Set<string>>(defaults);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const saved = readSaved(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore saved progress after hydration.
    if (saved) setChecked(new Set([...saved].filter((id) => allIds.includes(id))));
  }, [storageKey, allIds]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const persist = useCallback(
    (next: Set<string>) => {
      if (!storageKey) return;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify([...next]));
      } catch {
        /* приватный режим — просто не сохраняем */
      }
    },
    [storageKey],
  );

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
      return next;
    });
  };

  const reset = () => {
    setChecked(new Set());
    if (!storageKey) return;
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + storageKey);
    } catch {
      /* игнорируем */
    }
  };

  const total = allIds.length;
  const done = allIds.filter((id) => checked.has(id)).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  const title = data.title || t.title;

  const copyList = async () => {
    const lines: string[] = [];
    if (guideTitle) lines.push(guideTitle);
    lines.push(`${title} — ${done} ${t.of} ${total}`);
    for (const group of data.groups) {
      lines.push("");
      if (group.title) lines.push(group.title);
      for (const item of group.items) lines.push(`${checked.has(item.id) ? "✅" : "⬜"} ${item.text}`);
    }
    const ok = await writeClipboard(lines.join("\n"));
    setCopyState(ok ? "copied" : "failed");
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <section
      className="relative my-12 overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-900/50 backdrop-blur-xl shadow-[0_24px_100px_-56px_rgba(201,169,97,0.4)]"
      aria-label={title}
    >
      <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#c9a961]/[0.07]" aria-hidden />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c9a961]/10 blur-3xl" aria-hidden />

      {/* Шапка: заголовок, счётчик, прогресс */}
      <header className="relative px-6 pt-7 sm:px-9 sm:pt-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-2xl font-light leading-tight text-zinc-50 sm:text-3xl" style={{ fontFamily: SERIF }}>
            {title}
          </h3>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold tabular-nums tracking-wider transition-colors duration-500 ${
              complete ? "border-[#c9a961] bg-[#c9a961] text-zinc-950" : "border-[#c9a961]/30 bg-[#c9a961]/[0.06] text-[#c9a961]"
            }`}
            aria-live="polite"
          >
            {done} {t.of} {total}
          </span>
        </div>
        <div
          className="mt-5 h-[3px] w-full overflow-hidden rounded-full bg-zinc-800/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label={`${t.ready}: ${done} ${t.of} ${total}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#a8884a] via-[#c9a961] to-[#e8d5a3] shadow-[0_0_12px_rgba(201,169,97,0.6)] transition-[width] duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      {/* Группы */}
      <div className="relative px-4 pb-2 pt-4 sm:px-7">
        {data.groups.map((group, gi) => (
          <div key={`${group.title ?? "g"}-${gi}`} className={gi > 0 ? "mt-2 border-t border-zinc-800/70 pt-5" : "pt-1"}>
            {group.title && (
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c9a961]">{group.title}</p>
            )}
            <ul className="space-y-0.5 pb-3">
              {group.items.map((item) => {
                const on = checked.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(item.id)}
                      className="group/row flex w-full items-start gap-3.5 rounded-xl px-2 py-2.5 text-left transition-colors duration-200 hover:bg-white/[0.025] focus-visible:bg-white/[0.03] focus-visible:outline-none"
                    >
                      <span
                        className={`mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                          on
                            ? "scale-100 border-[#c9a961] bg-[#c9a961] text-zinc-950 shadow-[0_0_14px_rgba(201,169,97,0.45)]"
                            : "border-zinc-600 text-transparent group-hover/row:border-[#c9a961]/60"
                        }`}
                        aria-hidden
                      >
                        <Check size={13} strokeWidth={3} className={`transition-transform duration-300 ${on ? "scale-100" : "scale-0"}`} />
                      </span>
                      <span
                        className={`text-[15px] leading-6 transition-colors duration-300 [&_a]:text-[#c9a961] [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold ${
                          on ? "text-zinc-500 line-through decoration-[#c9a961]/40" : "text-zinc-200"
                        }`}
                        dangerouslySetInnerHTML={{ __html: item.html }}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {complete && (
        <p className="relative mx-6 mb-1 flex items-center justify-center gap-2 text-center text-sm text-[#c9a961] sm:mx-9" style={{ fontFamily: SERIF }}>
          <Sparkles size={15} strokeWidth={1.5} /> <span className="text-lg">{t.done}</span>
        </p>
      )}

      {/* Кнопки */}
      <footer className="relative grid grid-cols-1 gap-3 px-6 pb-7 pt-4 sm:grid-cols-2 sm:px-9 sm:pb-8">
        <button
          type="button"
          onClick={reset}
          disabled={done === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 bg-black/20 px-6 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-300 transition-colors duration-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40"
        >
          <RotateCcw size={14} strokeWidth={1.75} />
          {t.reset}
        </button>
        <button
          type="button"
          onClick={() => void copyList()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c9a961] px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-950 shadow-[0_0_24px_rgba(201,169,97,0.15)] transition duration-300 hover:bg-[#d6b877] hover:shadow-[0_0_34px_rgba(201,169,97,0.25)]"
          aria-live="polite"
        >
          {copyState === "copied" ? <Check size={14} strokeWidth={2.5} /> : <ClipboardCopy size={14} strokeWidth={1.75} />}
          {copyState === "copied" ? t.copied : copyState === "failed" ? t.copyFailed : t.copy}
        </button>
      </footer>
    </section>
  );
}
