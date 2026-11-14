import "server-only";

import { Api } from "grammy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

/* ──────────────────────────────────────────────────────────────────────
 * Автоудаление сообщений с паролем (security-hardening + Этап 1).
 *
 * protect_content и кнопка «Удалить» остаются; дополнительно сервер сам
 * стирает сообщение через TELEGRAM_CREDENTIAL_TTL_MINUTES (по умолчанию
 * 30 мин, от 5 до 2880 — бот может удалять свои сообщения до 48 часов).
 *
 * Очередь — public.telegram_message_purge (только service role). Чистка
 * запускается опросом /api/telegram/notify (source=scheduler) и
 * попутно после действий в кабинетах ОС туров.
 * ──────────────────────────────────────────────────────────────────── */

export function credentialTtlMinutes(): number {
  const raw = Number(process.env.TELEGRAM_CREDENTIAL_TTL_MINUTES ?? 30);
  return Number.isFinite(raw) ? Math.min(2880, Math.max(5, Math.round(raw))) : 30;
}

/** Запомнить сообщение для удаления. Ошибка не мешает доставке. */
export async function scheduleMessagePurge(chatId: string | number, messageId: number, minutes = credentialTtlMinutes()): Promise<void> {
  try {
    const chat = String(chatId);
    if (!/^-?[0-9]{4,20}$/.test(chat) || !Number.isSafeInteger(messageId)) return;
    const { error } = await getTelegramServiceClient()
      .from("telegram_message_purge")
      .upsert(
        { chat_id: chat, message_id: messageId, delete_after: new Date(Date.now() + minutes * 60_000).toISOString(), status: "pending" },
        { onConflict: "chat_id,message_id" },
      );
    if (error) console.error("[telegram-purge] schedule failed", error.code ?? "unknown");
  } catch (error) {
    console.error("[telegram-purge] schedule threw", error instanceof Error ? error.name : "unknown");
  }
}

/** Удалить просроченные сообщения. Возвращает число удалённых. */
export async function purgeExpiredTelegramMessages(limit = 25): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return 0;
  const db = getTelegramServiceClient();
  const { data, error } = await db
    .from("telegram_message_purge")
    .select("id,chat_id,message_id,attempts")
    .eq("status", "pending")
    .lte("delete_after", new Date().toISOString())
    .order("delete_after", { ascending: true })
    .limit(limit);
  if (error || !data?.length) return 0;

  const api = new Api(token);
  let removed = 0;
  for (const row of data) {
    let status: "done" | "failed" | "pending" = "done";
    try {
      await api.deleteMessage(Number(row.chat_id), Number(row.message_id));
      removed += 1;
    } catch (sendError) {
      const code = sendError && typeof sendError === "object" && "error_code" in sendError ? Number((sendError as { error_code: unknown }).error_code) : 0;
      // 400 — уже удалено пользователем или старше 48 часов: считаем закрытым
      status = code === 400 ? "done" : Number(row.attempts ?? 0) >= 4 ? "failed" : "pending";
    }
    await db
      .from("telegram_message_purge")
      .update({ status, attempts: Number(row.attempts ?? 0) + 1, done_at: status === "pending" ? null : new Date().toISOString() })
      .eq("id", row.id);
  }
  return removed;
}
