"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PartyApplicationStatus = "pending" | "approved" | "rejected" | "completed";
export type PartyApplicationSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
};

export type PartyApplication = {
  id: string;
  event_id: string;
  user_id: string;
  status: PartyApplicationStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  segment: "working" | "elite" | null;
  level: number | null;
  kyc_level: number | null;
  reliability: number | null;
  profile_status: string | null;
};

export type PartyActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_SUMMARY: PartyApplicationSummary = { total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 };

async function requireAdminOrOwner() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { ok: false as const, error: "Требуется авторизация." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return { ok: false as const, error: "Доступ только для ролей admin и owner." };
  }
  return { ok: true as const, supabase };
}

function summarize(rows: Array<{ status: string }>): PartyApplicationSummary {
  const summary = { ...EMPTY_SUMMARY };
  for (const row of rows) {
    summary.total += 1;
    if (row.status === "pending" || row.status === "approved" || row.status === "rejected" || row.status === "completed") {
      summary[row.status] += 1;
    }
  }
  return summary;
}

function errorMessage(error: { code?: string; message?: string } | null): string {
  if (error?.code === "42501" || /row-level security|admin_only|permission denied/i.test(error?.message ?? "")) {
    return "Доступ только для ролей admin и owner.";
  }
  if (error?.code === "P0002" || /not found/i.test(error?.message ?? "")) return "Заявка или тусовка не найдена.";
  return "Не удалось выполнить действие с заявкой.";
}

/** Count response statuses for the party cards. */
export async function getEventApplicationSummaries(
  eventIds: string[],
): Promise<PartyActionResult<Record<string, PartyApplicationSummary>>> {
  if (eventIds.length > 250 || eventIds.some((id) => !UUID_RE.test(id))) {
    return { ok: false, error: "Некорректный список тусовок." };
  }
  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const uniqueIds = Array.from(new Set(eventIds));
  if (uniqueIds.length === 0) return { ok: true, data: {} };

  const { data, error } = await auth.supabase
    .from("event_applications")
    .select("event_id,status")
    .in("event_id", uniqueIds);
  if (error) return { ok: false, error: errorMessage(error) };

  const grouped: Record<string, Array<{ status: string }>> = {};
  for (const id of uniqueIds) grouped[id] = [];
  for (const row of data ?? []) grouped[row.event_id]?.push({ status: row.status });

  return {
    ok: true,
    data: Object.fromEntries(uniqueIds.map((id) => [id, summarize(grouped[id] ?? [])])),
  };
}

/** Return the applicants and their profile presentation fields for one party. */
export async function getEventApplications(eventId: string): Promise<PartyActionResult<PartyApplication[]>> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: "Некорректный идентификатор тусовки." };
  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const { data: applications, error: applicationsError } = await auth.supabase
    .from("event_applications")
    .select("id,event_id,user_id,status,created_at,updated_at,completed_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (applicationsError) return { ok: false, error: errorMessage(applicationsError) };
  if (!applications?.length) return { ok: true, data: [] };

  const userIds = Array.from(new Set(applications.map((row) => row.user_id)));
  const { data: profiles, error: profileError } = await auth.supabase
    .from("profiles")
    .select("id,full_name,name,email,avatar_url,photo_urls,segment,level,kyc_level,reliability,status")
    .in("id", userIds);
  if (profileError) return { ok: false, error: errorMessage(profileError) };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const rows: PartyApplication[] = applications.map((application) => {
    const profile = profileById.get(application.user_id) as any;
    const candidateImages = [profile?.avatar_url, ...(Array.isArray(profile?.photo_urls) ? profile.photo_urls : [])];
    const avatar = candidateImages.find((value) => typeof value === "string" && /^https?:\/\//i.test(value)) ?? null;
    const fallback = typeof profile?.email === "string" ? profile.email.split("@")[0] : null;
    return {
      id: application.id,
      event_id: application.event_id,
      user_id: application.user_id,
      status: application.status as PartyApplicationStatus,
      created_at: application.created_at,
      updated_at: application.updated_at,
      completed_at: application.completed_at,
      full_name: String(profile?.full_name || profile?.name || fallback || `Resident ${application.user_id.slice(0, 6)}`),
      email: typeof profile?.email === "string" ? profile.email : null,
      avatar_url: avatar,
      segment: profile?.segment === "elite" || profile?.segment === "working" ? profile.segment : null,
      level: Number.isFinite(Number(profile?.level)) ? Number(profile.level) : null,
      kyc_level: Number.isFinite(Number(profile?.kyc_level)) ? Number(profile.kyc_level) : null,
      reliability: Number.isFinite(Number(profile?.reliability)) ? Number(profile.reliability) : null,
      profile_status: typeof profile?.status === "string" ? profile.status : null,
    };
  });

  return { ok: true, data: rows };
}

/** Only statuses that do not invoke the completed-activity scoring pipeline can be changed here. */
export async function updateEventApplicationStatus(
  eventId: string,
  applicationId: string,
  status: Exclude<PartyApplicationStatus, "completed">,
): Promise<PartyActionResult<{ id: string; event_id: string; status: PartyApplicationStatus; updated_at: string }>> {
  if (!UUID_RE.test(eventId) || !UUID_RE.test(applicationId)) {
    return { ok: false, error: "Некорректный идентификатор заявки или тусовки." };
  }
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    return { ok: false, error: "Недопустимый статус заявки." };
  }

  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from("event_applications")
    .update({ status })
    .eq("event_id", eventId)
    .eq("id", applicationId)
    .select("id,event_id,status,updated_at")
    .maybeSingle();
  if (error) return { ok: false, error: errorMessage(error) };
  if (!data) return { ok: false, error: "Заявка не найдена." };

  revalidatePath("/admin/parties");
  revalidatePath("/dashboard/parties");
  return { ok: true, data: data as { id: string; event_id: string; status: PartyApplicationStatus; updated_at: string } };
}
