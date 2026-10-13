"use server";

import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { Api } from "grammy";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import type { Lang } from "@/app/context/LanguageContext";

export type ConciergeCategory = "travel" | "accommodation" | "transport" | "event" | "documents" | "general";
export type ConciergeStage = "before_tour" | "during_tour" | "after_tour";
export type ConciergeStatus = "open" | "in_progress" | "done" | "impossible";

export type CreateConciergeInput = {
  title: string;
  category: ConciergeCategory;
  message: string;
  tripStage: ConciergeStage;
  desiredAt?: string | null;
  language: Lang;
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server-side Supabase configuration is missing.");
  return createSupabaseAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function validDate(value?: string | null): string | null | undefined {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export async function createConciergeRequest(input: CreateConciergeInput) {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false as const, reason: "unauthenticated" };

    const title = input.title.trim().replace(/\s+/g, " ");
    const message = input.message.trim();
    const desiredAt = validDate(input.desiredAt);
    if (title.length < 3 || title.length > 120 || message.length < 5 || message.length > 4000) {
      return { ok: false as const, reason: "validation" };
    }
    if (desiredAt === undefined) return { ok: false as const, reason: "invalid_date" };

    const allowedCategories: ConciergeCategory[] = ["travel", "accommodation", "transport", "event", "documents", "general"];
    const allowedStages: ConciergeStage[] = ["before_tour", "during_tour", "after_tour"];
    const allowedLanguages: Lang[] = ["EN", "RU", "ES", "PT"];
    if (!allowedCategories.includes(input.category) || !allowedStages.includes(input.tripStage) || !allowedLanguages.includes(input.language)) {
      return { ok: false as const, reason: "validation" };
    }

    // Some legacy profiles use a separate profiles.user_id; resolve that link
    // before inserting a concierge request so resident_id always references profiles.id.
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,role,status,banned_until,ban_permanent")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!profile && !profileError) {
      const fallback = await supabase
        .from("profiles")
        .select("id,role,status,banned_until,ban_permanent")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      profile = fallback.data;
      profileError = fallback.error;
    }
    if (profileError || !profile) {
      console.error("[concierge] profile resolution failed", { code: profileError?.code, message: profileError?.message, authUserId: auth.user.id });
      return { ok: false as const, reason: "profile_missing" };
    }
    if (profile.role !== "resident") return { ok: false as const, reason: "resident_only" };
    if (profile.status !== "approved") return { ok: false as const, reason: "not_approved" };
    const banUntil = profile.banned_until === "infinity" ? Number.POSITIVE_INFINITY : profile.banned_until ? Date.parse(profile.banned_until) : 0;
    if (profile.ban_permanent || (Number.isFinite(banUntil) && banUntil > Date.now()) || banUntil === Number.POSITIVE_INFINITY) {
      return { ok: false as const, reason: "banned" };
    }

    const { data, error } = await supabase.from("partner_concierge_requests").insert({
      resident_id: profile.id,
      title,
      category: input.category,
      message,
      trip_stage: input.tripStage,
      desired_at: desiredAt,
      preferred_language: input.language,
      status: "open",
    }).select("id,title,category,message,trip_stage,desired_at,preferred_language,status,admin_feedback,created_at,updated_at").single();

    if (error) {
      console.error("[concierge] create request failed", { code: error.code, message: error.message, details: error.details, authUserId: auth.user.id, profileId: profile.id });
      return { ok: false as const, reason: error.code === "42501" ? "restricted" : error.code === "23503" ? "profile_missing" : error.code === "23514" ? "invalid_state" : "server_error" };
    }
    revalidatePath("/dashboard/concierge");
    revalidatePath("/admin/concierge");
    return { ok: true as const, request: data };
  } catch (error) {
    console.error("[concierge] create request unexpected error", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, reason: "server_error" };
  }
}

