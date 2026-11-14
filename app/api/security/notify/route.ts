import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { notifyAdminsOfSecurityEvent } from "@/lib/server/telegram/admin-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ──────────────────────────────────────────────────────────────────────
 * Webhook журнала безопасности (миграция 20261109090000).
 *
 * Триггер security_events_webhook (pg_net) шлёт сюда { record: { id } }
 * с заголовком x-webhook-secret = PARTNER_NOTIFICATIONS_WEBHOOK_SECRET
 * (тот же секрет Vault, что у уведомлений партнёров). Само событие
 * читаем из БД по id — содержимому запроса не доверяем.
 * Неверный секрет здесь не логируем в security_events, чтобы перебор
 * не порождал новые вызовы этого же webhook.
 * ──────────────────────────────────────────────────────────────────── */

function secretEqual(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  const left = createHash("sha256").update(received, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = (process.env.PARTNER_NOTIFICATIONS_WEBHOOK_SECRET ?? "").trim();
  if (!expected) return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  const received = (request.headers.get("x-webhook-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "").trim();
  if (!secretEqual(received, expected)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let id: number | null = null;
  try {
    const body = (await request.json()) as { table?: unknown; record?: { id?: unknown } } | null;
    if (body?.table && body.table !== "security_events") return NextResponse.json({ ok: true, ignored: true });
    const raw = body?.record?.id;
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isSafeInteger(parsed) && parsed > 0) id = parsed;
  } catch {
    // пустое тело — ниже ответим 400
  }
  if (!id) return NextResponse.json({ ok: false, error: "Missing event id" }, { status: 400 });

  const { data: event, error } = await getTelegramServiceClient()
    .from("security_events")
    .select("id,created_at,kind,severity,actor_id,target_id,details")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[security-notify] event lookup failed", error.code ?? "unknown");
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
  if (!event) return NextResponse.json({ ok: true, ignored: true, reason: "not_found" });

  await notifyAdminsOfSecurityEvent({
    id: Number(event.id),
    createdAt: String(event.created_at),
    kind: String(event.kind),
    severity: event.severity === "critical" || event.severity === "warning" ? event.severity : "info",
    actorId: event.actor_id ? String(event.actor_id) : null,
    targetId: event.target_id ? String(event.target_id) : null,
    details: event.details && typeof event.details === "object" && !Array.isArray(event.details) ? (event.details as Record<string, unknown>) : {},
  });
  return NextResponse.json({ ok: true });
}
