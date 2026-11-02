import "server-only";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · автоперевод текстов (кастинги, туры)
 * lib/server/translate.ts
 *
 * Провайдер выбирается переменными окружения (только сервер, без NEXT_PUBLIC_):
 *
 *   TRANSLATE_PROVIDER = deepl | anthropic   — необязательно; если не задан,
 *                                              берётся тот, чей ключ есть
 *   DEEPL_API_KEY       — ключ DeepL API (Free-ключ оканчивается на ":fx")
 *   DEEPL_PT_VARIANT    — PT-BR (по умолчанию) или PT-PT
 *   ANTHROPIC_API_KEY   — ключ Claude API
 *   ANTHROPIC_TRANSLATE_MODEL — модель, по умолчанию claude-haiku-5-5
 *
 * Ключ никогда не уходит в браузер: перевод вызывается только из server action
 * app/actions/casting-translate.ts.
 * ──────────────────────────────────────────────────────────────────── */

import type { CastingLang } from "@/lib/casting-i18n";

export type TranslateProvider = "deepl" | "anthropic";

export class TranslateNotConfiguredError extends Error {
  constructor() {
    super("Auto-translation is not configured: set DEEPL_API_KEY or ANTHROPIC_API_KEY.");
    this.name = "TranslateNotConfiguredError";
  }
}

export class TranslateFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslateFailedError";
  }
}

export function activeTranslateProvider(): TranslateProvider | null {
  const forced = (process.env.TRANSLATE_PROVIDER ?? "").trim().toLowerCase();
  const deepl = (process.env.DEEPL_API_KEY ?? "").trim();
  const anthropic = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (forced === "deepl") return deepl ? "deepl" : null;
  if (forced === "anthropic") return anthropic ? "anthropic" : null;
  if (deepl) return "deepl";
  if (anthropic) return "anthropic";
  return null;
}

const TIMEOUT_MS = 25_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new TranslateFailedError(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof TranslateFailedError) throw error;
    throw new TranslateFailedError(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}

/* ── DeepL ─────────────────────────────────────────────────────────── */

function deeplTarget(lang: CastingLang): string {
  if (lang === "EN") return "EN-US";
  if (lang === "PT") return (process.env.DEEPL_PT_VARIANT ?? "PT-BR").trim().toUpperCase() === "PT-PT" ? "PT-PT" : "PT-BR";
  return lang;
}

async function deeplTranslate(texts: string[], from: CastingLang, to: CastingLang): Promise<string[]> {
  const key = (process.env.DEEPL_API_KEY ?? "").trim();
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const data = await postJson(
    `${host}/v2/translate`,
    { Authorization: `DeepL-Auth-Key ${key}` },
    { text: texts, source_lang: from, target_lang: deeplTarget(to), preserve_formatting: true },
  );
  const list = (data as { translations?: { text?: unknown }[] })?.translations;
  if (!Array.isArray(list) || list.length !== texts.length) throw new TranslateFailedError("DeepL: unexpected response");
  return list.map((t) => (typeof t.text === "string" ? t.text : ""));
}

/* ── Claude API ────────────────────────────────────────────────────── */

const LANG_LABEL: Record<CastingLang, string> = {
  RU: "Russian",
  EN: "English",
  ES: "Spanish",
  PT: "Portuguese (Brazil)",
};

async function anthropicTranslate(
  fields: Record<string, string>,
  from: CastingLang,
  targets: CastingLang[],
): Promise<Record<CastingLang, Record<string, string>>> {
  const key = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  const model = (process.env.ANTHROPIC_TRANSLATE_MODEL ?? "claude-haiku-5-5").trim();
  const system =
    "You translate short texts for VOYAGE, a private travel club for models and hostesses. " +
    "Translate faithfully, keep the tone polite and premium, keep line breaks, Markdown, numbers, " +
    "currencies, dates, brand names (VOYAGE, Official Club) and city names as they are customary in the target language. " +
    "Do not add or remove information. Reply with JSON only, no comments.";
  const prompt =
    `Source language: ${LANG_LABEL[from]}.\n` +
    `Target languages: ${targets.map((l) => `${l} = ${LANG_LABEL[l]}`).join(", ")}.\n` +
    `Return a JSON object whose keys are the target language codes (${targets.join(", ")}), ` +
    `each value an object with exactly the same keys as the input.\n\nInput:\n${JSON.stringify(fields)}`;
  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    { model, max_tokens: 8000, system, messages: [{ role: "user", content: prompt }] },
  );
  const blocks = (data as { content?: { type?: string; text?: unknown }[] })?.content ?? [];
  const text = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text as string).join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new TranslateFailedError("Claude: no JSON in response");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new TranslateFailedError("Claude: invalid JSON in response");
  }
  const out = {} as Record<CastingLang, Record<string, string>>;
  for (const lang of targets) {
    const block = (parsed as Record<string, unknown>)?.[lang];
    const row: Record<string, string> = {};
    for (const field of Object.keys(fields)) {
      const v = block && typeof block === "object" ? (block as Record<string, unknown>)[field] : undefined;
      row[field] = typeof v === "string" ? v : "";
    }
    out[lang] = row;
  }
  return out;
}

/**
 * Переводит набор полей { title, brief, … } с языка from на языки targets.
 * Пустые поля не переводятся (в ответе — пустая строка).
 */
export async function translateFields(
  fields: Record<string, string>,
  from: CastingLang,
  targets: CastingLang[],
): Promise<{ provider: TranslateProvider; result: Record<CastingLang, Record<string, string>> }> {
  const provider = activeTranslateProvider();
  if (!provider) throw new TranslateNotConfiguredError();

  const keys = Object.keys(fields).filter((k) => fields[k].trim() !== "");
  const langs = targets.filter((l) => l !== from);
  const result = {} as Record<CastingLang, Record<string, string>>;
  for (const lang of langs) result[lang] = Object.fromEntries(Object.keys(fields).map((k) => [k, ""]));
  if (keys.length === 0 || langs.length === 0) return { provider, result };

  if (provider === "deepl") {
    const texts = keys.map((k) => fields[k]);
    await Promise.all(
      langs.map(async (lang) => {
        const translated = await deeplTranslate(texts, from, lang);
        keys.forEach((k, i) => {
          result[lang][k] = translated[i] ?? "";
        });
      }),
    );
    return { provider, result };
  }

  const subset = Object.fromEntries(keys.map((k) => [k, fields[k]]));
  const translated = await anthropicTranslate(subset, from, langs);
  for (const lang of langs) {
    for (const k of keys) result[lang][k] = translated[lang]?.[k] ?? "";
  }
  return { provider, result };
}
