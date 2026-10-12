"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeRegistrationSource, notifyAdminsOfNewRegistration } from "@/lib/server/telegram/admin-notifications";

type GuestApplicationInput = {
  fullName: string;
  contact: string;
  instagram: string;
  portfolioUrl?: string | null;
  about?: string | null;
  consent: boolean;
  lang: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export type GuestApplicationResult = { ok: true; duplicate: boolean } | { ok: false; reason: "validation" | "insert_failed" };

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
function nullable(value: unknown, max: number): string | null {
  return clean(value, max) || null;
}
function isSafeHttpUrl(value: string | null): boolean {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

export async function submitGuestApplication(input: GuestApplicationInput): Promise<GuestApplicationResult> {
  if (!input || typeof input !== "object") return { ok: false, reason: "validation" };
  const fullName = clean(input.fullName, 120);
  const contact = clean(input.contact, 180);
  const instagram = clean(input.instagram, 180);
  const portfolioUrl = nullable(input.portfolioUrl, 1000);
  const rawAbout = typeof input.about === "string" ? input.about : "";
  const about = nullable(rawAbout, 4000);
  const language = clean(input.lang, 5).toLowerCase();
  const utmSource = nullable(input.utmSource, 160);
  const utmMedium = nullable(input.utmMedium, 160);
  const utmCampaign = nullable(input.utmCampaign, 160);
  if (fullName.length < 2 || contact.length < 3 || instagram.length < 2 || rawAbout.length > 4000 || input.consent !== true || !["en", "ru", "es", "pt"].includes(language) || !isSafeHttpUrl(portfolioUrl)) {
    return { ok: false, reason: "validation" };
  }
  const source = normalizeRegistrationSource("landing", utmSource);
  const id = randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from("guest_applications").insert({
    id,
    full_name: fullName,
    contact,
    instagram,
    portfolio_url: portfolioUrl,
    about,
    consent: true,
    lang: language,
    status: "pending",
    registration_source: source,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    source_metadata: { source, submitted_from: "landing" },
  });
  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true };
    console.error("[guest-application] insert failed", { code: error.code, message: error.message, detail: error.details });
    return { ok: false, reason: "insert_failed" };
  }
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
