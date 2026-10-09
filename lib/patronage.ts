/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PATRONAGE — общие типы и правила
 * lib/patronage.ts
 *
 * Общий модуль для страницы резидента (dashboard/invite) и админки
 * (admin/invites). Сервер — миграция 20261009_club_invites.sql:
 *   club_invites          — ключи и вся история модерации
 *   v_club_invites        — витрина (персонал видит всё, резидент — своё)
 *   club_patronage_rules  — дивиденды за этапы протеже
 *   game_circles.invite_quota — ключей на сезон по Circle
 * Значения по умолчанию ниже совпадают с теми, что миграция пишет в БД;
 * если админ поменял их в базе, побеждает база.
 * ──────────────────────────────────────────────────────────────────── */

import { CIRCLES, normalizeCircleKey, num, type CircleKey } from "./gamification";

/* ── Статусы ключа ───────────────────────────────────────────────── */

export const INVITE_STATUSES = ["sealed", "pending", "approved", "declined", "expired", "burned"] as const;
export type ClubInviteStatus = (typeof INVITE_STATUSES)[number];
export const isInviteStatus = (v: unknown): v is ClubInviteStatus =>
  typeof v === "string" && (INVITE_STATUSES as readonly string[]).includes(v);

/** Действия модератора (club_invite_action) */
export type InviteAction = "approve" | "decline" | "burn" | "restore" | "revoke";

/** Какие действия доступны из статуса */
export const ACTIONS_BY_STATUS: Record<ClubInviteStatus, InviteAction[]> = {
  sealed: ["revoke"],
  pending: ["approve", "decline"],
  approved: ["burn"],
  declined: [],
  expired: [],
  burned: ["restore"],
};

/* ── Правила ─────────────────────────────────────────────────────── */

/** Сколько дней живёт ключ (= default в club_invites.expires_at) */
export const KEY_TTL_DAYS = 14;

/** Отличие Patron — столько принятых протеже за сезон */
export const PATRON_GOAL = 3;

export type Milestone = "approved" | "firstStamp" | "innerCircle";
export const MILESTONES: Milestone[] = ["approved", "firstStamp", "innerCircle"];

export const DEFAULT_DIVIDENDS: Record<Milestone, number> = {
  approved: 250,
  firstStamp: 1000,
  innerCircle: 2500,
};

export const DEFAULT_INVITE_QUOTA: Record<CircleKey, number> = {
  voyager: 1,
  resident: 2,
  preferred: 3,
  inner: 4,
  private: 5,
  black: 7,
};

type Num = number | string | null | undefined;

export type PatronageRuleRow = { milestone: string; points?: Num };
export type CircleQuotaRow = { key?: string | null; invite_quota?: Num };

const RULE_KEYS: Record<string, Milestone> = {
  approved: "approved",
  first_stamp: "firstStamp",
  inner_circle: "innerCircle",
};

/** club_patronage_rules → { approved, firstStamp, innerCircle } */
export function resolveDividends(rows?: PatronageRuleRow[] | null): Record<Milestone, number> {
  const out = { ...DEFAULT_DIVIDENDS };
  for (const r of rows ?? []) {
    const key = RULE_KEYS[r.milestone];
    const points = num(r.points);
    if (key && points !== undefined && points >= 0) out[key] = Math.round(points);
  }
  return out;
}

/** game_circles.invite_quota → ключей на сезон по Circle */
export function resolveQuota(rows?: CircleQuotaRow[] | null): Record<CircleKey, number> {
  const out = { ...DEFAULT_INVITE_QUOTA };
  for (const r of rows ?? []) {
    const key = normalizeCircleKey(r.key);
    const quota = num(r.invite_quota);
    if (key && quota !== undefined && quota >= 0) out[key] = Math.floor(quota);
  }
  return out;
}

export const dividendMax = (d: Record<Milestone, number>) => MILESTONES.reduce((s, m) => s + d[m], 0);

/* ── Витрина v_club_invites ──────────────────────────────────────── */

export type ClubInviteRow = {
  id: string;
  code: string;
  season: Num;
  status: string;
  guest_name: string | null;
  guest_id: string | null;
  guest_full_name: string | null;
  guest_avatar_url: string | null;
  guest_email: string | null;
  guest_profile_status: string | null;
  guest_circle_key: string | null;
  guest_influence: Num;
  patron_id: string | null;
  patron_name: string | null;
  patron_avatar_url: string | null;
  patron_circle_key: string | null;
  patron_influence: Num;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  moderated_at: string | null;
  moderated_by_name: string | null;
  moderation_note: string | null;
  burned_at: string | null;
  burned_by_name: string | null;
  burn_note: string | null;
  milestone_approved: boolean | null;
  milestone_first_stamp: boolean | null;
  milestone_inner_circle: boolean | null;
  dividends_earned: Num;
  dividends: Num;
};

