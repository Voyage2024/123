/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ЖИВЫЕ ИМЕНА — визитки профилей
 * lib/memberCards.ts
 *
 * Имя, аватар и Circle участницы всегда берутся из profiles в момент
 * чтения — никаких копий в таблицах туров и ивентов. Сервер — миграция
 * 20261012_live_member_names.sql:
 *   v_member_cards         — визитка профиля (имя, аватар, роль, Circle, Индекс)
 *   v_<таблица>_live       — таблица участниц + живые имена (те же колонки)
 *
 * Два способа на страницах туров и ивентов:
 *   1) читать вьюху: supabase.from(liveView("tour_participants")) — и всё;
 *   2) если страница сначала грузит строки, а потом профили (.in("id", ids)),
 *      заменить второй запрос на withLiveMembers(rows, "user_id").
 * ──────────────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase";
import { normalizeCircleKey, num, type CircleKey } from "@/lib/gamification";

/** Бакет Supabase Storage, если в profiles.avatar_url лежит путь, а не URL */
export const AVATAR_BUCKET = "avatars";

/** Вьюха с живыми именами для таблицы (как её называет миграция) */
export const liveView = (table: string) => `v_${table.slice(0, 56)}_live`;

/** «https://…», «avatars/anna.jpg», «anna.jpg» → публичный URL или null */
export function resolveAvatarUrl(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.replace(/^\/+/, "").replace(new RegExp(`^${AVATAR_BUCKET}/`), "");
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl || null;
}

/** «Анна Ковалёва» → «АК» */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "·";
}

/* ── v_member_cards ──────────────────────────────────────────────── */

type Num = number | string | null | undefined;

export type MemberCardRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  /** статус анкеты — только своя карточка и персонал, иначе null */
  status: string | null;
  circle_key: string | null;
  circle_title: string | null;
  circle_level: Num;
  influence: Num;
  global_position: Num;
};

export type MemberCard = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: string | null;
  status: string | null;
  circleKey: CircleKey | null;
  circleTitle: string | null;
  influence: number | null;
  globalPosition: number | null;
};

export function normalizeMemberCard(r: MemberCardRow): MemberCard {
  return {
    id: r.id,
    name: r.full_name?.trim() || null,
    avatarUrl: resolveAvatarUrl(r.avatar_url),
    role: r.role,
    status: r.status,
    circleKey: normalizeCircleKey(r.circle_key),
    circleTitle: r.circle_title?.trim() || null,
    influence: num(r.influence) ?? null,
    globalPosition: num(r.global_position) ?? null,
  };
}

/** Визитки по id — одним запросом, без дублей и пустых id */
export async function fetchMemberCards(ids: Array<string | null | undefined>): Promise<Map<string, MemberCard>> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string" && id !== ""))];
  const out = new Map<string, MemberCard>();
  if (unique.length === 0) return out;
  const { data, error } = await supabase.from("v_member_cards").select("*").in("id", unique);
  if (error) throw error;
  for (const row of (data ?? []) as MemberCardRow[]) out.set(row.id, normalizeMemberCard(row));
  return out;
}

/**
 * Строки участниц + живая визитка. Имя из профиля важнее сохранённого;
 * сохранённое (fallbackName) — только если профиля больше нет.
 */
export async function withLiveMembers<T extends Record<string, unknown>>(
  rows: T[],
  idKey: keyof T & string,
  fallbackName?: keyof T & string,
): Promise<Array<T & { member: MemberCard | null; memberName: string }>> {
  const cards = await fetchMemberCards(rows.map((r) => r[idKey] as string | null | undefined));
  return rows.map((r) => {
    const member = cards.get(String(r[idKey] ?? "")) ?? null;
    const stored = fallbackName && typeof r[fallbackName] === "string" ? String(r[fallbackName]).trim() : "";
    return { ...r, member, memberName: member?.name ?? (stored || "Resident") };
  });
}
