"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — поля текста на 4 языках + «✨ Автоперевод на все языки»
 * app/(dashboard)/partner/_components/I18nTextFields.tsx
 *
 * Автор пишет на одном языке (source), кнопка переводит остальные три
 * через server action app/actions/casting-translate.ts. Переведённые версии
 * можно поправить руками во вкладках RU / EN / ES / PT.
 * Используется в форме кастинга и в редакторе тура из каталога.
 * ──────────────────────────────────────────────────────────────────── */

import { useId, useState } from "react";
import { Check, Languages, LoaderCircle, Sparkles } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { autoTranslate } from "@/app/actions/casting-translate";
import { CASTING_LANGS, LANG_NAMES, type CastingLang, type I18nText } from "@/lib/casting-i18n";

export type I18nFieldSpec = {
  key: string;
  label: string;
  max: number;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  required?: boolean;
};

type Dict = {
  sourceLang: string;
  original: string;
  translate: string;
  translating: string;
  translated: (langs: string) => string;
  needSource: string;
  notConfigured: string;
  failed: string;
  forbidden: string;
  overwrite: string;
  filled: string;
  empty: string;
  chars: (n: number, max: number) => string;
};

const T: Record<Lang, Dict> = {
  RU: {
    sourceLang: "Язык оригинала",
    original: "оригинал",
    translate: "✨ Автоперевод на все языки",
    translating: "Переводим…",
    translated: (l) => `Готово: ${l}. Проверьте тексты перед публикацией — их можно поправить во вкладках.`,
    needSource: "Сначала заполните текст на языке оригинала.",
    notConfigured: "Автоперевод не подключён: на сервере нет ключа DEEPL_API_KEY или ANTHROPIC_API_KEY. Тексты можно заполнить вручную.",
    failed: "Сервис перевода не ответил. Попробуйте ещё раз или заполните вручную.",
    forbidden: "Автоперевод доступен партнёрам, admin и owner.",
    overwrite: "Переводы на других языках будут заменены. Нажмите ещё раз, чтобы подтвердить.",
    filled: "заполнено",
    empty: "пусто",
    chars: (n, max) => `${n} / ${max}`,
  },
  EN: {
    sourceLang: "Original language",
    original: "original",
    translate: "✨ Auto-translate to all languages",
    translating: "Translating…",
    translated: (l) => `Done: ${l}. Review the texts before publishing — you can edit them in the tabs.`,
    needSource: "Fill in the text in the original language first.",
    notConfigured: "Auto-translation is not connected: the server has no DEEPL_API_KEY or ANTHROPIC_API_KEY. You can fill the texts manually.",
    failed: "The translation service did not respond. Try again or fill in manually.",
    forbidden: "Auto-translation is available to partners, admins and the owner.",
    overwrite: "Existing translations will be replaced. Click again to confirm.",
    filled: "filled",
    empty: "empty",
    chars: (n, max) => `${n} / ${max}`,
  },
  ES: {
    sourceLang: "Idioma original",
    original: "original",
    translate: "✨ Traducir a todos los idiomas",
    translating: "Traduciendo…",
    translated: (l) => `Listo: ${l}. Revisa los textos antes de publicar; puedes editarlos en las pestañas.`,
    needSource: "Primero completa el texto en el idioma original.",
    notConfigured: "La traducción automática no está conectada: falta DEEPL_API_KEY o ANTHROPIC_API_KEY en el servidor. Puedes completar los textos a mano.",
    failed: "El servicio de traducción no respondió. Inténtalo de nuevo o completa a mano.",
    forbidden: "La traducción automática está disponible para socios, admin y owner.",
    overwrite: "Las traducciones existentes se reemplazarán. Pulsa otra vez para confirmar.",
    filled: "completado",
    empty: "vacío",
    chars: (n, max) => `${n} / ${max}`,
  },
  PT: {
    sourceLang: "Idioma original",
    original: "original",
    translate: "✨ Traduzir para todos os idiomas",
    translating: "Traduzindo…",
    translated: (l) => `Pronto: ${l}. Revise os textos antes de publicar — dá para editar nas abas.`,
    needSource: "Primeiro preencha o texto no idioma original.",
    notConfigured: "A tradução automática não está conectada: falta DEEPL_API_KEY ou ANTHROPIC_API_KEY no servidor. Você pode preencher os textos manualmente.",
    failed: "O serviço de tradução não respondeu. Tente de novo ou preencha manualmente.",
    forbidden: "A tradução automática está disponível para parceiros, admin e owner.",
    overwrite: "As traduções existentes serão substituídas. Clique de novo para confirmar.",
    filled: "preenchido",
    empty: "vazio",
    chars: (n, max) => `${n} / ${max}`,
  },
};

const INPUT =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-200/15";