export type ClubInvite = {
  id: string;
  code: string;
  season: number;
  status: ClubInviteStatus;
  /** имя, вписанное в приглашение */
  guestName: string;
  guestId: string | null;
  /** имя из профиля гостьи (после регистрации), иначе guestName */
  guestFullName: string;
  guestAvatarUrl: string | null;
  guestEmail: string | null;
  /** profiles.status гостьи: pending | approved | rejected | blocked … */
  guestProfileStatus: string | null;
  guestCircleKey: CircleKey | null;
  guestInfluence: number | null;
  patronId: string | null;
  patronName: string;
  patronAvatarUrl: string | null;
  patronCircleKey: CircleKey | null;
  patronInfluence: number | null;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  moderatedAt: string | null;
  moderatedByName: string | null;
  moderationNote: string | null;
  burnedAt: string | null;
  burnedByName: string | null;
  burnNote: string | null;
  milestones: Record<Milestone, boolean>;
  /** сколько протеже принесла бы по пройденным этапам */
  dividendsEarned: number;
  /** сколько реально начислено (0, если поручительство сожжено) */
  dividends: number;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export function normalizeInvite(r: ClubInviteRow): ClubInvite {
  const status: ClubInviteStatus = isInviteStatus(r.status) ? r.status : "sealed";
  const guestName = str(r.guest_name) ?? "—";
  return {
    id: r.id,
    code: r.code,
    season: num(r.season) ?? new Date(r.issued_at).getUTCFullYear(),
    status,
    guestName,
    guestId: r.guest_id,
    guestFullName: str(r.guest_full_name) ?? guestName,
    guestAvatarUrl: str(r.guest_avatar_url),
    guestEmail: str(r.guest_email),
    guestProfileStatus: str(r.guest_profile_status),
    guestCircleKey: normalizeCircleKey(r.guest_circle_key),
    guestInfluence: num(r.guest_influence) ?? null,
    patronId: r.patron_id,
    patronName: str(r.patron_name) ?? "—",
    patronAvatarUrl: str(r.patron_avatar_url),
    patronCircleKey: normalizeCircleKey(r.patron_circle_key),
    patronInfluence: num(r.patron_influence) ?? null,
    issuedAt: r.issued_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    moderatedAt: r.moderated_at,
    moderatedByName: str(r.moderated_by_name),
    moderationNote: str(r.moderation_note),
    burnedAt: r.burned_at,
    burnedByName: str(r.burned_by_name),
    burnNote: str(r.burn_note),
    milestones: {
      approved: !!r.milestone_approved,
      firstStamp: !!r.milestone_first_stamp,
      innerCircle: !!r.milestone_inner_circle,
    },
    dividendsEarned: num(r.dividends_earned) ?? 0,
    dividends: num(r.dividends) ?? 0,
  };
}

/* ── Цепочка поручительства ──────────────────────────────────────── */

export type ChainLink = { id: string | null; name: string };

/**
 * Кто кого привёл — от основательницы цепочки до гостьи:
 * [Основательница, …, Поручительница, Гостья]. Учитываются ключи,
 * которые гостья реально открыла (pending / approved / burned).
 */
export function buildChains(invites: ClubInvite[]) {
  const byGuest = new Map<string, ClubInvite>();
  for (const i of invites) {
    if (i.guestId && (i.status === "pending" || i.status === "approved" || i.status === "burned")) {
      byGuest.set(i.guestId, i);
    }
  }
  return (invite: ClubInvite): ChainLink[] => {
    const chain: ChainLink[] = [{ id: invite.guestId, name: invite.guestFullName }];
    const seen = new Set<string>(invite.guestId ? [invite.guestId] : []);
    let patronId = invite.patronId;
    let patronName = invite.patronName;
    for (let depth = 0; depth < 12; depth++) {
      chain.unshift({ id: patronId, name: patronName });
      if (!patronId || seen.has(patronId)) break;
      seen.add(patronId);
      const up = byGuest.get(patronId);
      if (!up) break;
      patronId = up.patronId;
      patronName = up.patronName;
    }
    return chain;
  };
}

/* ── Ссылки и ошибки ─────────────────────────────────────────────── */

export function inviteUrl(code: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join?key=${encodeURIComponent(code)}`;
}

/** Ошибка RPC → код из миграции ('quota_exhausted', 'invalid_transition', …) */
export function inviteErrorCode(error: unknown): string | null {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const m = /voyage:([a-z_]+)/.exec(message);
  if (m) return m[1];
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "42501") return "forbidden";
  if (code === "PGRST202" || code === "42883" || /does not exist|schema cache/i.test(message)) return "migration";
  return null;
}

export const circleTitleOf = (key: CircleKey | null | undefined) => CIRCLES.find((c) => c.key === key)?.title ?? null;

/* ── Ключ из ссылки или ручного ввода ────────────────────────────── */

export const INVITE_CODE_RE = /^VYG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** «vyg k7qm 2xrt», «VYGK7QM2XRT», «K7QM2XRT» → «VYG-K7QM-2XRT» (как club_normalize_code в БД) */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  const c = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code =
    c.length === 11 && c.startsWith("VYG")
      ? `VYG-${c.slice(3, 7)}-${c.slice(7, 11)}`
      : c.length === 8
        ? `VYG-${c.slice(0, 4)}-${c.slice(4, 8)}`
        : c;
  return INVITE_CODE_RE.test(code) ? code : null;
}

/** Ответ club_invite_preview (миграция 20261010) */
export type InvitePreviewRow = {
  valid: boolean;
  /** ok | not_found | expired | used | yours */
  reason: string;
  guest_name: string | null;
  patron_first_name: string | null;
  /** «Анна К.» */
  patron_display: string | null;
  patron_circle: string | null;
  patron_circle_key: string | null;
  expires_at: string | null;
  /** статус ключа — только для reason = 'yours' */
  invite_status: string | null;
};

/* ── Доступ к админке приглашений ────────────────────────────────── */

/** Приглашениями управляют только владелец и администраторы (club_is_admin() в БД) */
export const INVITE_ADMIN_ROLES = ["owner", "admin"] as const;
export const canManageInvites = (role: unknown) =>
  typeof role === "string" && (INVITE_ADMIN_ROLES as readonly string[]).includes(role);
