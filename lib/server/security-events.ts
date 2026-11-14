import "server-only";

import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

/* ──────────────────────────────────────────────────────────────────────
 * Запись в public.security_events с сервера (service_role).
 * warning/critical сами уходят в рабочий Telegram-чат: триггер БД →
 * /api/security/notify → notifyAdminsOfSecurityEvent.
 * Ошибки логирования никогда не ломают основное действие.
 * ──────────────────────────────────────────────────────────────────── */

export type SecuritySeverity = "info" | "warning" | "critical";

const DEFAULT_SEVERITY: Record<string, SecuritySeverity> = {
  "password.reset_telegram": "warning",
  "webhook.bad_secret": "warning",
};

export async function logSecurityEvent(
  kind: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
  options: { severity?: SecuritySeverity; dedupeKey?: string } = {},
): Promise<void> {
  try {
    const { error } = await getTelegramServiceClient().rpc("voyage_log_security_event", {
      p_kind: kind,
      p_severity: options.severity ?? DEFAULT_SEVERITY[kind] ?? "info",
      p_target: targetId,
      p_details: details,
      p_dedupe_key: options.dedupeKey ?? null,
    });
    if (error) console.error("[security-events] log failed", { kind, code: error.code ?? "unknown" });
  } catch (error) {
    console.error("[security-events] log threw", { kind, name: error instanceof Error ? error.name : "unknown" });
  }
}

/** IP клиента за прокси Vercel — только для дедупликации, без хранения в открытом виде дольше события. */
export function requestIp(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
