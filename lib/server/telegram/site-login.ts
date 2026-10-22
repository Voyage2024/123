import "server-only";

import { InlineKeyboard } from "grammy";
import type { TelegramLang } from "@/lib/server/telegram/types";

/* ──────────────────────────────────────────────────────────────────────
 * Ссылка «куда вводить логин и пароль» под каждым сообщением с доступами.
 * Адрес — NEXT_PUBLIC_SITE_URL || https://voyage-models.com, путь /login.
 * ──────────────────────────────────────────────────────────────────── */

const FALLBACK_SITE = "https://voyage-models.com";

const COPY: Record<TelegramLang, { line: string; button: string }> = {
  RU: { line: "🌐 Вход в личный кабинет:", button: "🔑 Войти на сайт VOYAGE" },
  EN: { line: "🌐 Sign in to your account:", button: "🔑 Sign in to VOYAGE" },
  ES: { line: "🌐 Acceso a tu cuenta personal:", button: "🔑 Entrar en VOYAGE" },
  PT: { line: "🌐 Acesso à sua área pessoal:", button: "🔑 Entrar no VOYAGE" },
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** https://voyage-models.com/login или тот же путь на NEXT_PUBLIC_SITE_URL. */
export function siteLoginUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE).trim();
  try {
    return new URL("/login", base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return `${FALLBACK_SITE}/login`;
  }
}

/**
 * Telegram отклоняет всё сообщение, если в url-кнопке http:// или localhost.
 * Для кнопки берём адрес сайта только когда он публичный https, иначе — боевой домен.
 */
function buttonUrl(): string {
  const url = siteLoginUrl();
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".local");
    if (parsed.protocol === "https:" && !local) return url;
  } catch {
    // ниже — запасной адрес
  }
  return `${FALLBACK_SITE}/login`;
}

/** Строка для HTML-сообщения: «🌐 Вход в личный кабинет: https://…/login». */
export function siteLoginLine(lang: TelegramLang): string {
  return `${COPY[lang].line} ${escapeHtml(siteLoginUrl())}`;
}

/** Inline-кнопка «🔑 Войти на сайт VOYAGE» с адресом страницы входа. */
export function siteLoginKeyboard(lang: TelegramLang): InlineKeyboard {
  return new InlineKeyboard().url(COPY[lang].button, buttonUrl());
}
