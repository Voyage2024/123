/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Кабинет скаута — типы и разбор ответов RPC
 * lib/scouting/cabinet.ts
 *
 *   voyage_model_readiness   → Readiness (воронка + «чего не хватает»)
 *   voyage_scout_casting_showcase → ShowcaseCasting[]
 *   voyage_my_scout_ledger   → ScoutLedger
 *   voyage_scout_home        → ScoutHome
 *
 * Здесь нет ни документов, ни контактов моделей: только флаги этапов.
 * ──────────────────────────────────────────────────────────────────── */

import { arr, num, numOrNull, obj, str, strOrNull } from "@/lib/tour-ops/types";
import { parseScoutedModels, type ScoutedModel, type ScoutedModels } from "@/lib/scouting/types";

export const NEXT_STEPS = ["restricted", "not_approved", "in_tour", "photo", "review", "kyc_review", "kyc", "open_to_tours", "ready", "waiting"] as const;
export type NextStep = (typeof NEXT_STEPS)[number];
export const NUDGE_KINDS = ["photo", "kyc", "open_to_tours", "casting"] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export type Readiness = {
  photo: boolean;
  kycLevel: number;
  kycPending: number | null;
  approved: boolean;
  status: string;
  restricted: boolean;
  openToTours: boolean;
  openCastings: number;
  openCastingsOk: number;
  requiredKyc: number | null;
  inTour: { city: string; departsAt: string; returnsAt: string | null } | null;
  next: NextStep;
  missing: string[];
  lastSeenDays: number | null;
};

export function parseReadiness(v: unknown): Readiness | null {
  if (!v || typeof v !== "object") return null;
  const r = obj(v);
  const t = r.in_tour ? obj(r.in_tour) : null;
  const next = str(r.next);
  return {
    photo: r.photo === true,
    kycLevel: num(r.kyc_level),
    kycPending: numOrNull(r.kyc_pending),
    approved: r.approved === true,
    status: str(r.status) || "pending",
    restricted: r.restricted === true,
    openToTours: r.open_to_tours === true,
    openCastings: num(r.open_castings),
    openCastingsOk: num(r.open_castings_ok),
    requiredKyc: numOrNull(r.required_kyc),
    inTour: t && str(t.city) ? { city: str(t.city), departsAt: str(t.departs_at), returnsAt: strOrNull(t.returns_at) } : null,
    next: (NEXT_STEPS as readonly string[]).includes(next) ? (next as NextStep) : "waiting",
    missing: arr(r.missing).map(str).filter(Boolean),
    lastSeenDays: numOrNull(r.last_seen_days),
  };
}

/* ── Воронка: шесть этапов в порядке клуба ───────────────────────── */

export const FUNNEL = ["registered", "photo", "kyc1", "kyc2", "approved", "in_tour"] as const;
export type FunnelStep = (typeof FUNNEL)[number];
export type StepState = "done" | "pending" | "todo";

export function funnelStates(r: Readiness, hasTour: boolean): Record<FunnelStep, StepState> {
  return {
    registered: "done",
    photo: r.photo || r.kycLevel > 0 ? "done" : "todo",
    kyc1: r.kycLevel >= 1 ? "done" : r.kycPending === 1 ? "pending" : "todo",
    kyc2: r.kycLevel >= 2 ? "done" : r.kycPending === 2 ? "pending" : "todo",
    approved: r.approved ? "done" : r.status === "pending" ? "pending" : "todo",
    in_tour: r.inTour || hasTour ? "done" : "todo",
  };
}

/** Какое напоминание уместно по текущему шагу (null — напоминать нечего). */
export function nudgeFor(next: NextStep): Exclude<NudgeKind, "casting"> | null {
  if (next === "photo") return "photo";
  if (next === "kyc") return "kyc";
  if (next === "open_to_tours") return "open_to_tours";
  return null;
}

