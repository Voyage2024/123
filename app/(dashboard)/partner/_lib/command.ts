/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER COMMAND — данные Штаба
 * app/(dashboard)/partner/_lib/command.ts
 *
 *   типы          модель экрана (время — в мс, даты кастинга — локальная полночь)
 *   buildMock()   демо-данные для утверждения визуала
 *   fetchCommand  RPC public.partner_command() — один запрос под RLS:
 *                 миграция supabase/migrations/20261011120000_partner_command.sql
 *   parseSnapshot разбор ответа с проверкой каждого поля: если схема в БД
 *                 разъедется с клиентом, экран покажет пустой блок, а не упадёт
 * ──────────────────────────────────────────────────────────────────── */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY, HOUR, MIN } from "./clock";

/* ══════════════════════════════════════════════════════════════════
 * ТИПЫ
 * ══════════════════════════════════════════════════════════════════ */

export type ProjectKey = "shoot" | "show" | "campaign" | "event";
export type KeyTier = "silver" | "gold" | "platinum";
export type Payer = "manager" | "participant" | "split";

export type ManagerSnapshot = {
  tier: KeyTier;
  nextTier: KeyTier | null;
  /** Счётчик до следующего Ключа: всего закрытых туров (Silver) или за 12 мес. (Gold) */
  toursDone: number;
  toursForNext: number | null;
  /** Долетели / подтверждено за 12 месяцев — из них Show Rate */
  flown: number;
  confirmed: number;
  /** Средняя оценка от резиденток; null — оценок ещё нет */
  rating: number | null;
  reviews: number;
};

/** Надёжность резидентки — только факты внутри Voyage */
export type Trust = { flown: number; rating: number | null; reviews: number; trusted: boolean };

export type AlertKind = "option" | "contract" | "docs" | "replacement" | "responses";
export type AlertItem = {
  id: string;
  kind: AlertKind;
  city: string;
  project: ProjectKey;
  count?: number;
  code?: string;
  /** contract: сколько подписей есть и сколько нужно; required = null — контракт не создан */
  signed?: number | null;
  required?: number | null;
  /** option/contract/docs — срок впереди; replacement/responses — когда случилось */
  at: number;
  castingId?: string;
  tourId?: string;
};

export type Responder = {
  /** Слепой код до рукопожатия — #K-417 */
  code: string;
  /** Рукопожатие по этому кастингу состоялось: участница в составе тура */
  handshake: boolean;
  /** Профиль и имя — только после рукопожатия (владелец и админ видят всегда) */
  residentId: string | null;
  name: string | null;
  /** Последний Live Snap; null — снапов нет */
  snapAt: number | null;
  trusted: boolean;
};

export type CastingItem = {
  id: string;
  city: string;
  project: ProjectKey;
  startsAt: number;
  endsAt: number;
  slots: number;
  /** Новых «Готова» с последнего просмотра */
  fresh: number;
  closesAt: number;
  stage: "open" | "shortlist";
  responders: Responder[];
};

export type ContractTerms = {
  flightPaidBy: Payer;
  hotelPaidBy: Payer;
  /** Как записали стороны: «50/50» */
  feeSplit: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  /** Бесплатная отмена не позже чем за N часов до вылета */
  cancelFreeHours: number | null;
};

export type Contract = {
  version: number;
  signed: number;
  required: number;
  /** Когда поставлена последняя нужная подпись; null — ещё не подписан всеми */
  sealedAt: number | null;
  terms: ContractTerms;
};

export type FlightStatus = "confirmed" | "contract" | "docs" | "replacement";
export type CrewMember = { id: string | null; name: string; docs: boolean; signed: boolean };

export type FlightItem = {
  id: string;
  city: string;
  iata: string | null;
  project: ProjectKey;
  flightNo: string | null;
  departsAt: number;
  status: FlightStatus;
  crew: CrewMember[];
  /** Имя участницы, которая заменила сорвавшуюся, и её профиль */
  replacement: string | null;
  replacementId: string | null;
  /** null — контракт для тура ещё не создан */
  contract: Contract | null;
};

export type BlacklistReason = "noShow" | "fakePhotos" | "fraud";
export type BlacklistItem = {
  id: string;
  code: string;
  /** Профиль открыт, если у менеджера с ней было рукопожатие (админ — всегда) */
  residentId: string | null;
  name: string | null;
  reason: BlacklistReason;
  status: "confirmed" | "appeal";
  at: number;
};

