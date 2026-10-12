"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EventApplicationRecord = {
  id: string;
  status: "pending" | "approved" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
};

export type SubmitEventApplicationResult =
  | { ok: true; application: EventApplicationRecord }
  | {
      ok: false;
      reason: string;
      requiredLevel?: number;
      actualLevel?: number;
      availableAt?: string;
    };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * User-facing errors are stable reason codes; the exact database/provider error
 * is logged only server-side. All real eligibility checks live in one locked SQL RPC.
 */
export async function submitEventApplication(eventId: string): Promise<SubmitEventApplicationResult> {
  if (!UUID_RE.test(eventId)) return { ok: false, reason: "event_not_found" };

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, reason: "unauthenticated" };

    const { data, error } = await supabase.rpc("submit_global_event_application", {
      p_event_id: eventId,
    });

    if (error) {
      console.error("[event-application] submit_global_event_application failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: authData.user.id,
        eventId,
      });
      return { ok: false, reason: "server_error" };
    }

    const result = data as Record<string, unknown> | null;
    if (!result || result.ok !== true) {
      const reason = typeof result?.reason === "string" ? result.reason : "server_error";
      const requiredLevel = typeof result?.required_level === "number" ? result.required_level : undefined;
      const actualLevel = typeof result?.actual_level === "number" ? result.actual_level : undefined;
      const availableAt = typeof result?.available_at === "string" ? result.available_at : undefined;
      // Business denial is expected UX, but keep a structured server-side trace
      // so developers can diagnose eligibility without exposing internals to the UI.
      console.warn("[event-application] rejected by business rule", {
        userId: authData.user.id,
        eventId,
        reason,
        requiredLevel,
        actualLevel,
        availableAt,
      });
      return {
        ok: false,
        reason,
        ...(requiredLevel !== undefined ? { requiredLevel } : {}),
        ...(actualLevel !== undefined ? { actualLevel } : {}),
        ...(availableAt ? { availableAt } : {}),
      };
    }

    const application = result.application as EventApplicationRecord | undefined;
    if (!application?.id) {
      console.error("[event-application] RPC returned ok without application", { eventId, userId: authData.user.id });
      return { ok: false, reason: "server_error" };
    }

    revalidatePath("/dashboard/parties");
    revalidatePath("/admin/parties");
    return { ok: true, application };
  } catch (error) {
    console.error("[event-application] unexpected error", {
      eventId,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : undefined,
    });
    return { ok: false, reason: "server_error" };
  }
}