/** Модель можно «подтолкнуть» раз в 20 часов. */
export const NUDGE_COOLDOWN_MS = 20 * 60 * 60 * 1000;
export function nudgeAvailableAt(lastNudgeAt: string | null): number | null {
  if (!lastNudgeAt) return null;
  const at = Date.parse(lastNudgeAt) + NUDGE_COOLDOWN_MS;
  return Number.isFinite(at) && at > Date.now() ? at : null;
}

/* ── Витрина кастингов ───────────────────────────────────────────── */

export type ShowcaseFit = "responded" | "photo" | "kyc" | "open_to_tours" | "ready";
export type ShowcaseModel = { id: string; name: string; avatarUrl: string | null; kycLevel: number; fit: ShowcaseFit };
export type ShowcaseCasting = {
  id: string; city: string; countryCode: string | null; project: string; startsOn: string | null; endsOn: string | null;
  closesAt: string; minKycLevel: number; segment: string; fresh: boolean; models: ShowcaseModel[];
};

const FITS: readonly ShowcaseFit[] = ["responded", "photo", "kyc", "open_to_tours", "ready"];

export function parseShowcase(v: unknown): ShowcaseCasting[] {
  return arr(v).map((x) => {
    const c = obj(x);
    return {
      id: str(c.id), city: str(c.city), countryCode: strOrNull(c.country_code), project: str(c.project) || "tour",
      startsOn: strOrNull(c.starts_on), endsOn: strOrNull(c.ends_on), closesAt: str(c.closes_at), minKycLevel: num(c.min_kyc_level),
      segment: str(c.segment) || "all", fresh: c.fresh === true,
      models: arr(c.models).map((y) => {
        const m = obj(y);
        const fit = str(m.fit);
        return {
          id: str(m.id), name: str(m.name) || "—", avatarUrl: strOrNull(m.avatar_url), kycLevel: num(m.kyc_level),
          fit: (FITS as readonly string[]).includes(fit) ? (fit as ShowcaseFit) : "ready",
        };
      }),
    };
  });
}

/* ── Леджер скаута ───────────────────────────────────────────────── */

export type LedgerStatus = "pending" | "paid" | "void";
export type PayoutInfo = { id: string; ref: string; method: string | null; masked: string | null; paidAt: string };
export type LedgerRow = {
  key: string; modelName: string; avatarUrl: string | null; city: string; departsAt: string | null; returnsAt: string | null;
  serviceFrom: string | null; serviceTo: string | null; currency: string; amount: number; status: LedgerStatus;
  voidReason: string | null; adjustments: number; firstAt: string; lastAt: string; paidAt: string | null; payout: PayoutInfo | null;
};
export type ScoutPayout = { id: string; currency: string; amount: number; rows: number; ref: string; method: string | null; masked: string | null; paidAt: string };
export type ScoutTerms = { percent: number; personal: boolean; base: string; windowMonths: number };
export type ScoutLedger = {
  totals: { currency: string; pending: number; paid: number }[];
  terms: ScoutTerms;
  payoutMethod: string | null;
  payoutMasked: string | null;
  rows: LedgerRow[];
  payouts: ScoutPayout[];
};

const payoutOf = (v: unknown): PayoutInfo | null => {
  if (!v || typeof v !== "object") return null;
  const p = obj(v);
  return { id: str(p.id), ref: str(p.ref), method: strOrNull(p.method), masked: strOrNull(p.masked), paidAt: str(p.paid_at) };
};