export type VerifiedItem = {
  /** null — анкета ещё в раннем доступе старшего Ключа: БД не отдаёт ни id, ни имя */
  id: string | null;
  name: string | null;
  city: string | null;
  height: number | null;
  at: number;
  earlyOpensAt: number | null;
  snapAt: number | null;
  trust: Trust;
};

export type ReviewTag = "punctual" | "professional" | "matchesSnaps" | "communicative" | "teamPlayer";
export type ReviewItem = {
  id: string;
  residentId: string | null;
  resident: string;
  rating: number;
  tags: ReviewTag[];
  quote: string | null;
  authorTier: KeyTier;
  city: string;
  at: number;
  trust: Trust;
};

export type CommandData = {
  generatedAt: number;
  manager: ManagerSnapshot;
  alerts: AlertItem[];
  castings: CastingItem[];
  flights: FlightItem[];
  blacklist: BlacklistItem[];
  verified: VerifiedItem[];
  reviews: ReviewItem[];
  /** Никого из тех, кого держит менеджер (состав, опцион), нет в Blacklist */
  clean: boolean;
};

/* ══════════════════════════════════════════════════════════════════
 * МОКИ
 * ══════════════════════════════════════════════════════════════════ */

const STANDARD_TERMS: ContractTerms = {
  flightPaidBy: "manager",
  hotelPaidBy: "manager",
  feeSplit: "50/50",
  feeAmount: 1200,
  feeCurrency: "USD",
  cancelFreeHours: 72,
};

