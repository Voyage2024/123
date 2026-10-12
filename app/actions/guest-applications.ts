"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { enforceGuestApplicationRateLimit } from "@/lib/server/guest-application-rate-limit";
import { normalizeRegistrationSource, notifyAdminsOfNewRegistration } from "@/lib/server/telegram/admin-notifications";

type GuestApplicationInput = {
  fullName: string;
  telegram: string;
  whatsapp?: string | null;
  instagram: string;
  portfolioUrl?: string | null;
  about?: string | null;
  consent: boolean;
  lang: string;
  turnstileToken: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export type GuestApplicationFailureReason =
  | "validation"
  | "captcha_required"
  | "captcha_invalid"
  | "captcha_unavailable"
  | "rate_limited"
  | "security_unavailable"
  | "insert_failed";
export type GuestApplicationResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: GuestApplicationFailureReason };

type TurnstileResult = "valid" | "invalid" | "unavailable";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
function nullable(value: unknown, max: number): string | null {
  return clean(value, max) || null;
}
function isSafeHttpUrl(value: string | null): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
  } catch {
    return false;
  }
}
function normalizeTelegram(value: unknown): string | null {
  const raw = clean(value, 120);
  const link = raw.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-z][a-z0-9_]{4,31})\/?$/i);
  const handle = (link?.[1] ?? raw.replace(/^@/, "")).trim();
  return /^[a-z][a-z0-9_]{4,31}$/i.test(handle) ? `@${handle}` : null;
}
function normalizeWhatsApp(value: unknown): string | null | false {
  const raw = clean(value, 40);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  return raw.trim().startsWith("+") ? `+${digits}` : digits;
}
function normalizeInstagram(value: unknown): string | null {
  const raw = clean(value, 180);
  const handle = raw
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? `@${handle}` : null;
}

async function verifyTurnstile(token: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim();
  if (!secret || !siteUrl) {
    console.error("[guest-application] Turnstile environment is incomplete", {
      hasSecret: Boolean(secret),
      hasSiteUrl: Boolean(siteUrl),
    });
    return "unavailable";
  }
  if (!token || token.length > 2048) return "invalid";

  let expectedHost: string;
  try {
    expectedHost = new URL(siteUrl).hostname.toLowerCase();
  } catch {
    console.error("[guest-application] NEXT_PUBLIC_SITE_URL/SITE_URL is not a valid URL");
    return "unavailable";
  }
  const allowedHosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? expectedHost)
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedHosts.length) return "unavailable";

  try {
    const form = new URLSearchParams({
      secret,
      response: token,
      idempotency_key: randomUUID(),
    });
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("[guest-application] Turnstile Siteverify HTTP failure", { status: response.status });
      return "unavailable";
    }

    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      "error-codes"?: string[];
    };
    if (!result.success) {
      console.warn("[guest-application] Turnstile rejected token", {
        errorCodes: (result["error-codes"] ?? []).slice(0, 5),
      });
      return "invalid";
    }
    if (!result.hostname || !allowedHosts.includes(result.hostname.toLowerCase())) {
      console.warn("[guest-application] Turnstile hostname mismatch", { hostname: result.hostname ?? null });
      return "invalid";
    }
    if (result.action !== "join_request") {
      console.warn("[guest-application] Turnstile action mismatch", { action: result.action ?? null });
      return "invalid";
    }
    return "valid";
  } catch (error) {
    console.error("[guest-application] Turnstile Siteverify unavailable", error instanceof Error ? error.name : "unknown");
    return "unavailable";
  }
}

export async function submitGuestApplication(input: GuestApplicationInput): Promise<GuestApplicationResult> {
  if (!input || typeof input !== "object") return { ok: false, reason: "validation" };

  const fullName = clean(input.fullName, 120);
  const telegram = normalizeTelegram(input.telegram);
  const whatsapp = normalizeWhatsApp(input.whatsapp);
  const instagram = normalizeInstagram(input.instagram);
  const portfolioUrl = nullable(input.portfolioUrl, 500);
  const rawAbout = typeof input.about === "string" ? input.about : "";
  const about = nullable(rawAbout, 1000);
  const language = clean(input.lang, 5).toLowerCase();
  const utmSource = nullable(input.utmSource, 160);
  const utmMedium = nullable(input.utmMedium, 160);
  const utmCampaign = nullable(input.utmCampaign, 160);
  const turnstileToken = clean(input.turnstileToken, 2048);

  if (
    fullName.length < 2 ||
    !telegram ||
    whatsapp === false ||
    !instagram ||
    rawAbout.length > 1000 ||
    input.consent !== true ||
    !["en", "ru", "es", "pt"].includes(language) ||
    !isSafeHttpUrl(portfolioUrl)
  ) {
    return { ok: false, reason: "validation" };
  }
  if (!turnstileToken) return { ok: false, reason: "captcha_required" };

  // Enforce this before calling Siteverify to cap abusive verification traffic.
  const rateLimit = await enforceGuestApplicationRateLimit();
  if (rateLimit === "limited") return { ok: false, reason: "rate_limited" };
  if (rateLimit === "unavailable") return { ok: false, reason: "security_unavailable" };

  const captcha = await verifyTurnstile(turnstileToken);
  if (captcha === "invalid") return { ok: false, reason: "captcha_invalid" };
  if (captcha === "unavailable") return { ok: false, reason: "captcha_unavailable" };

  const source = normalizeRegistrationSource("landing", utmSource);
  const id = randomUUID();
  // The legacy contact column remains populated for existing CRM/report consumers.
  const contact = [`Telegram: ${telegram}`, whatsapp ? `WhatsApp: ${whatsapp}` : null].filter(Boolean).join(" · ").slice(0, 120);

  try {
    // Public clients cannot INSERT directly anymore. This server action is the only public
    // write path and validates input, rate limit and single-use Turnstile token first.
    const supabase = getTelegramServiceClient();
    const { error } = await supabase.from("guest_applications").insert({
      id,
      full_name: fullName,
      contact,
      telegram,
      whatsapp,
      instagram,
      portfolio_url: portfolioUrl || null,
      about,
      consent: true,
      lang: language,
      status: "pending",
      registration_source: source,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      source_metadata: { source, submitted_from: "landing", captcha: "cloudflare_turnstile" },
    });
    if (error) {
      if (error.code === "23505") return { ok: true, duplicate: true };
      console.error("[guest-application] insert failed", {
        code: error.code,
        message: error.message,
        detail: error.details,
      });
      return { ok: false, reason: "insert_failed" };
    }
  } catch (error) {
    console.error("[guest-application] insert exception", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "insert_failed" };
  }

  // Telegram notifications are best-effort; a Telegram outage cannot undo the application.
  await notifyAdminsOfNewRegistration({
    eventKey: `guest_application:${id}`,
    source,
    applicationId: id,
    fullName,
    contact,
    instagram,
  });
  revalidatePath("/admin/requests");
  return { ok: true, duplicate: false };
}
