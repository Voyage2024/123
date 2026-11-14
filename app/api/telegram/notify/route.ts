import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPartnerNotificationQueue } from "@/lib/server/telegram/partner-notifications";
import { logSecurityEvent, requestIp } from "@/lib/server/security-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeSecretEqual(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  // Сравниваем SHA-256: одинаковая длина буферов, длина секрета не утекает по времени.
  const left = createHash("sha256").update(received, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

/**
 * Endpoint for the partner_notifications webhook (pg_net trigger, secret from Vault)
 * and an optional 30-second queue poller.
 *
 * Secret: PARTNER_NOTIFICATIONS_WEBHOOK_SECRET. Accepted headers, in order:
 *   x-webhook-secret            — trigger (migration 20261022092000) and the poller
 *   Authorization: Bearer <secret>
 * The legacy x-voyage-webhook-secret header is no longer accepted: its old value
 * leaked in a DB dump (security-hardening, 2026-11-09).
 */
export async function POST(request: Request) {
  const expectedSecret = (process.env.PARTNER_NOTIFICATIONS_WEBHOOK_SECRET ?? "").trim();
  if (!expectedSecret) {
    console.error("[partner-notifications] webhook secret is not configured");
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }

  const receivedSecret = (
    request.headers.get("x-webhook-secret")
    ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? ""
  ).trim();
  if (!constantTimeSecretEqual(receivedSecret, expectedSecret)) {
    const ip = requestIp(request);
    await logSecurityEvent("webhook.bad_secret", null, {
      endpoint: "/api/telegram/notify",
      ip,
      legacy_header: request.headers.has("x-voyage-webhook-secret"),
    }, { dedupeKey: `webhook.bad_secret:telegram-notify:${ip}` });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    // A scheduled ping may use an empty or minimal JSON body. Secret validation still applies.
  }

  const table = typeof body.table === "string" ? body.table : "";
  const schema = typeof body.schema === "string" ? body.schema : "";
  const eventType = typeof body.type === "string" ? body.type.toUpperCase() : "";
  const isSchedulerPing = body.source === "scheduler" || body.mode === "poll";

  if (!isSchedulerPing && ((table && table !== "partner_notifications") || (schema && schema !== "public") || (eventType && eventType !== "INSERT"))) {
    return NextResponse.json({ ok: true, ignored: true, reason: "unrelated_event" });
  }

  const insertedRecord = body.record && typeof body.record === "object" && !Array.isArray(body.record)
    ? body.record as Record<string, unknown>
    : null;
  // Служебные строки (skipped / opted_out / sent) сайт не будят, даже если
  // старый вебхук без условия ещё не удалён.
  if (!isSchedulerPing && insertedRecord && typeof insertedRecord.status === "string" && insertedRecord.status !== "queued") {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_queued" });
  }

  try {
    // On INSERT, only queued rows are attempted. Scheduled polling also retries failed
    // rows with attempts < 3. No intermediate status or new queue table is used.
    const recordValue = body.record && typeof body.record === "object" && !Array.isArray(body.record)
      ? body.record as Record<string, unknown>
      : null;
    const notificationId = typeof recordValue?.id === "string" || typeof recordValue?.id === "number"
      ? String(recordValue.id)
      : undefined;
    const summary = await processPartnerNotificationQueue({
      includeFailed: isSchedulerPing,
      notificationId,
      limit: 25,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[partner-notifications] queue processing failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Queue processing failed" }, { status: 500 });
  }
}