export function buildMock(): CommandData {
  const t = Date.now();
  const midnight = new Date(t);
  midnight.setHours(0, 0, 0, 0);
  const d0 = midnight.getTime();

  const blind = (code: string, snapAt: number | null, trusted: boolean): Responder => ({
    code, handshake: false, residentId: null, name: null, snapAt, trusted,
  });
  const trust = (flown: number, rating: number | null, reviews: number): Trust => ({
    flown,
    rating,
    reviews,
    trusted: flown >= 3 && reviews >= 3 && (rating ?? 0) >= 4.5,
  });

  return {
    generatedAt: t,
    manager: {
      tier: "gold",
      nextTier: "platinum",
      toursDone: 7,
      toursForNext: 10,
      flown: 23,
      confirmed: 24,
      rating: 4.8,
      reviews: 19,
    },
    alerts: [
      { id: "al-1", kind: "option", city: "Milan", project: "show", code: "#A-417", at: t + HOUR + 58 * MIN, castingId: "cs-mxp-02" },
      { id: "al-2", kind: "contract", city: "Paris", project: "shoot", signed: 1, required: 4, at: t + 9 * DAY, tourId: "tr-cdg-09" },
      { id: "al-3", kind: "docs", city: "Sydney", project: "shoot", count: 2, at: t + 46 * HOUR, tourId: "tr-syd-03" },
      { id: "al-4", kind: "replacement", city: "Dubai", project: "event", at: t - 35 * MIN, tourId: "tr-dxb-05" },
      { id: "al-5", kind: "responses", city: "Dubai", project: "campaign", count: 3, at: t - 12 * MIN, castingId: "cs-dxb-01" },
    ],
    castings: [
      {
        id: "cs-dxb-01", city: "Dubai", project: "campaign",
        startsAt: d0 + 9 * DAY, endsAt: d0 + 13 * DAY,
        slots: 4, fresh: 3, closesAt: t + 18 * HOUR, stage: "open",
        responders: [
          blind("#A-417", t - 2 * HOUR, true),
          blind("#B-102", t - 5 * HOUR, true),
          blind("#C-233", t - 9 * HOUR, false),
          blind("#A-981", t - 20 * HOUR, true),
          blind("#E-655", t - 3 * DAY, false),
          blind("#G-071", t - 12 * DAY, false),
          blind("#H-390", null, false),
        ],
      },
      {
        id: "cs-mxp-02", city: "Milan", project: "show",
        startsAt: d0 + 14 * DAY, endsAt: d0 + 16 * DAY,
        slots: 2, fresh: 0, closesAt: t + 5 * HOUR + 20 * MIN, stage: "shortlist",
        responders: [
          // рукопожатие состоялось — код открылся в имя и профиль
          { code: "#B-777", handshake: true, residentId: "rs-1039", name: "Veronika M.", snapAt: t - 7 * HOUR, trusted: true },
          { code: "#M-212", handshake: true, residentId: "rs-1033", name: "Sofia L.", snapAt: t - 15 * HOUR, trusted: false },
          blind("#A-417", t - 2 * HOUR, true),
          blind("#E-310", t - 26 * HOUR, false),
          blind("#K-640", t - 4 * DAY, false),
        ],
      },
      {
        id: "cs-cdg-03", city: "Paris", project: "shoot",
        startsAt: d0 + 21 * DAY, endsAt: d0 + 22 * DAY,
        slots: 3, fresh: 1, closesAt: t + 2 * DAY + 4 * HOUR, stage: "open",
        responders: [blind("#F-018", t - 40 * MIN, false)],
      },
    ],
    flights: [
      {
        id: "tr-dxb-05", city: "Dubai", iata: "DXB", project: "event", flightNo: "EK 132",
        departsAt: t + 6 * HOUR + 40 * MIN, status: "replacement",
        crew: [
          { id: "rs-1039", name: "Veronika M.", docs: true, signed: true },
          { id: "rs-1033", name: "Sofia L.", docs: true, signed: true },
          { id: "rs-1050", name: "Nika V.", docs: true, signed: true },
        ],
        replacement: "Nika V.",
        replacementId: "rs-1050",
        contract: { version: 2, signed: 4, required: 4, sealedAt: t - 30 * MIN, terms: STANDARD_TERMS },
      },
      {
        id: "tr-syd-03", city: "Sydney", iata: "SYD", project: "shoot", flightNo: "QF 2",
        departsAt: t + 46 * HOUR, status: "docs",
        crew: [
          { id: "rs-1042", name: "Alina S.", docs: true, signed: true },
          { id: "rs-1051", name: "Mia T.", docs: false, signed: true },
          { id: "rs-1052", name: "Ana R.", docs: false, signed: true },
          { id: "rs-1053", name: "Kate I.", docs: true, signed: true },
        ],
        replacement: null,
        replacementId: null,
        contract: { version: 1, signed: 5, required: 5, sealedAt: t - 6 * DAY, terms: { ...STANDARD_TERMS, hotelPaidBy: "split" } },
      },
      {
        id: "tr-mxp-07", city: "Milan", iata: "MXP", project: "show", flightNo: "EK 205",
        departsAt: t + 63 * HOUR, status: "contract",
        crew: [
          { id: "rs-1039", name: "Veronika M.", docs: true, signed: true },
          { id: "rs-1047", name: "Lena P.", docs: true, signed: false },
        ],
        replacement: null,
        replacementId: null,
        contract: { version: 1, signed: 2, required: 3, sealedAt: null, terms: { ...STANDARD_TERMS, flightPaidBy: "participant" } },
      },
    ],
    blacklist: [
      // бывшая участница вашего тура — профиль открыт
      { id: "bl-1", code: "#R-204", residentId: "rs-0988", name: "Dasha O.", reason: "noShow", status: "confirmed", at: t - 3 * HOUR },
      { id: "bl-2", code: "#R-187", residentId: null, name: null, reason: "fakePhotos", status: "appeal", at: t - 26 * HOUR },
      { id: "bl-3", code: "#R-152", residentId: null, name: null, reason: "fraud", status: "confirmed", at: t - 3 * DAY },
    ],
    verified: [
      { id: null, name: null, city: "Paris", height: 180, at: t - 20 * MIN, earlyOpensAt: t + 23 * HOUR + 40 * MIN, snapAt: t - 25 * MIN, trust: trust(0, null, 0) },
      { id: "rs-1042", name: "Alina S.", city: "Dubai", height: 178, at: t - 26 * HOUR, earlyOpensAt: null, snapAt: t - 2 * HOUR, trust: trust(6, 4.9, 5) },
      { id: "rs-1039", name: "Veronika M.", city: "Milan", height: 176, at: t - 3 * DAY, earlyOpensAt: null, snapAt: t - 30 * HOUR, trust: trust(2, 4.5, 2) },
      { id: "rs-1047", name: "Lena P.", city: "Sydney", height: 175, at: t - 5 * DAY, earlyOpensAt: null, snapAt: t - 11 * DAY, trust: trust(0, null, 0) },
    ],
    reviews: [
      {
        id: "rv-1", residentId: "rs-1042", resident: "Alina S.", rating: 5,
        tags: ["punctual", "matchesSnaps", "professional"],
        quote: "Пунктуальна, на площадке — как на снапах. Берём снова.",
        authorTier: "platinum", city: "Dubai", at: t - 2 * DAY, trust: trust(6, 4.9, 5),
      },
      {
        id: "rv-2", residentId: "rs-1033", resident: "Sofia L.", rating: 5,
        tags: ["communicative", "teamPlayer"], quote: null,
        authorTier: "gold", city: "Milan", at: t - 4 * DAY, trust: trust(4, 4.8, 4),
      },
    ],
    clean: true,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * SUPABASE
 * ══════════════════════════════════════════════════════════════════ */

export class CommandError extends Error {
  constructor(
    public reason: "forbidden" | "missing" | "network" | "unknown",
    message: string,
  ) {
    super(message);
  }
}

export async function fetchCommand(supabase: SupabaseClient): Promise<CommandData> {
  const { data, error } = await supabase.rpc("partner_command");
  if (error) {
    // 42501 — роль не manager/admin/owner; PGRST202 — миграция не применена
    const reason =
      error.code === "42501" ? "forbidden" : error.code === "PGRST202" ? "missing" : !error.code ? "network" : "unknown";
    throw new CommandError(reason, error.message);
  }
  return parseSnapshot(data);
}

/* ── разбор ответа ─────────────────────────────────────────────── */

export type Raw = Record<string, unknown>;

export const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
export const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(+v) ? +v : null;
export const time = (v: unknown): number | null => {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};
/** «2026-10-20» → локальная полночь (Date.parse считал бы её UTC и сдвигал день к западу от Гринвича) */
export const day = (v: unknown): number | null => {
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
};
export const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;

export const PROJECTS = ["shoot", "show", "campaign", "event"] as const;
export const TIERS = ["silver", "gold", "platinum"] as const;
export const PAYERS = ["manager", "participant", "split"] as const;
const ALERT_KINDS = ["option", "contract", "docs", "replacement", "responses"] as const;
const FLIGHT_STATUSES = ["confirmed", "contract", "docs", "replacement"] as const;
export const BLACKLIST_REASON: Record<string, BlacklistReason> = { no_show: "noShow", fake_photos: "fakePhotos", fraud: "fraud" };
export const REVIEW_TAG: Record<string, ReviewTag> = {
  punctual: "punctual",
  professional: "professional",
  matches_snaps: "matchesSnaps",
  communicative: "communicative",
  team_player: "teamPlayer",
};

/** Отбрасывает элементы, которые не удалось разобрать */
export function list<T>(v: unknown, map: (r: Raw) => T | null): T[] {
  return arr(v).flatMap((x) => {
    const out = map(obj(x));
    return out === null ? [] : [out];
  });
}

export function parseTrust(v: unknown): Trust {
  const r = obj(v);
  return {
    flown: num(r.flown) ?? 0,
    rating: num(r.rating),
    reviews: num(r.reviews) ?? 0,
    trusted: r.trusted === true,
  };
}

/** Условия контракта из jsonb БД (snake_case) */
export function parseTerms(v: unknown): ContractTerms | null {
  const tr = obj(v);
  const flightPaidBy = oneOf(tr.flight_paid_by, PAYERS);
  const hotelPaidBy = oneOf(tr.hotel_paid_by, PAYERS);
  if (!flightPaidBy || !hotelPaidBy) return null;
  return {
    flightPaidBy,
    hotelPaidBy,
    feeSplit: str(tr.fee_split) ?? "—",
    feeAmount: num(tr.fee_amount),
    feeCurrency: str(tr.fee_currency),
    cancelFreeHours: num(tr.cancel_free_hours),
  };
}

/** Условия → jsonb для БД (обратное parseTerms) */
export function termsToDb(t: ContractTerms) {
  return {
    flight_paid_by: t.flightPaidBy,
    hotel_paid_by: t.hotelPaidBy,
    fee_split: t.feeSplit,
    ...(t.feeAmount !== null ? { fee_amount: t.feeAmount } : {}),
    ...(t.feeCurrency ? { fee_currency: t.feeCurrency } : {}),
    ...(t.cancelFreeHours !== null ? { cancel_free_hours: t.cancelFreeHours } : {}),
  };
}

export function parseContract(v: unknown): Contract | null {
  if (!v || typeof v !== "object") return null;
  const r = obj(v);
  const terms = parseTerms(r.terms);
  const version = num(r.version);
  if (!terms || version === null) return null;
  return {
    version,
    signed: num(r.signed) ?? 0,
    required: num(r.required) ?? 0,
    sealedAt: time(r.sealed_at),
    terms,
  };
}

/** Ключ и показатели менеджера — partner_manager_stats() */
export function parseManager(v: unknown): ManagerSnapshot {
  const m = obj(v);
  return {
    tier: oneOf(m.tier, TIERS) ?? "silver",
    nextTier: oneOf(m.next_tier, TIERS),
    toursDone: num(m.tours_done) ?? 0,
    toursForNext: num(m.tours_for_next),
    flown: num(m.flown) ?? 0,
    confirmed: num(m.confirmed) ?? 0,
    rating: num(m.rating),
    reviews: num(m.reviews) ?? 0,
  };
}

export function parseResponder(x: Raw): Responder | null {
  const code = str(x.code);
  if (!code) return null;
  return {
    code,
    handshake: x.handshake === true,
    residentId: str(x.resident_id),
    name: str(x.name),
    snapAt: time(x.snap_at),
    trusted: x.trusted === true,
  };
}

export function parseCrewMember(x: Raw): CrewMember {
  return { id: str(x.id), name: str(x.name) ?? "—", docs: x.docs === true, signed: x.signed === true };
}

export function parseSnapshot(raw: unknown): CommandData {
  const root = obj(raw);
  const manager = parseManager(root.manager);

  const alerts = list<AlertItem>(root.alerts, (r) => {
    const id = str(r.id);
    const kind = oneOf(r.kind, ALERT_KINDS);
    const project = oneOf(r.project, PROJECTS);
    const at = time(r.at);
    if (!id || !kind || !project || at === null) return null;
    return {
      id,
      kind,
      city: str(r.city) ?? "—",
      project,
      count: num(r.count) ?? undefined,
      code: str(r.code) ?? undefined,
      signed: num(r.signed),
      required: num(r.required),
      at,
      castingId: str(r.casting_id) ?? undefined,
      tourId: str(r.tour_id) ?? undefined,
    };
  });

  const castings = list<CastingItem>(root.castings, (r) => {
    const id = str(r.id);
    const project = oneOf(r.project, PROJECTS);
    const startsAt = day(r.starts_on);
    const endsAt = day(r.ends_on);
    const closesAt = time(r.closes_at);
    if (!id || !project || startsAt === null || endsAt === null || closesAt === null) return null;
    return {
      id,
      city: str(r.city) ?? "—",
      project,
      startsAt,
      endsAt,
      slots: num(r.slots) ?? 1,
      fresh: num(r.fresh) ?? 0,
      closesAt,
      stage: oneOf(r.stage, ["open", "shortlist"] as const) ?? "open",
      responders: list<Responder>(r.responders, parseResponder),
    };
  });

  const flights = list<FlightItem>(root.tours, (r) => {
    const id = str(r.id);
    const project = oneOf(r.project, PROJECTS);
    const departsAt = time(r.departs_at);
    if (!id || !project || departsAt === null) return null;
    return {
      id,
      city: str(r.city) ?? "—",
      iata: str(r.iata),
      project,
      flightNo: str(r.flight_no),
      departsAt,
      status: oneOf(r.status, FLIGHT_STATUSES) ?? "confirmed",
      crew: list<CrewMember>(r.crew, parseCrewMember),
      replacement: str(r.replacement),
      replacementId: str(r.replacement_id),
      contract: parseContract(r.contract),
    };
  });

  const blacklist = list<BlacklistItem>(root.blacklist, (r) => {
    const id = str(r.id);
    const reason = typeof r.reason === "string" ? BLACKLIST_REASON[r.reason] : undefined;
    const at = time(r.at);
    if (!id || !reason || at === null) return null;
    return {
      id,
      code: str(r.code) ?? "—",
      residentId: str(r.resident_id),
      name: str(r.name),
      reason,
      status: oneOf(r.status, ["confirmed", "appeal"] as const) ?? "confirmed",
      at,
    };
  });

  const verified = list<VerifiedItem>(root.verified, (r) => {
    const at = time(r.at);
    if (at === null) return null;
    return {
      id: str(r.id),
      name: str(r.name),
      city: str(r.city),
      height: num(r.height),
      at,
      earlyOpensAt: time(r.early_opens_at),
      snapAt: time(r.snap_at),
      trust: parseTrust(r.trust),
    };
  });

  const reviews = list<ReviewItem>(root.reviews, (r) => {
    const id = str(r.id);
    const rating = num(r.rating);
    const at = time(r.at);
    if (!id || rating === null || at === null) return null;
    return {
      id,
      residentId: str(r.resident_id),
      resident: str(r.resident) ?? "—",
      rating,
      tags: arr(r.tags).flatMap((x) => (typeof x === "string" && REVIEW_TAG[x] ? [REVIEW_TAG[x]] : [])),
      quote: str(r.quote),
      authorTier: oneOf(r.author_tier, TIERS) ?? "silver",
      city: str(r.city) ?? "—",
      at,
      trust: parseTrust(r.trust),
    };
  });

  return {
    generatedAt: time(root.generated_at) ?? Date.now(),
    manager,
    alerts,
    castings,
    flights,
    blacklist,
    verified,
    reviews,
    clean: root.clean !== false,
  };
}
