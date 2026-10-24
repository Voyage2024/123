/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — лента кастингов: типы и загрузка
 * app/(dashboard)/dashboard/_lib/castingFeed.ts
 *
 * Что видит резидентка (правила клуба):
 *   · бриф целиком до ответа — город, тип проекта, даты, места,
 *     гонорар, кто платит перелёт и отель, требования;
 *   · менеджера — только по репутации (Ключ, оценка, число туров),
 *     без имени и контактов: до рукопожатия никаких личных сообщений;
 *   · только кастинги, куда её пустит база (partner_me_can_respond):
 *     полная верификация, тумблер «Открыта к турам», не в Blacklist,
 *     кастинг открыт и не истёк.
 *
 * Данные — RPC public.partner_resident_feed(), миграция
 * supabase/migrations/20261015120000_partner_resident_feed.sql
 * ──────────────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase";
import {
  PAYERS,
  toProjectKey,
  arr,
  num,
  obj,
  oneOf,
  str,
  time,
  type KeyTier,
  type Payer,
  type ProjectKey,
  type Raw,
} from "@/app/(dashboard)/partner/_lib/command";

/**
 * Отклик резидентки — partner_casting_responses.status, null — ещё не откликалась.
 *   ready     нажала «Готова в тур», ждёт ответа менеджера
 *   option    менеджер поставил опцион — мягкая бронь до option_expires_at
 *   selected  рукопожатие: она в составе тура
 *   withdrawn сама отозвала отклик (можно откликнуться снова)
 * declined в ленту не попадает: кастинг для неё скрыт.
 */
export type ResponseStatus = "ready" | "option" | "selected" | "withdrawn";

export type FeedCasting = {
  id: string;
  city: string;
  audienceSegment: "all" | "working" | "elite";
  project: ProjectKey;
  startsAt: number;
  endsAt: number;
  slots: number;
  closesAt: number;
  fee: { amount: number; currency: string } | null;
  flightPaidBy: Payer;
  hotelPaidBy: Payer;
  heightMin: number | null;
  /** ISO 639-1 */
  languages: string[];
  /** Текст брифа — как его написал менеджер */
  note: string | null;
  /** Менеджер без имени — только репутация */
  manager: { tier: KeyTier; rating: number | null; tours: number };
  /** Организатор: у клуба — имя и Official Club, у партнёра — только бейдж (имя после рукопожатия) */
  organizer: { official: boolean; badge: "official_club" | "verified" | null; name: string | null };
  /** Кастинг опубликован после последнего визита резидентки */
  fresh: boolean;
  response: { status: ResponseStatus; at: number; optionUntil: number | null } | null;
};

export type ResidentProfile = {
  height: number | null;
  languages: string[];
  /** «Открыта к турам» — partner_resident_settings.open_to_tours */
  openToTours: boolean;
};

export type CastingFeedData = {
  generatedAt: number;
  me: ResidentProfile;
  castings: FeedCasting[];
};

/* ══════════════════════════════════════════════════════════════════
 * ЗАГРУЗКА
 * ══════════════════════════════════════════════════════════════════ */

export async function fetchCastingFeed(): Promise<CastingFeedData> {
  const { data, error } = await supabase.rpc("partner_resident_feed");
  if (error) throw new Error(error.message);
  return parseFeed(data);
}

/* ══════════════════════════════════════════════════════════════════
 * РАЗБОР ОТВЕТА
 * Каждое поле проверяется: кривая запись выпадает из ленты, остальные
 * кастинги не страдают
 * ══════════════════════════════════════════════════════════════════ */

const TIERS = ["silver", "gold", "platinum"] as const;
const RESPONSE_STATUSES = ["ready", "option", "selected", "withdrawn"] as const;

/** «2026-10-20» → локальная полночь (Date.parse сдвинул бы день к западу от Гринвича) */
const day = (v: unknown): number | null => {
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
};

const langs = (v: unknown): string[] =>
  arr(v).flatMap((x) => (typeof x === "string" && /^[A-Z]{2}$/.test(x) ? [x] : []));

function parseResponse(v: unknown): FeedCasting["response"] {
  if (!v || typeof v !== "object") return null;
  const r = obj(v);
  const status = oneOf(r.status, RESPONSE_STATUSES);
  if (!status) return null;
  return {
    status,
    at: time(r.at) ?? Date.now(),
    optionUntil: time(r.option_until),
  };
}

function parseCasting(r: Raw): FeedCasting | null {
  const id = str(r.id);
  const project = toProjectKey(r.project);
  const startsAt = day(r.starts_on);
  const endsAt = day(r.ends_on);
  const closesAt = time(r.closes_at);
  if (!id || !project || startsAt === null || endsAt === null || closesAt === null) return null;

  const feeAmount = num(r.fee_amount);
  const feeCurrency = str(r.fee_currency);
  const m = obj(r.manager);

  return {
    id,
    city: str(r.city) ?? "—",
    audienceSegment: oneOf(r.audience_segment, ["all", "working", "elite"] as const) ?? "working",
    project,
    startsAt,
    endsAt,
    slots: num(r.slots) ?? 1,
    closesAt,
    fee: feeAmount !== null && feeCurrency ? { amount: feeAmount, currency: feeCurrency } : null,
    flightPaidBy: oneOf(r.flight_paid_by, PAYERS) ?? "manager",
    hotelPaidBy: oneOf(r.hotel_paid_by, PAYERS) ?? "manager",
    heightMin: num(r.height_min),
    languages: langs(r.languages),
    note: str(r.brief),
    manager: {
      tier: oneOf(m.tier, TIERS) ?? "silver",
      rating: num(m.rating),
      tours: num(m.tours) ?? 0,
    },
    organizer: (() => {
      const o = obj(r.organizer);
      return {
        official: o.official === true,
        badge: oneOf(o.badge, ["official_club", "verified"] as const),
        name: str(o.name),
      };
    })(),
    fresh: r.fresh === true,
    response: parseResponse(r.response),
  };
}

export function parseFeed(raw: unknown): CastingFeedData {
  const root = obj(raw);
  const me = obj(root.me);
  return {
    generatedAt: time(root.generated_at) ?? Date.now(),
    me: {
      height: num(me.height),
      languages: langs(me.languages),
      openToTours: me.open_to_tours === true,
    },
    castings: arr(root.castings).flatMap((x) => {
      const c = parseCasting(obj(x));
      return c ? [c] : [];
    }),
  };
}
