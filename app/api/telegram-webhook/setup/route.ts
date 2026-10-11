import { timingSafeEqual } from "node:crypto";
import { Api } from "grammy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secureEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** One-time setup endpoint. Protect it with a different secret from the webhook secret. */
export async function POST(request: Request): Promise<Response> {
  const setupSecret = process.env.TELEGRAM_WEBHOOK_SETUP_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");

  if (!setupSecret || !token || !webhookSecret || !siteUrl) {
    return Response.json({ ok: false, error: "telegram_setup_not_configured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secureEqual(supplied, setupSecret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return Response.json({ ok: false, error: "invalid_site_url" }, { status: 500 });
  }
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "webhook_url_must_use_https" }, { status: 500 });
  }

  try {
    const api = new Api(token);
    await api.setWebhook(`${parsed.origin}/api/telegram-webhook`, {
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query"],
      max_connections: 1,
      drop_pending_updates: false,
    });
    await api.setMyCommands([
      { command: "start", description: "Open VOYAGE Concierge" },
      { command: "faq", description: "Frequently asked questions" },
      { command: "support", description: "Contact support" },
      { command: "cancel", description: "Cancel the current application" },
    ]);
    return Response.json({ ok: true, webhook: `${parsed.origin}/api/telegram-webhook` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[telegram-webhook-setup] failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ ok: false, error: "telegram_webhook_setup_failed" }, { status: 502 });
  }
}
