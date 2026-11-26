import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { IDENTITY_REQUEST_PREFIX, type IdentityField } from "@/lib/resident-profile-fields";
import { parseIdentityRequestBody, type IdentityProposal } from "@/lib/resident-identity-requests";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Данные для блока «Identity & KYC» карточки резидентки и для
 * Server Actions одобрения/отказа. Только сервер (service role); вызывать
 * лишь после проверки, что смотрит owner/admin.
 * Источник запросов — существующие partner_concierge_requests
 * (заголовок «[Данные KYC] …», категория documents) и первое сообщение
 * резидентки в их переписке (partner_concierge_messages).
 * ──────────────────────────────────────────────────────────────────── */

export type IdentityRequestRow = {
  id: string;
  resident_id: string;
  title: string;
  status: string;
  preferred_language: string | null;
  admin_feedback: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type IdentityRequestView = IdentityRequestRow & {
  /** null — сообщение с изменениями не найдено или не в формате запроса */
  proposal: IdentityProposal | null;
  /** Последняя запись журнала 'profile.identity_change' по полям запроса после его подачи (ручная правка). */
  manualChangeAt?: string | null;
};

/** Запись журнала об изменении гражданства / даты рождения (триггер profiles_identity_audit). */
export type IdentityChangeAudit = { id: number; created_at: string; fields: IdentityField[] };

export type KycSubmissionView = { level: number; status: string; created_at: string };

const REQUEST_COLUMNS = "id,resident_id,title,status,preferred_language,admin_feedback,resolved_at,created_at";
const ACTIVE = ["open", "in_progress"];

/** Первое сообщение самой резидентки в заявке — его создаёт requestResidentIdentityChange. */
export async function loadRequestProposal(db: SupabaseClient, request: { id: string; resident_id: string }) {
  const { data, error } = await db.from("partner_concierge_messages")
    .select("body,created_at")
    .eq("request_id", request.id)
    .eq("sender_profile_id", request.resident_id)
    .eq("sender_role", "resident")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`identity request message: ${error.code ?? "unknown"}`);
  return data ? parseIdentityRequestBody(data.body) : null;
}

export async function loadIdentityRequest(db: SupabaseClient, requestId: string): Promise<IdentityRequestRow | null> {
  const { data, error } = await db.from("partner_concierge_requests").select(REQUEST_COLUMNS).eq("id", requestId).maybeSingle();
  if (error) throw new Error(`identity request: ${error.code ?? "unknown"}`);
  if (!data || !String(data.title ?? "").trim().startsWith(IDENTITY_REQUEST_PREFIX)) return null;
  return data as IdentityRequestRow;
}

/** Активные запросы «[Данные KYC]» резидентки (по правилу v2 — не больше одного). */
export async function loadActiveIdentityRequests(db: SupabaseClient, profileId: string): Promise<IdentityRequestRow[]> {
  const { data, error } = await db.from("partner_concierge_requests")
    .select(REQUEST_COLUMNS)
    .eq("resident_id", profileId)
    .in("status", ACTIVE)
    .like("title", `${IDENTITY_REQUEST_PREFIX}%`)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(`identity requests: ${error.code ?? "unknown"}`);
  return (data ?? []) as IdentityRequestRow[];
}

/**
 * Изменения гражданства / даты рождения резидентки, записанные в журнал
 * не раньше sinceIso (новые сверху). Источник — append-only audit_logs,
 * запись делает триггер в одной транзакции с изменением профиля.
 */
export async function loadIdentityChangesSince(db: SupabaseClient, profileId: string, sinceIso: string): Promise<IdentityChangeAudit[]> {
  const { data, error } = await db.from("audit_logs")
    .select("id,created_at,metadata")
    .eq("action", "profile.identity_change")
    .eq("target_profile_id", profileId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`identity audit: ${error.code ?? "unknown"}`);
  return ((data ?? []) as { id: number; created_at: string; metadata: { changes?: Record<string, unknown> } | null }[]).map((row) => ({
    id: Number(row.id),
    created_at: row.created_at,
    fields: (["citizenship", "birth_date"] as const).filter((f) => Boolean(row.metadata?.changes && f in row.metadata.changes)),
  }));
}

/** Поля запроса, которые после его подачи меняли вручную (по журналу). Без разбора — любые поля. */
export function manualChangeFor(proposal: IdentityProposal | null, requestCreatedAt: string, changes: IdentityChangeAudit[]) {
  const wanted = proposal ? (["citizenship", "birth_date"] as const).filter((f) => proposal[f]) : (["citizenship", "birth_date"] as const);
  const since = Date.parse(requestCreatedAt);
  return changes.find((c) => Date.parse(c.created_at) >= since && c.fields.some((f) => (wanted as readonly string[]).includes(f))) ?? null;
}

/** Активные запросы (open / in_progress) и последние 5 закрытых — для истории. */
export async function loadIdentityCard(db: SupabaseClient, profileId: string) {
  const [requests, submissions] = await Promise.all([
    db.from("partner_concierge_requests")
      .select(REQUEST_COLUMNS)
      .eq("resident_id", profileId)
      .like("title", `${IDENTITY_REQUEST_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("kyc_submissions")
      .select("level,status,created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (requests.error) throw new Error(`identity requests: ${requests.error.code ?? "unknown"}`);
  if (submissions.error) throw new Error(`kyc submissions: ${submissions.error.code ?? "unknown"}`);

  const rows = (requests.data ?? []) as IdentityRequestRow[];
  const active = rows.filter((r) => ACTIVE.includes(r.status));
  const closed = rows.filter((r) => !ACTIVE.includes(r.status)).slice(0, 5);
  const withProposal = async (r: IdentityRequestRow): Promise<IdentityRequestView> => ({ ...r, proposal: await loadRequestProposal(db, r) });
  const activeViews = await Promise.all(active.map(withProposal));
  if (activeViews.length) {
    const oldest = activeViews.reduce((min, r) => (r.created_at < min ? r.created_at : min), activeViews[0].created_at);
    const changes = await loadIdentityChangesSince(db, profileId, oldest);
    for (const r of activeViews) r.manualChangeAt = manualChangeFor(r.proposal, r.created_at, changes)?.created_at ?? null;
  }
  return {
    active: activeViews,
    closed: await Promise.all(closed.map(withProposal)),
    submissions: (submissions.data ?? []) as KycSubmissionView[],
  };
}
