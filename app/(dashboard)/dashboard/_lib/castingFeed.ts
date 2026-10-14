/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — лента кастингов: типы и демо-данные
 * app/(dashboard)/dashboard/_lib/castingFeed.ts
 *
 * Что видит резидентка (правила клуба):
 *   · бриф целиком до ответа — город, тип проекта, даты, места,
 *     гонорар, кто платит перелёт и отель, требования;
 *   · менеджера — только по репутации (Ключ, оценка, число туров),
 *     без имени и контактов: до рукопожатия никаких личных сообщений;
 *   · только кастинги, куда её пустит база (partner_me_can_respond):
 *     полная верификация, не в Blacklist, кастинг открыт и не истёк.
 *
 * Для живых данных нужна RPC ленты: сейчас резидентка не читает
 * partner_castings (select — только менеджер и админ), а гонорара,
 * оплаты перелёта и отеля, роста и языков в таблице кастинга нет —
 * они есть только в тексте брифа. См. комментарий в конце файла.
 * ──────────────────────────────────────────────────────────────────── */

import { DAY, HOUR, MIN } from "../../partner/_lib/clock";
import type { KeyTier, Payer, ProjectKey } from "../../partner/_lib/command";

/**
 * Отклик резидентки — partner_casting_responses.status, null — ещё не откликалась.
 *   ready     нажала «Готова в тур», ждёт ответа менеджера
 *   option    менеджер поставил опцион — мягкая бронь до option_expires_at
 *   selected  рукопожатие: она в составе тура
 *   withdrawn сама отозвала отклик (можно откликнуться снова)
 */
export type ResponseStatus = "ready" | "option" | "selected" | "withdrawn";

export type FeedCasting = {
  id: string;
  city: string;
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

export function buildCastingFeedMock(): CastingFeedData {
  const t = Date.now();
  const midnight = new Date(t);
  midnight.setHours(0, 0, 0, 0);
  const d0 = midnight.getTime();

  return {
    generatedAt: t,
    me: { height: 176, languages: ["EN", "RU"], openToTours: true },
    castings: [
      {
        id: "cs-mxp-02", city: "Milan", project: "show",
        startsAt: d0 + 14 * DAY, endsAt: d0 + 16 * DAY, slots: 2, closesAt: t + 5 * HOUR + 20 * MIN,
        fee: { amount: 900, currency: "EUR" }, flightPaidBy: "participant", hotelPaidBy: "manager",
        heightMin: 175, languages: ["EN"],
        note: "Неделя моды: два выхода, примерка накануне.",
        manager: { tier: "gold", rating: 4.8, tours: 24 },
        fresh: false,
        response: { status: "option", at: t - 20 * HOUR, optionUntil: t + 30 * HOUR },
      },
      {
        id: "cs-dxb-01", city: "Dubai", project: "campaign",
        startsAt: d0 + 9 * DAY, endsAt: d0 + 13 * DAY, slots: 4, closesAt: t + 18 * HOUR,
        fee: { amount: 1500, currency: "USD" }, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: 172, languages: ["EN"],
        note: "Кампейн бренда купальников: день на яхте, день в студии.",
        manager: { tier: "gold", rating: 4.8, tours: 24 },
        fresh: true,
        response: null,
      },
      {
        id: "cs-cdg-03", city: "Paris", project: "shoot",
        startsAt: d0 + 21 * DAY, endsAt: d0 + 22 * DAY, slots: 3, closesAt: t + 2 * DAY + 4 * HOUR,
        fee: { amount: 1200, currency: "EUR" }, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: 170, languages: ["EN"],
        note: "Лукбук для ювелирного дома, студия в 8-м округе.",
        manager: { tier: "platinum", rating: 4.9, tours: 41 },
        fresh: false,
        response: { status: "ready", at: t - 2 * HOUR, optionUntil: null },
      },
      {
        id: "cs-lhr-04", city: "London", project: "event",
        startsAt: d0 + 18 * DAY, endsAt: d0 + 19 * DAY, slots: 6, closesAt: t + 3 * DAY + 2 * HOUR,
        fee: { amount: 700, currency: "GBP" }, flightPaidBy: "manager", hotelPaidBy: "split",
        heightMin: null, languages: ["EN"],
        note: null,
        manager: { tier: "silver", rating: null, tours: 1 },
        fresh: true,
        response: null,
      },
      {
        id: "cs-mco-05", city: "Monaco", project: "event",
        startsAt: d0 + 30 * DAY, endsAt: d0 + 32 * DAY, slots: 3, closesAt: t + 4 * DAY,
        fee: null, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: 170, languages: ["EN"],
        note: "Гала-ужин, дресс-код black tie.",
        manager: { tier: "gold", rating: 4.6, tours: 9 },
        fresh: false,
        response: null,
      },
    ],
  };
}

/* ──────────────────────────────────────────────────────────────────────
 * ДЛЯ ПОДКЛЮЧЕНИЯ К БАЗЕ
 *
 * 1. Миграция: в partner_castings добавить поля брифа, которые сейчас
 *    живут только в тексте — fee_amount, fee_currency, flight_paid_by,
 *    hotel_paid_by, height_min, languages text[].
 * 2. RPC partner_resident_feed() (security definer, как partner_command):
 *    открытые кастинги (status = 'open', closes_at > now()), только если
 *    у резидентки kyc_level >= 3, open_to_tours = true и её нет в Blacklist;
 *    требования брифа совпадают с профилем; плюс её собственный отклик.
 *    Менеджер — только tier / rating / tours из partner_manager_stats.
 * 3. buildCastingFeedMock() заменить вызовом этой RPC.
 * ──────────────────────────────────────────────────────────────────── */
