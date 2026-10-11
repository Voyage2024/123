import { timingSafeEqual } from "node:crypto";
import { webhookCallback } from "grammy";
import { createVoyageTelegramBot } from "@/lib/server/telegram/bot";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Configure the deployment provider's function timeout to at least this value.
export const maxDuration = 60;

const MAX_UPDATE_BYTES = 1024 * 1024;

function secureEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function jsonError(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Telegram calls this Route Handler with HTTPS POST updates; no long polling process is used. */
export async function POST(request: Request): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !webhookSecret) return jsonError(503, "telegram_webhook_not_configured");

  const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secureEqual(suppliedSecret, webhookSecret)) return jsonError(401, "invalid_webhook_secret");

  let payload: unknown;
  try {
    const text = await request.clone().text();
    if (Buffer.byteLength(text, "utf8") > MAX_UPDATE_BYTES) return jsonError(413, "update_too_large");
    payload = JSON.parse(text) as unknown;
  } catch {
    return jsonError(400, "invalid_json");
  }
  if (!payload || typeof payload !== "object" || !("update_id" in payload)) return jsonError(400, "invalid_telegram_update");
  const updateId = (payload as { update_id?: unknown }).update_id;
  if (typeof updateId !== "number" || !Number.isSafeInteger(updateId) || updateId < 0) return jsonError(400, "invalid_update_id");

  const db = getTelegramServiceClient();
  const { data: claim, error: claimError } = await db.rpc("voyage_claim_telegram_webhook_update", { p_update_id: updateId });
  if (claimError) {
    console.error("[telegram-webhook] update claim failed", claimError.code ?? "unknown");
    return jsonError(503, "update_claim_failed");
  }
  if (claim === "done" || claim === "busy") {
    return new Response("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  if (claim !== "claimed") return jsonError(503, "update_claim_unavailable");

  try {
    const bot = createVoyageTelegramBot(token);
    const handler = webhookCallback(bot, "std/http", {
      secretToken: webhookSecret,
      timeoutMilliseconds: 50_000,
      onTimeout: "throw",
    });
    const response = await handler(request);
    const nextStatus = response.ok ? "done" : "failed";
    const { error: finishError } = await db.rpc("voyage_finish_telegram_webhook_update", {
      p_update_id: updateId,
      p_status: nextStatus,
      p_error_code: response.ok ? null : `http_${response.status}`,
    });
    if (finishError) console.error("[telegram-webhook] update receipt finish failed", finishError.code ?? "unknown");
    return response;
  } catch (error) {
    await db.rpc("voyage_finish_telegram_webhook_update", {
      p_update_id: updateId,
      p_status: "failed",
      p_error_code: error instanceof Error ? error.name.slice(0, 80) : "handler_error",
    });
    console.error("[telegram-webhook] request failed", error instanceof Error ? error.name : "unknown");
    return jsonError(500, "telegram_update_failed");
  }
}
