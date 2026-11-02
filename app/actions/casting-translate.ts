"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · «✨ Автоперевод на все языки» для брифов кастинга и туров
 * app/actions/casting-translate.ts
 *
 * Вызывают менеджер (партнёр), admin и owner. Ключ провайдера живёт
 * только на сервере — см. lib/server/translate.ts.
 * ──────────────────────────────────────────────────────────────────── */

import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import {
  TranslateNotConfiguredError,
  translateFields,
  type TranslateProvider,
} from "@/lib/server/translate";
import { CASTING_LANGS, isCastingLang, type CastingLang, type I18nText } from "@/lib/casting-i18n";

export type AutoTranslateResult =
  | { ok: true; provider: TranslateProvider; fields: Record<string, I18nText> }
  | { ok: false; reason: "forbidden" | "invalid" | "not_configured" | "failed" };

const MAX_FIELDS = 6;
const MAX_FIELD_LENGTH = 4000;
const FIELD_KEY = /^[a-z][a-z_]{0,30}$/;

/**
 * fields — { title: "…", brief: "…" } на языке source.
 * Ответ — { title: { RU, EN, ES, PT }, brief: { … } }: язык source остаётся как
 * был введён, остальные — переведены. Пустое поле остаётся пустым.
 */
export async function autoTranslate(input: {
  source: string;
  fields: Record<string, string>;
  targets?: string[];
}): Promise<AutoTranslateResult> {
  try {
    await requireRole(["manager", "admin", "owner"]);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }

  if (!input || typeof input !== "object" || !isCastingLang(input.source)) return { ok: false, reason: "invalid" };
  const source: CastingLang = input.source;
  const raw = input.fields && typeof input.fields === "object" ? input.fields : {};
  const keys = Object.keys(raw);
  if (keys.length === 0 || keys.length > MAX_FIELDS) return { ok: false, reason: "invalid" };

  const fields: Record<string, string> = {};
  for (const key of keys) {
    const value = raw[key];
    if (!FIELD_KEY.test(key) || typeof value !== "string" || value.length > MAX_FIELD_LENGTH) {
      return { ok: false, reason: "invalid" };
    }
    fields[key] = value;
  }
  if (Object.values(fields).every((v) => v.trim() === "")) return { ok: false, reason: "invalid" };

  const targets = (Array.isArray(input.targets) ? input.targets : [...CASTING_LANGS])
    .filter(isCastingLang)
    .filter((l) => l !== source);
  if (targets.length === 0) return { ok: false, reason: "invalid" };

  try {
    const { provider, result } = await translateFields(fields, source, targets);
    const out: Record<string, I18nText> = {};
    for (const key of keys) {
      const entry: I18nText = { [source]: fields[key] };
      for (const lang of targets) entry[lang] = result[lang]?.[key] ?? "";
      out[key] = entry;
    }
    return { ok: true, provider, fields: out };
  } catch (error) {
    if (error instanceof TranslateNotConfiguredError) return { ok: false, reason: "not_configured" };
    console.error("[autoTranslate]", error instanceof Error ? error.message : error);
    return { ok: false, reason: "failed" };
  }
}
