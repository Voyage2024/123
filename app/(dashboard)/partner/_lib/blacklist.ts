/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Blacklist»
 * app/(dashboard)/partner/_lib/blacklist.ts
 *
 * RPC public.partner_blacklist_list() под RLS, не прямой select:
 * менеджер не читает partner_blacklist напрямую. RPC отдаёт записи
 * со статусом confirmed и appeal, свои заявки pending (админ — все), код записи,
 * причину, даты и число файлов-доказательств — без самих файлов.
 * Имя и id — только по правилу partner_can_reveal: бывшая участница
 * туров этого менеджера (владелец и админ видят всех).
 * ──────────────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase";
import { BLACKLIST_REASON, list, num, obj, oneOf, str, time, type BlacklistReason } from "./command";
import { toFeedError } from "./usePartnerFeed";

export type BlacklistEntry = {
  id: string;
  code: string;
  residentId: string | null;
  name: string | null;
  reason: BlacklistReason;
  /** pending — заявка менеджера ждёт проверки клуба; revoked видит только админ */
  status: "pending" | "confirmed" | "appeal" | "revoked";
  at: number;
  /** null — бессрочно */
  expiresAt: number | null;
  /** Сколько доказательств проверил ассистент клуба */
  evidence: number;
  /** Запись внёс этот менеджер */
  mine: boolean;
  /** Только админу: текст доказательств, кто внёс, когда решили */
  evidenceText: string | null;
  reporter: string | null;
  reviewedAt: number | null;
};

export type BlacklistData = {
  generatedAt: number;
  entries: BlacklistEntry[];
  /** Никого из тех, кого держит менеджер (состав, опцион), нет в списке */
  clean: boolean;
  /** Админ и владелец: видят всё и решают по заявкам */
  isAdmin: boolean;
};

const STATUSES = ["pending", "confirmed", "appeal", "revoked"] as const;

/** Разбор public.partner_blacklist_list() — миграция 20261020094000_partner_live_pages.sql */
export function parseBlacklist(raw: unknown): BlacklistData {
  const root = obj(raw);
  const entries = list<BlacklistEntry>(root.entries, (r) => {
    const id = str(r.id);
    const reason = typeof r.reason === "string" ? BLACKLIST_REASON[r.reason] : undefined;
    const at = time(r.at);
    const status = oneOf(r.status, STATUSES);
    if (!id || !reason || at === null || !status) return null;
    return {
      id,
      code: str(r.code) ?? "—",
      residentId: str(r.resident_id),
      name: str(r.name),
      reason,
      status,
      at,
      expiresAt: time(r.expires_at),
      evidence: num(r.evidence) ?? 0,
      mine: r.mine === true,
      evidenceText: str(r.evidence_text),
      reporter: str(r.reporter),
      reviewedAt: time(r.reviewed_at),
    };
  });
  return {
    generatedAt: time(root.generated_at) ?? Date.now(),
    entries,
    clean: root.clean !== false,
    isAdmin: root.is_admin === true,
  };
}

/** Причина на экране → в БД */
export const REASON_TO_DB: Record<BlacklistReason, string> = { noShow: "no_show", fakePhotos: "fake_photos", fraud: "fraud" };

export type BlacklistCandidate = {
  residentId: string;
  name: string;
  lastTourId: string | null;
  lastCity: string | null;
  lastAt: number | null;
  lastStatus: string | null;
};

export async function fetchBlacklistCandidates(): Promise<BlacklistCandidate[]> {
  const { data, error } = await supabase.rpc("partner_blacklist_candidates");
  if (error) throw toFeedError(error);
  return list<BlacklistCandidate>(data, (r) => {
    const residentId = str(r.resident_id);
    if (!residentId) return null;
    return {
      residentId,
      name: str(r.name) ?? "—",
      lastTourId: str(r.last_tour_id),
      lastCity: str(r.last_city),
      lastAt: time(r.last_at),
      lastStatus: str(r.last_status),
    };
  });
}

/** Менеджер: отправить на проверку клуба (status pending) */
export async function reportToBlacklist(input: {
  residentId: string;
  reason: BlacklistReason;
  evidence: string;
  tourId: string | null;
}): Promise<{ code: string | null }> {
  const { data, error } = await supabase.rpc("partner_blacklist_report", {
    p_resident: input.residentId,
    p_reason: REASON_TO_DB[input.reason],
    p_evidence: input.evidence,
    p_tour: input.tourId,
  });
  if (error) throw toFeedError(error);
  return { code: str(obj(data).code) };
}

/** Админ: внести сразу подтверждённую запись */
export async function addToBlacklist(input: {
  residentId: string;
  reason: BlacklistReason;
  evidence: string;
  expiresAt: number | null;
}): Promise<void> {
  const { error } = await supabase.rpc("partner_blacklist_add", {
    p_resident: input.residentId,
    p_reason: REASON_TO_DB[input.reason],
    p_evidence: input.evidence,
    p_expires_at: input.expiresAt === null ? null : new Date(input.expiresAt).toISOString(),
  });
  if (error) throw toFeedError(error);
}

/** Админ: решение по записи. expiresAt: undefined — не менять, null — бессрочно */
export async function reviewBlacklistEntry(
  id: string,
  status: "confirmed" | "appeal" | "revoked",
  expiresAt?: number | null,
): Promise<void> {
  const { error } = await supabase.rpc("partner_blacklist_review", {
    p_id: id,
    p_status: status,
    p_expires_at: typeof expiresAt === "number" ? new Date(expiresAt).toISOString() : null,
    p_clear_expiry: expiresAt === null,
  });
  if (error) throw toFeedError(error);
}