export async function listMyConciergeRequests() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false as const, reason: "unauthenticated" };
  let { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("id", auth.user.id).maybeSingle();
  if (!profile && !profileError) {
    const fallback = await supabase.from("profiles").select("id").eq("user_id", auth.user.id).maybeSingle();
    profile = fallback.data;
    profileError = fallback.error;
  }
  if (profileError || !profile) {
    console.error("[concierge] list profile resolution failed", { code: profileError?.code, message: profileError?.message });
    return { ok: false as const, reason: "profile_missing" };
  }
  const { data, error } = await supabase.from("partner_concierge_requests")
    .select("id,title,category,message,trip_stage,desired_at,preferred_language,status,admin_feedback,created_at,updated_at,messages:partner_concierge_messages(id,request_id,sender_profile_id,sender_role,body,created_at)")
    .eq("resident_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[concierge] list own requests failed", { code: error.code, message: error.message });
    return { ok: false as const, reason: "server_error" };
  }
  return { ok: true as const, requests: data ?? [] };
}

export async function listConciergeRequestsForStaff() {
  try {
    await requireRole(["manager", "admin", "owner"]);
    const db = serviceClient();
    const { data: requests, error } = await db.from("partner_concierge_requests").select("*,messages:partner_concierge_messages(id,request_id,sender_profile_id,sender_role,body,created_at)").order("created_at", { ascending: true }).limit(300);
    if (error) throw error;
    const residentIds = Array.from(new Set((requests ?? []).map((row) => String(row.resident_id))));
    const { data: profiles, error: profileError } = residentIds.length
      ? await db.from("profiles").select("id,full_name,avatar_url,telegram_id,segment,level,kyc_level").in("id", residentIds)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const avatarPaths = Array.from(new Set((profiles ?? []).map((row) => row.avatar_url).filter((value): value is string => Boolean(value) && !/^https?:\/\//i.test(value as string))));
    const signedByPath = new Map<string, string>();
    if (avatarPaths.length) {
      const { data: signedRows, error: signedError } = await db.storage.from("user-uploads").createSignedUrls(avatarPaths, 3600);
      if (signedError) throw signedError;
      signedRows?.forEach((row, index) => { if (row.signedUrl) signedByPath.set(avatarPaths[index], row.signedUrl); });
    }
    const profileMap = new Map((profiles ?? []).map((row) => [row.id, {
      ...row,
      avatar_url: row.avatar_url && /^https?:\/\//i.test(row.avatar_url) ? row.avatar_url : row.avatar_url ? signedByPath.get(row.avatar_url) ?? null : null,
    }]));
    return { ok: true as const, requests: (requests ?? []).map((row) => ({ ...row, resident: profileMap.get(row.resident_id) ?? null })) };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, reason: "forbidden" };
    console.error("[concierge] staff list failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, reason: "server_error" };
  }
}

export async function updateConciergeRequest(input: { id: string; status: ConciergeStatus; feedback?: string }) {
  try {
    const { userId } = await requireRole(["manager", "admin", "owner"]);
    if (!/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false as const, reason: "not_found" };
    const allowedStatuses: ConciergeStatus[] = ["open", "in_progress", "done", "impossible"];
    if (!allowedStatuses.includes(input.status)) return { ok: false as const, reason: "validation" };
    const feedback = typeof input.feedback === "string" ? input.feedback.trim() : "";
    if (feedback.length > 4000) return { ok: false as const, reason: "validation" };
    const isClosed = input.status === "done" || input.status === "impossible";
    if (isClosed && !feedback) return { ok: false as const, reason: "feedback_required" };
    const db = serviceClient();
    const patch: Record<string, unknown> = {
      status: input.status,
      resolved_by: isClosed ? userId : null,
      resolved_at: isClosed ? new Date().toISOString() : null,
    };
    // Status changes must not erase the most recent reply.
    if (feedback) patch.admin_feedback = feedback;
    const { data, error } = await db.from("partner_concierge_requests").update(patch)
      .eq("id", input.id).select("id,status,admin_feedback,resolved_at,updated_at").maybeSingle();
    if (error || !data) {
      console.error("[concierge] update request failed", { code: error?.code, message: error?.message, id: input.id });
      return { ok: false as const, reason: error ? "server_error" : "not_found" };
    }
    revalidatePath("/admin/concierge");
    revalidatePath("/dashboard/concierge");
    return { ok: true as const, request: data };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, reason: "forbidden" };
    console.error("[concierge] update request unexpected error", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, reason: "server_error" };
  }
}

export async function replyToConciergeRequest(input: { id: string; message: string; status?: ConciergeStatus }) {
  try {
    const { userId } = await requireRole(["manager", "admin", "owner"]);
    if (!/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false as const, reason: "not_found" };
    if (typeof input.message !== "string") return { ok: false as const, reason: "validation" };
    const body = input.message.trim();
    if (body.length < 1 || body.length > 4000) return { ok: false as const, reason: "validation" };
    const status = input.status ?? "in_progress";
    const allowedStatuses: ConciergeStatus[] = ["open", "in_progress", "done", "impossible"];
    if (!allowedStatuses.includes(status)) return { ok: false as const, reason: "validation" };

    const db = serviceClient();
    const { data: request, error: requestError } = await db.from("partner_concierge_requests")
      .select("id,resident_id,title").eq("id", input.id).maybeSingle();
    if (requestError || !request) {
      console.error("[concierge] reply request lookup failed", { code: requestError?.code, id: input.id });
      return { ok: false as const, reason: requestError ? "server_error" : "not_found" };
    }

    // Store the reply and update the request status atomically in PostgreSQL.
    const { data: messageId, error: replyError } = await db.rpc("voyage_concierge_reply", {
      p_request_id: request.id, p_sender_profile_id: userId, p_body: body, p_status: status,
    });
    if (replyError || !messageId) {
      console.error("[concierge] reply persistence failed", { code: replyError?.code, message: replyError?.message, id: input.id });
      return { ok: false as const, reason: "server_error" };
    }

    const { data: resident, error: residentError } = await db.from("profiles")
      .select("telegram_id,full_name,telegram_language").eq("id", request.resident_id).maybeSingle();
    let telegramSent = false;
    let warning: string | undefined;
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const telegramId = resident?.telegram_id == null ? "" : String(resident.telegram_id);
    if (residentError) {
      warning = "Reply saved, but the resident's Telegram account could not be checked.";
    } else if (!token || !/^\d{4,20}$/.test(telegramId)) {
      warning = "Reply saved, but the resident has no linked Telegram account or the bot token is missing.";
    } else {
      try {
        const lang = resident?.telegram_language === "EN" ? "EN" : resident?.telegram_language === "ES" ? "ES" : resident?.telegram_language === "PT" ? "PT" : "RU";
        const prefix = ({
          EN: "VOYAGE Concierge replied to your request",
          RU: "Консьерж VOYAGE ответил на ваш запрос",
          ES: "El concierge de VOYAGE respondió a tu solicitud",
          PT: "O concierge VOYAGE respondeu à sua solicitação",
        } as const)[lang];
        await new Api(token).sendMessage(Number(telegramId), `${prefix}: ${request.title}\n\n${body}\n\nVOYAGE PRIVATE CLUB`, {
          link_preview_options: { is_disabled: true },
        });
        telegramSent = true;
      } catch (error) {
        warning = "Reply saved in the website inbox, but Telegram delivery failed. The resident can still read the reply in the dashboard.";
        console.error("[concierge] Telegram reply delivery failed", error instanceof Error ? error.name : "unknown");
      }
    }

    revalidatePath("/admin/concierge");
    revalidatePath("/dashboard/concierge");
    return { ok: true as const, messageId: String(messageId), telegramSent, ...(warning ? { warning } : {}) };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, reason: "forbidden" };
    console.error("[concierge] reply failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, reason: "server_error" };
  }
}
