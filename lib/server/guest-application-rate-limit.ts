import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

export type GuestApplicationRateLimitResult = "allowed" | "limited" | "unavailable";

/**
 * Uses only proxy-provided client IP headers. In production, deploy behind a trusted edge
 * (Cloudflare/Vercel) that overwrites these headers; never trust client-supplied IP headers
 * when exposing the origin directly to the internet.
 */
export async function enforceGuestApplicationRateLimit(): Promise<GuestApplicationRateLimitResult> {
  try {
    const incoming = await headers();
    const ip = (
      incoming.get("cf-connecting-ip") ??
      incoming.get("x-real-ip") ??
      incoming.get("x-forwarded-for")?.split(",")[0]
    )?.trim();
    const secret = (process.env.GUEST_APPLICATION_RATE_LIMIT_SECRET ?? "").trim();
    if (!ip || !secret) {
      console.error("[guest-application] rate-limit configuration missing", { hasIp: Boolean(ip), hasSecret: Boolean(secret) });
      return "unavailable";
    }

    // Store only a keyed fingerprint, never the raw client IP address.
    const fingerprint = createHmac("sha256", secret).update(ip).digest("hex");
    const db = getTelegramServiceClient();
    const { data, error } = await db.rpc("consume_guest_application_rate_limit", {
      p_fingerprint: fingerprint,
      p_max_requests: 5,
      p_window_seconds: 3600,
    });
    if (error) {
      console.error("[guest-application] rate-limit RPC failed", { code: error.code, message: error.message });
      return "unavailable";
    }
    return data === true ? "allowed" : "limited";
  } catch (error) {
    console.error("[guest-application] rate-limit failed", error instanceof Error ? error.name : "unknown");
    return "unavailable";
  }
}
