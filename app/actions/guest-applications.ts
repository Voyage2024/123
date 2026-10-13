"use server";

/**
 * Public website registration has intentionally been retired.
 * All new applications must go through the official Telegram bot so the
 * applicant is linked to a reachable Telegram chat before Face Control.
 * This compatibility action stays in place so any stale client bundle fails
 * closed instead of creating a web-only application with no delivery channel.
 */
export type GuestApplicationFailureReason = "registration_moved_to_telegram";
export type GuestApplicationResult = { ok: false; reason: GuestApplicationFailureReason };

export async function submitGuestApplication(): Promise<GuestApplicationResult> {
  return { ok: false, reason: "registration_moved_to_telegram" };
}
