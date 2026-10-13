/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — действия, которые уходят в Telegram
 * app/(dashboard)/partner/_lib/actions.ts
 *
 * Сайт ничего не отправляет в Telegram сам: RPC кладёт строку в очередь
 * public.partner_notifications, бот её отправляет (см. миграцию
 * 20261012090000_partner_deal_room.sql, раздел «Для Telegram-бота»).
 *
 *   notifyTour    напоминание о документах / подписи (не чаще раза в 6 ч)
 *   sendContract  новая версия условий + подпись менеджера + запрос подписи
 *
 * Ответ одинаковый: сколько ушло в очередь, кому не дошло (нет Telegram),
 * скольким уже недавно напоминали. В демо-режиме — имитация с задержкой.
 * ──────────────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase";
import { arr, num, obj, str, termsToDb, type ContractTerms } from "./command";
import { DATA_SOURCE } from "./routes";

export type NotifyTemplate = "docs_reminder" | "contract_reminder";

export type NotifyResult = {
  /** Ушло в очередь Telegram */
  queued: number;
  /** Кому не отправить — Telegram не подключён */
  missing: string[];
  /** Уже напоминали за последние 6 часов */
  throttled: number;
  /** Для sendContract — номер новой версии */
  version?: number;
};

export type ActionFailure = "forbidden" | "invalid" | "locked" | "network" | "unknown";

export class ActionError extends Error {
  constructor(
    public reason: ActionFailure,
    message: string,
  ) {
    super(message);
  }
}

const MOCK_DELAY_MS = 900;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toError(error: { code?: string; message: string }): ActionError {
  const code = error.code ?? "";
  if (code === "42501") return new ActionError("forbidden", error.message);
  if (code === "23514" || code === "22023") return new ActionError("invalid", error.message);
  if (error.message.includes("tour_locked")) return new ActionError("locked", error.message);
  if (!code) return new ActionError("network", error.message);
  return new ActionError("unknown", error.message);
}

function parseResult(raw: unknown): NotifyResult {
  const r = obj(raw);
  return {
    queued: num(r.queued) ?? 0,
    missing: arr(r.missing).flatMap((x) => (str(x) ? [x as string] : [])),
    throttled: num(r.throttled) ?? 0,
    version: num(r.version) ?? undefined,
  };
}

/**
 * Напомнить участницам тура в Telegram.
 * @param recipients только эти участницы (id профилей); без него — все, кому нужно
 * @param mock       что вернуть в демо-режиме
 */
export async function notifyTour(
  tourId: string,
  template: NotifyTemplate,
  recipients?: string[],
  mock: NotifyResult = { queued: 1, missing: [], throttled: 0 },
): Promise<NotifyResult> {
  if (DATA_SOURCE === "mock") {
    await sleep(MOCK_DELAY_MS);
    return mock;
  }
  const { data, error } = await supabase.rpc("partner_notify", {
    p_tour: tourId,
    p_template: template,
    p_recipients: recipients ?? null,
  });
  if (error) throw toError(error);
  return parseResult(data);
}

/** Отправить условия на подпись: новая версия, подпись менеджера, запрос в Telegram */
export async function sendContract(
  tourId: string,
  terms: ContractTerms,
  mock: NotifyResult = { queued: 1, missing: [], throttled: 0, version: 1 },
): Promise<NotifyResult & { version: number }> {
  if (DATA_SOURCE === "mock") {
    await sleep(MOCK_DELAY_MS);
    return { ...mock, version: mock.version ?? 1 };
  }
  const { data, error } = await supabase.rpc("partner_contract_send", {
    p_tour: tourId,
    p_terms: termsToDb(terms),
  });
  if (error) throw toError(error);
  const res = parseResult(data);
  return { ...res, version: res.version ?? 1 };
}