export function parseLedger(v: unknown): ScoutLedger {
  const r = obj(v);
  const t = obj(r.terms);
  return {
    totals: arr(r.totals).map((x) => {
      const o = obj(x);
      return { currency: str(o.currency) || "USD", pending: num(o.pending), paid: num(o.paid) };
    }),
    terms: { percent: num(t.percent), personal: t.personal === true, base: str(t.base) || "total", windowMonths: num(t.window_months) },
    payoutMethod: strOrNull(r.payout_method),
    payoutMasked: strOrNull(r.payout_masked),
    rows: arr(r.rows).map((x) => {
      const o = obj(x);
      const st = str(o.status);
      return {
        key: str(o.key), modelName: str(o.model_name) || "—", avatarUrl: strOrNull(o.avatar_url), city: str(o.city),
        departsAt: strOrNull(o.departs_at), returnsAt: strOrNull(o.returns_at), serviceFrom: strOrNull(o.service_from), serviceTo: strOrNull(o.service_to),
        currency: str(o.currency) || "USD", amount: num(o.amount), status: st === "paid" || st === "void" ? st : "pending",
        voidReason: strOrNull(o.void_reason), adjustments: num(o.adjustments), firstAt: str(o.first_at), lastAt: str(o.last_at),
        paidAt: strOrNull(o.paid_at), payout: payoutOf(o.payout),
      };
    }),
    payouts: arr(r.payouts).map((x) => {
      const o = obj(x);
      return {
        id: str(o.id), currency: str(o.currency) || "USD", amount: num(o.amount), rows: num(o.rows), ref: str(o.ref),
        method: strOrNull(o.method), masked: strOrNull(o.masked), paidAt: str(o.paid_at),
      };
    }),
  };
}

/* ── Профиль скаута ──────────────────────────────────────────────── */

export const PAYOUT_METHODS = ["usdt_trc20", "usdt_erc20", "bank_transfer", "other"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export type ScoutHome = {
  role: string; displayName: string; telegramUsername: string | null; hasTelegram: boolean; phone: string | null;
  since: string | null; referredBy: string | null;
  terms: ScoutTerms & { platformPercent: number; rateSetAt: string | null };
  payout: { method: PayoutMethod | null; details: string | null; holder: string | null; updatedAt: string | null };
  counts: { models: number; invitesActive: number };
};

export function parseScoutHome(v: unknown): ScoutHome | null {
  if (!v || typeof v !== "object") return null;
  const r = obj(v);
  const p = obj(r.profile);
  const t = obj(r.terms);
  const pay = obj(r.payout);
  const c = obj(r.counts);
  const method = str(pay.method);
  return {
    role: str(p.role), displayName: str(p.display_name) || "—", telegramUsername: strOrNull(p.telegram_username),
    hasTelegram: p.has_telegram === true, phone: strOrNull(p.phone), since: strOrNull(p.since), referredBy: strOrNull(p.referred_by),
    terms: {
      percent: num(t.percent), personal: t.personal === true, base: str(t.base) || "total", windowMonths: num(t.window_months),
      platformPercent: num(t.platform_percent), rateSetAt: strOrNull(t.rate_set_at),
    },
    payout: {
      method: (PAYOUT_METHODS as readonly string[]).includes(method) ? (method as PayoutMethod) : null,
      details: strOrNull(pay.details), holder: strOrNull(pay.holder), updatedAt: strOrNull(pay.updated_at),
    },
    counts: { models: num(c.models), invitesActive: num(c.invites_active) },
  };
}

/** Клиентская проверка формата (сервер проверяет то же самое). */
export function payoutFormatOk(method: PayoutMethod, details: string): "ok" | "wallet" | "card" | "empty" {
  const v = details.trim();
  if (!v) return "empty";
  if (method === "usdt_trc20") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v) ? "ok" : "wallet";
  if (method === "usdt_erc20") return /^0x[0-9a-fA-F]{40}$/.test(v) ? "ok" : "wallet";
  if (/^[0-9 -]+$/.test(v) && /^[0-9]{13,19}$/.test(v.replace(/[^0-9]/g, ""))) return "card";
  return "ok";
}

/* ── «Мои модели» с воронкой (voyage_my_scouted_models) ─────────── */

export type CabinetModel = ScoutedModel & { readiness: Readiness | null; lastNudgeAt: string | null };
export type CabinetModels = Omit<ScoutedModels, "models"> & { models: CabinetModel[] };

export function parseCabinetModels(v: unknown): CabinetModels {
  const base = parseScoutedModels(v);
  const raw = arr(obj(v).models);
  return {
    ...base,
    models: base.models.map((m, i) => {
      const r = obj(raw[i]);
      return { ...m, readiness: parseReadiness(r.readiness), lastNudgeAt: strOrNull(r.last_nudge_at) };
    }),
  };
}
