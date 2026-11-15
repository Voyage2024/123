/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Скаутинг — типы и разбор ответов RPC
 * lib/scouting/types.ts
 * ──────────────────────────────────────────────────────────────────── */

import { arr, num, obj, str, strOrNull } from "@/lib/tour-ops/types";

export type ScoutedTour = { city: string; departsAt: string; returnsAt: string | null; status: string; own: boolean; tourId: string | null };
export type ScoutedModel = {
  id: string; name: string; avatarUrl: string | null; status: string; kycLevel: number; segment: string | null;
  hasTelegram: boolean; openToTours: boolean; assignedAt: string | null; banned: boolean; tours: ScoutedTour[];
};
export type ScoutClaim = { id: string; status: string; reason: string; createdAt: string; decidedAt: string | null; name: string };
export type OwnTour = { id: string; city: string; departsAt: string; returnsAt: string | null; status: string };
export type ScoutedModels = { models: ScoutedModel[]; claims: ScoutClaim[]; tours: OwnTour[] };

export function parseScoutedModels(v: unknown): ScoutedModels {
  const r = obj(v);
  return {
    models: arr(r.models).map((x) => {
      const m = obj(x);
      return {
        id: str(m.id), name: str(m.name) || "—", avatarUrl: strOrNull(m.avatar_url), status: str(m.status) || "pending",
        kycLevel: num(m.kyc_level), segment: strOrNull(m.segment), hasTelegram: m.has_telegram === true,
        openToTours: m.open_to_tours === true, assignedAt: strOrNull(m.assigned_at), banned: m.banned === true,
        tours: arr(m.tours).map((y) => {
          const t = obj(y);
          return { city: str(t.city), departsAt: str(t.departs_at), returnsAt: strOrNull(t.returns_at), status: str(t.status), own: t.own === true, tourId: strOrNull(t.tour_id) };
        }),
      };
    }),
    claims: arr(r.claims).map((x) => {
      const c = obj(x);
      return { id: str(c.id), status: str(c.status), reason: str(c.reason), createdAt: str(c.created_at), decidedAt: strOrNull(c.decided_at), name: str(c.name) || "—" };
    }),
    tours: parseOwnTours(r.tours),
  };
}

export function parseOwnTours(v: unknown): OwnTour[] {
  return arr(v).map((x) => {
    const t = obj(x);
    return { id: str(t.id), city: str(t.city), departsAt: str(t.departs_at), returnsAt: strOrNull(t.returns_at), status: str(t.status) };
  });
}

/* ── прямые приглашения тура ─────────────────────────────────────── */

export type DirectInvite = {
  id: string; residentId: string; name: string; avatarUrl: string | null; kycLevel: number; status: string;
  message: string | null; expiresAt: string; respondedAt: string | null; createdAt: string; notified: boolean;
};
export type InviteCandidate = { id: string; name: string; avatarUrl: string | null; kycLevel: number; segment: string | null; block: string | null };
export type TourDirectInvites = { invites: DirectInvite[]; candidates: InviteCandidate[] };

export function parseTourDirectInvites(v: unknown): TourDirectInvites {
  const r = obj(v);
  return {
    invites: arr(r.invites).map((x) => {
      const i = obj(x);
      return {
        id: str(i.id), residentId: str(i.resident_id), name: str(i.name) || "—", avatarUrl: strOrNull(i.avatar_url), kycLevel: num(i.kyc_level),
        status: str(i.status), message: strOrNull(i.message), expiresAt: str(i.expires_at), respondedAt: strOrNull(i.responded_at),
        createdAt: str(i.created_at), notified: i.notified === true,
      };
    }),
    candidates: arr(r.candidates).map((x) => {
      const c = obj(x);
      return { id: str(c.id), name: str(c.name) || "—", avatarUrl: strOrNull(c.avatar_url), kycLevel: num(c.kyc_level), segment: strOrNull(c.segment), block: strOrNull(c.block) };
    }),
  };
}

/* ── входящие приглашения резидентки ─────────────────────────────── */

