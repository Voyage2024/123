import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPartnerNotificationQueue } from "@/lib/server/telegram/partner-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeSecretEqual(received: string, expected: string): boolean {
  const left = Buffer.from(received, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Endpoint for Supabase Database Webhooks and an optional 30-second queue poller. */
export async function POST(request: Request) {
  const expectedSecret = (process.env.PARTNER_NOTIFICATIONS_WEBHOOK_SECRET ?? "").trim();
  if (!expectedSecret) {
    console.error("[partner-notifications] webhook secret is not configured");
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }

  const receivedSecret = request.headers.get("x-voyage-webhook-secret")
    ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";
  if (!constantTimeSecretEqual(receivedSecret, expectedSecret)) {
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