export function I18nTextFields({
  fields,
  values,
  onChange,
  source,
  onSourceChange,
  errors = {},
  disabled = false,
}: {
  fields: I18nFieldSpec[];
  values: Record<string, I18nText>;
  onChange: (next: Record<string, I18nText>) => void;
  source: CastingLang;
  onSourceChange: (lang: CastingLang) => void;
  /** Ошибка поля (показывается под полем на вкладке оригинала) */
  errors?: Record<string, string | undefined>;
  disabled?: boolean;
}) {
  const { lang: uiLang } = useLanguage();
  const t = T[uiLang] ?? T.EN;
  const baseId = useId();
  const [tab, setTab] = useState<CastingLang>(source);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const text = (key: string, lang: CastingLang) => values[key]?.[lang] ?? "";
  const setText = (key: string, lang: CastingLang, value: string) => {
    onChange({ ...values, [key]: { ...(values[key] ?? {}), [lang]: value } });
  };
  const langFilled = (lang: CastingLang) => fields.some((f) => text(f.key, lang).trim() !== "");
  const othersFilled = CASTING_LANGS.some((l) => l !== source && langFilled(l));

  const runTranslate = async () => {
    setNotice(null);
    const payload = Object.fromEntries(fields.map((f) => [f.key, text(f.key, source)]));
    if (Object.values(payload).every((v) => v.trim() === "")) {
      setNotice({ tone: "error", text: t.needSource });
      return;
    }
    if (othersFilled && !confirm) {
      setConfirm(true);
      setNotice({ tone: "error", text: t.overwrite });
      return;
    }
    setConfirm(false);
    setBusy(true);
    try {
      const res = await autoTranslate({ source, fields: payload });
      if (!res.ok) {
        const map = { not_configured: t.notConfigured, forbidden: t.forbidden, invalid: t.needSource, failed: t.failed } as const;
        setNotice({ tone: "error", text: map[res.reason] });
        return;
      }
      const next: Record<string, I18nText> = { ...values };
      for (const f of fields) {
        const translated = res.fields[f.key] ?? {};
        const merged: I18nText = { ...(values[f.key] ?? {}) };
        for (const l of CASTING_LANGS) {
          if (l === source) continue;
          const v = translated[l];
          if (typeof v === "string") merged[l] = v.slice(0, f.max);
        }
        next[f.key] = merged;
      }
      onChange(next);
      setNotice({ tone: "ok", text: t.translated(CASTING_LANGS.filter((l) => l !== source).join(", ")) });
    } catch (error) {
      console.error("[I18nTextFields] translate", error);
      setNotice({ tone: "error", text: t.failed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.sourceLang}</p>
          <div role="radiogroup" aria-label={t.sourceLang} className="flex flex-wrap gap-1.5">
            {CASTING_LANGS.map((l) => {
              const on = l === source;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled || busy}
                  title={LANG_NAMES[l]}
                  onClick={() => {
                    onSourceChange(l);
                    setTab(l);
                    setConfirm(false);
                  }}
                  className={`min-h-9 rounded-full border px-3 font-mono text-xs transition ${
                    on ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void runTranslate()}
          disabled={disabled || busy}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            confirm
              ? "border-amber-300/60 bg-amber-300/20 text-amber-50"
              : "border-amber-200/40 bg-amber-200/10 text-amber-100 hover:bg-amber-200/15"
          }`}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {busy ? t.translating : t.translate}
        </button>
      </div>

      <div role="tablist" aria-label="RU / EN / ES / PT" className="flex flex-wrap gap-1 border-b border-zinc-800/80">
        {CASTING_LANGS.map((l) => {
          const on = l === tab;
          const filled = langFilled(l);
          return (
            <button
              key={l}
              type="button"
              role="tab"
              id={`${baseId}-tab-${l}`}
              aria-selected={on}
              aria-controls={`${baseId}-panel`}
              onClick={() => setTab(l)}
              className={`-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-xs transition ${
                on ? "border-amber-200 text-amber-100" : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="font-mono">{l}</span>
              {l === source && <span className="text-[9px] uppercase tracking-[0.16em] text-amber-200/70">{t.original}</span>}
              <span
                aria-label={filled ? t.filled : t.empty}
                className={`size-1.5 rounded-full ${filled ? "bg-emerald-300" : "bg-zinc-700"}`}
              />
            </button>
          );
        })}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="space-y-4">
        {fields.map((f) => {
          const id = `${baseId}-${f.key}-${tab}`;
          const value = text(f.key, tab);
          const error = tab === source ? errors[f.key] : undefined;
          return (
            <div key={f.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="block text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                  {f.label}
                  {f.required && tab === source ? " *" : ""} · {tab}
                </label>
                <span className="font-mono text-[10px] text-zinc-600">{t.chars(value.length, f.max)}</span>
              </div>
              {f.multiline ? (
                <textarea
                  id={id}
                  rows={f.rows ?? 4}
                  maxLength={f.max}
                  disabled={disabled}
                  lang={tab.toLowerCase()}
                  className={`${INPUT} min-h-28 py-3`}
                  value={value}
                  onChange={(e) => setText(f.key, tab, e.target.value)}
                />
              ) : (
                <input
                  id={id}
                  maxLength={f.max}
                  disabled={disabled}
                  lang={tab.toLowerCase()}
                  className={`${INPUT} min-h-11 sm:min-h-10`}
                  value={value}
                  onChange={(e) => setText(f.key, tab, e.target.value)}
                />
              )}
              {f.hint && <p className="text-[11px] text-zinc-500">{f.hint}</p>}
              {error && (
                <p role="alert" className="text-[11px] text-rose-300">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5 ${
            notice.tone === "error" ? "border-amber-300/25 bg-amber-300/5 text-amber-100" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-100"
          }`}
        >
          {notice.tone === "ok" ? <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Languages className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
          {notice.text}
        </p>
      )}
    </div>
  );
}