export type MyTourInvite = {
  id: string; tourId: string; city: string; countryCode: string | null; project: string | null; departsAt: string; returnsAt: string | null;
  tourStatus: string; managerName: string; message: string | null; expiresAt: string; createdAt: string; status: string; busy: boolean;
};
export type MyTourInvites = { scout: { name: string; since: string | null } | null; invites: MyTourInvite[] };

export function parseMyTourInvites(v: unknown): MyTourInvites {
  const r = obj(v);
  const s = r.scout ? obj(r.scout) : null;
  return {
    scout: s && str(s.name) ? { name: str(s.name), since: strOrNull(s.since) } : null,
    invites: arr(r.invites).map((x) => {
      const i = obj(x);
      return {
        id: str(i.id), tourId: str(i.tour_id), city: str(i.city), countryCode: strOrNull(i.country_code), project: strOrNull(i.project),
        departsAt: str(i.departs_at), returnsAt: strOrNull(i.returns_at), tourStatus: str(i.tour_status), managerName: str(i.manager_name),
        message: strOrNull(i.message), expiresAt: str(i.expires_at), createdAt: str(i.created_at), status: str(i.status), busy: i.busy === true,
      };
    }),
  };
}

/* ── бонусы скаута ───────────────────────────────────────────────── */

export type MoneyTotal = { currency: string; pending: number; paid: number };
export type MyBonusRow = {
  modelName: string; avatarUrl: string | null; city: string; departsAt: string | null; returnsAt: string | null; currency: string;
  pending: number; paid: number; lastAt: string; paidAt: string | null; status: "pending" | "paid";
};
export type MyBonuses = { totals: MoneyTotal[]; rows: MyBonusRow[] };

const totals = (v: unknown): MoneyTotal[] =>
  arr(v).map((x) => {
    const t = obj(x);
    return { currency: str(t.currency) || "USD", pending: num(t.pending), paid: num(t.paid) };
  });

export function parseMyBonuses(v: unknown): MyBonuses {
  const r = obj(v);
  return {
    totals: totals(r.totals),
    rows: arr(r.rows).map((x) => {
      const b = obj(x);
      return {
        modelName: str(b.model_name) || "—", avatarUrl: strOrNull(b.avatar_url), city: str(b.city), departsAt: strOrNull(b.departs_at),
        returnsAt: strOrNull(b.returns_at), currency: str(b.currency) || "USD", pending: num(b.pending), paid: num(b.paid),
        lastAt: str(b.last_at), paidAt: strOrNull(b.paid_at), status: b.status === "pending" ? "pending" : "paid",
      };
    }),
  };
}

/* ── касса тура: блок скаут-бонусов ──────────────────────────────── */

export type CashboxScout = { total: number; pending: number; paid: number; byModel: { modelId: string; scoutName: string; amount: number; pending: number; currency: string }[] };

export function parseCashboxScout(v: unknown): CashboxScout | null {
  if (!v || typeof v !== "object") return null;
  const r = obj(v);
  return {
    total: num(r.total), pending: num(r.pending), paid: num(r.paid),
    byModel: arr(r.by_model).map((x) => {
      const m = obj(x);
      return { modelId: str(m.model_id), scoutName: str(m.scout_name), amount: num(m.amount), pending: num(m.pending), currency: str(m.currency) || "USD" };
    }),
  };
}

/* ── owner ───────────────────────────────────────────────────────── */

export type FinanceSettings = { percent: number; base: "total" | "agency"; windowMonths: number; graceDays: number; updatedAt: string | null };
export type OwnerScout = {
  id: string; name: string; models: number; invitesActive: number;
  pending: Record<string, number>; paid: Record<string, number>; withhold: Record<string, number>;
};
export type OwnerPendingRow = {
  id: string; kind: "accrual" | "adjustment"; amount: number; currency: string; percent: number; baseKind: string; baseAmount: number;
  city: string; serviceAt: string | null; tourId: string | null; bookingId: string | null; tourClosed: boolean;
  modelName: string; scoutId: string; scoutName: string; hostName: string; createdAt: string;
};
export type OwnerClaim = {
  id: string; reason: string; createdAt: string; profileId: string; modelName: string; modelCreatedAt: string; modelKyc: number;
  managerId: string; managerName: string; toursDone: number;
};
export type OwnerLogRow = {
  id: string; action: string; createdAt: string; note: string | null; modelName: string;
  fromName: string | null; toName: string | null; actorName: string | null;
};
export type OwnerScoutOverview = {
  settings: FinanceSettings; totals: MoneyTotal[]; scouts: OwnerScout[]; pendingRows: OwnerPendingRow[];
  claims: OwnerClaim[]; log: OwnerLogRow[]; managers: { id: string; name: string }[];
};

const moneyMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(obj(v))) out[k] = num(x);
  return out;
};

export function parseOwnerOverview(v: unknown): OwnerScoutOverview {
  const r = obj(v);
  const s = obj(r.settings);
  return {
    settings: {
      percent: num(s.scout_bonus_percent), base: s.scout_bonus_base === "agency" ? "agency" : "total",
      windowMonths: num(s.scout_bonus_window_months), graceDays: num(s.scout_claim_grace_days), updatedAt: strOrNull(s.updated_at),
    },
    totals: totals(r.totals),
    scouts: arr(r.scouts).map((x) => {
      const m = obj(x);
      return { id: str(m.id), name: str(m.name), models: num(m.models), invitesActive: num(m.invites_active), pending: moneyMap(m.pending), paid: moneyMap(m.paid), withhold: moneyMap(m.withhold) };
    }),
    pendingRows: arr(r.pending_rows).map((x) => {
      const p = obj(x);
      return {
        id: str(p.id), kind: p.kind === "adjustment" ? "adjustment" : "accrual", amount: num(p.amount), currency: str(p.currency) || "USD",
        percent: num(p.percent), baseKind: str(p.base_kind), baseAmount: num(p.base_amount), city: str(p.city), serviceAt: strOrNull(p.service_at),
        tourId: strOrNull(p.tour_id), bookingId: strOrNull(p.booking_id), tourClosed: p.tour_closed === true, modelName: str(p.model_name) || "—",
        scoutId: str(p.scout_id), scoutName: str(p.scout_name), hostName: str(p.host_name), createdAt: str(p.created_at),
      };
    }),
    claims: arr(r.claims).map((x) => {
      const c = obj(x);
      return {
        id: str(c.id), reason: str(c.reason), createdAt: str(c.created_at), profileId: str(c.profile_id), modelName: str(c.model_name) || "—",
        modelCreatedAt: str(c.model_created_at), modelKyc: num(c.model_kyc), managerId: str(c.manager_id), managerName: str(c.manager_name), toursDone: num(c.tours_done),
      };
    }),
    log: arr(r.log).map((x) => {
      const g = obj(x);
      return {
        id: str(g.id), action: str(g.action), createdAt: str(g.created_at), note: strOrNull(g.note), modelName: str(g.model_name) || "—",
        fromName: strOrNull(g.from_name), toName: strOrNull(g.to_name), actorName: strOrNull(g.actor_name),
      };
    }),
    managers: arr(r.managers).map((x) => ({ id: str(obj(x).id), name: str(obj(x).name) })),
  };
}

export type OwnerFoundModel = {
  id: string; name: string; email: string | null; telegramUsername: string | null; kycLevel: number;
  scoutId: string | null; scoutName: string | null; scoutSince: string | null;
};
export function parseFoundModels(v: unknown): OwnerFoundModel[] {
  return arr(v).map((x) => {
    const m = obj(x);
    return {
      id: str(m.id), name: str(m.name) || "—", email: strOrNull(m.email), telegramUsername: strOrNull(m.telegram_username), kycLevel: num(m.kyc_level),
      scoutId: strOrNull(m.scout_id), scoutName: strOrNull(m.scout_name), scoutSince: strOrNull(m.scout_since),
    };
  });
}

/** Ненулевые суммы по валютам: { USD: 50 } → [{ currency, amount }] */
export const sumMoney = (m: Record<string, number>): { currency: string; amount: number }[] =>
  Object.entries(m).filter(([, a]) => a !== 0).map(([currency, amount]) => ({ currency, amount }));

