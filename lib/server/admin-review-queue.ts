import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { KYC3_REQUEST_PREFIX, type ReviewFlags, type ReviewQueue } from "@/lib/admin-review";

const STAFF_ROLES = new Set(["manager", "admin", "owner"]);
const EMPTY: ReviewFlags = { kyc1: null, kyc2: null, kyc3: null };

/**
 * Очередь проверки для админки. Читает service-role клиентом, поэтому
 * вызывать только после проверки роли (owner/admin).
 * profileId — посчитать только для одной резидентки (карточка в админке).
 */
export async function loadReviewQueue(db: SupabaseClient, profileId?: string): Promise<ReviewQueue> {
  let subsQuery = db.from("kyc_submissions")
    .select("profile_id,level,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(2000);
  let kyc3Query = db.from("partner_concierge_requests")
    .select("id,resident_id,created_at")
    .in("status", ["open", "in_progress"])
    .like("title", `${KYC3_REQUEST_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (profileId) {
    subsQuery = subsQuery.eq("profile_id", profileId);
    kyc3Query = kyc3Query.eq("resident_id", profileId);
  }
  const conciergeQuery = db.from("partner_concierge_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  const [subs, kyc3, concierge] = await Promise.all([subsQuery, kyc3Query, conciergeQuery]);
  if (subs.error) console.error("[review-queue] kyc_submissions", subs.error.code);
  if (kyc3.error) console.error("[review-queue] concierge kyc3", kyc3.error.code);
  if (concierge.error) console.error("[review-queue] concierge count", concierge.error.code);

  const subRows = (subs.data ?? []) as { profile_id: string; level: number; created_at: string }[];
  const kyc3Rows = (kyc3.data ?? []) as { id: string; resident_id: string; created_at: string }[];

  const ids = Array.from(new Set([...subRows.map((r) => r.profile_id), ...kyc3Rows.map((r) => r.resident_id)].filter(Boolean)));
  const levelById = new Map<string, number>();
  const staff = new Set<string>();
  // Заявка может прийти от профиля со старой связкой profiles.user_id — ищем по обоим полям.
  const aliasToId = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data, error } = await db.from("profiles")
      .select("id,user_id,role,kyc_level")
      .or(`id.in.(${chunk.join(",")}),user_id.in.(${chunk.join(",")})`);
    if (error) {
      console.error("[review-queue] profiles", error.code);
      continue;
    }
    for (const p of data ?? []) {
      const lvl = Number(p.kyc_level);
      levelById.set(p.id, Number.isFinite(lvl) ? Math.max(0, Math.min(3, Math.floor(lvl))) : 0);
      if (STAFF_ROLES.has(String(p.role))) staff.add(p.id);
      aliasToId.set(p.id, p.id);
      if (p.user_id) aliasToId.set(String(p.user_id), p.id);
    }
  }

  const byProfile: Record<string, ReviewFlags> = {};
  const flag = (rawId: string, patch: Partial<ReviewFlags>) => {
    const id = aliasToId.get(rawId) ?? rawId;
    if (staff.has(id)) return;
    const prev = byProfile[id] ?? { ...EMPTY };
    // сохраняем самую свежую запись (строки уже отсортированы по убыванию)
    byProfile[id] = {
      kyc1: prev.kyc1 ?? patch.kyc1 ?? null,
      kyc2: prev.kyc2 ?? patch.kyc2 ?? null,
      kyc3: prev.kyc3 ?? patch.kyc3 ?? null,
    };
  };

  for (const s of subRows) {
    const id = aliasToId.get(s.profile_id) ?? s.profile_id;
    const current = levelById.get(id) ?? 0;
    if (Number(s.level) <= current) continue; // уровень уже подтверждён — заявка устарела
    if (s.level === 1) flag(s.profile_id, { kyc1: s.created_at });
    else if (s.level === 2) flag(s.profile_id, { kyc2: s.created_at });
  }
  for (const r of kyc3Rows) {
    const id = aliasToId.get(r.resident_id) ?? r.resident_id;
    if ((levelById.get(id) ?? 0) >= 3) continue;
    flag(r.resident_id, { kyc3: r.id });
  }

  return {
    byProfile,
    verification: Object.keys(byProfile).length,
    conciergeOpen: concierge.count ?? 0,
  };
}
