/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Кастинги»
 * app/(dashboard)/partner/_lib/castings.ts
 *
 * Пока демо. При подключении к базе buildCastingsMock() заменяет RPC,
 * которая отдаёт кастинги менеджера (partner_castings, manager_id = me)
 * и слепые ответы — как в partner_command(): код вместо имени, пока нет
 * рукопожатия, без контактов.
 * ──────────────────────────────────────────────────────────────────── */

import { DAY, HOUR, MIN } from "./clock";
import type { Payer, ProjectKey, Responder } from "./command";

export type CastingStage = "open" | "shortlist" | "closed" | "cancelled";

export type CastingBrief = {
  id: string;
  city: string;
  project: ProjectKey;
  startsAt: number;
  endsAt: number;
  slots: number;
  /** Новых «Готова» с последнего просмотра */
  fresh: number;
  closesAt: number;
  stage: CastingStage;
  /** Гонорар участницы; null — «по договорённости» */
  fee: { amount: number; currency: string } | null;
  flightPaidBy: Payer;
  hotelPaidBy: Payer;
  heightMin: number | null;
  /** Языки, ISO 639-1 */
  languages: string[];
  /** Текст брифа — как его написал менеджер */
  note: string | null;
  responders: Responder[];
  /** Закрытый кастинг → тур, который из него родился */
  tourId: string | null;
};

export type CastingsData = { generatedAt: number; castings: CastingBrief[] };

export function buildCastingsMock(): CastingsData {
  const t = Date.now();
  const midnight = new Date(t);
  midnight.setHours(0, 0, 0, 0);
  const d0 = midnight.getTime();

  const blind = (code: string, snapAt: number | null, trusted: boolean): Responder => ({
    code, handshake: false, residentId: null, name: null, snapAt, trusted,
  });
  const open = (code: string, residentId: string, name: string, snapAt: number | null, trusted: boolean): Responder => ({
    code, handshake: true, residentId, name, snapAt, trusted,
  });

  return {
    generatedAt: t,
    castings: [
      {
        id: "cs-dxb-01", city: "Dubai", project: "campaign",
        startsAt: d0 + 9 * DAY, endsAt: d0 + 13 * DAY, slots: 4, fresh: 3,
        closesAt: t + 18 * HOUR, stage: "open",
        fee: { amount: 1500, currency: "USD" }, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: 172, languages: ["EN"],
        note: "Кампейн бренда купальников: день на яхте, день в студии.",
        responders: [
          blind("#A-417", t - 2 * HOUR, true),
          blind("#B-102", t - 5 * HOUR, true),
          blind("#C-233", t - 9 * HOUR, false),
          blind("#A-981", t - 20 * HOUR, true),
          blind("#E-655", t - 3 * DAY, false),
          blind("#G-071", t - 12 * DAY, false),
          blind("#H-390", null, false),
        ],
        tourId: null,
      },
      {
        id: "cs-mxp-02", city: "Milan", project: "show",
        startsAt: d0 + 14 * DAY, endsAt: d0 + 16 * DAY, slots: 2, fresh: 0,
        closesAt: t + 5 * HOUR + 20 * MIN, stage: "shortlist",
        fee: { amount: 900, currency: "EUR" }, flightPaidBy: "participant", hotelPaidBy: "manager",
        heightMin: 175, languages: ["EN", "IT"],
        note: "Неделя моды: два выхода, примерка накануне.",
        responders: [
          open("#B-777", "rs-1039", "Veronika M.", t - 7 * HOUR, true),
          open("#M-212", "rs-1033", "Sofia L.", t - 15 * HOUR, false),
          blind("#A-417", t - 2 * HOUR, true),
          blind("#E-310", t - 26 * HOUR, false),
          blind("#K-640", t - 4 * DAY, false),
        ],
        tourId: null,
      },
      {
        id: "cs-cdg-03", city: "Paris", project: "shoot",
        startsAt: d0 + 21 * DAY, endsAt: d0 + 22 * DAY, slots: 3, fresh: 1,
        closesAt: t + 2 * DAY + 4 * HOUR, stage: "open",
        fee: { amount: 1200, currency: "EUR" }, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: 170, languages: ["EN", "FR"],
        note: "Лукбук для ювелирного дома, студия в 8-м округе.",
        responders: [blind("#F-018", t - 40 * MIN, false)],
        tourId: null,
      },
      {
        id: "cs-lhr-04", city: "London", project: "event",
        startsAt: d0 + 18 * DAY, endsAt: d0 + 19 * DAY, slots: 6, fresh: 0,
        closesAt: t + 3 * DAY + 2 * HOUR, stage: "open",
        fee: { amount: 700, currency: "GBP" }, flightPaidBy: "manager", hotelPaidBy: "split",
        heightMin: null, languages: ["EN"],
        note: null,
        responders: [
          blind("#D-550", t - 3 * HOUR, true),
          blind("#P-129", t - 30 * HOUR, false),
          blind("#S-804", t - 6 * DAY, false),
          blind("#T-361", t - 50 * MIN, true),
        ],
        tourId: null,
      },
      {
        id: "cs-mco-05", city: "Monaco", project: "event",
        startsAt: d0 + 30 * DAY, endsAt: d0 + 32 * DAY, slots: 3, fresh: 0,
        closesAt: t + 4 * DAY, stage: "open",
        fee: null, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: 170, languages: ["EN", "FR"],
        note: "Гала-ужин, дресс-код black tie.",
        responders: [],
        tourId: null,
      },
      {
        id: "cs-syd-00", city: "Sydney", project: "shoot",
        startsAt: d0 + 2 * DAY, endsAt: d0 + 6 * DAY, slots: 4, fresh: 0,
        closesAt: t - 9 * DAY, stage: "closed",
        fee: { amount: 1800, currency: "AUD" }, flightPaidBy: "manager", hotelPaidBy: "split",
        heightMin: 174, languages: ["EN"],
        note: null,
        responders: [
          open("#L-301", "rs-1042", "Alina S.", t - 2 * HOUR, true),
          open("#N-415", "rs-1051", "Mia T.", t - 2 * DAY, false),
          open("#Q-022", "rs-1052", "Ana R.", t - 9 * DAY, false),
          open("#R-640", "rs-1053", "Kate I.", t - 20 * HOUR, true),
          blind("#U-119", t - 12 * DAY, false),
          blind("#V-207", null, false),
        ],
        tourId: "tr-syd-03",
      },
      {
        id: "cs-dxb-00", city: "Dubai", project: "event",
        startsAt: d0, endsAt: d0 + 2 * DAY, slots: 3, fresh: 0,
        closesAt: t - 6 * DAY, stage: "closed",
        fee: { amount: 1200, currency: "USD" }, flightPaidBy: "manager", hotelPaidBy: "manager",
        heightMin: null, languages: ["EN"],
        note: null,
        responders: [
          open("#B-777", "rs-1039", "Veronika M.", t - 7 * HOUR, true),
          open("#M-212", "rs-1033", "Sofia L.", t - 15 * HOUR, false),
          open("#W-588", "rs-1050", "Nika V.", t - 4 * HOUR, false),
          blind("#X-730", t - 3 * DAY, false),
        ],
        tourId: "tr-dxb-05",
      },
      {
        id: "cs-bcn-00", city: "Barcelona", project: "shoot",
        startsAt: d0 + 5 * DAY, endsAt: d0 + 6 * DAY, slots: 2, fresh: 0,
        closesAt: t - 12 * DAY, stage: "cancelled",
        fee: { amount: 600, currency: "EUR" }, flightPaidBy: "participant", hotelPaidBy: "manager",
        heightMin: null, languages: ["EN", "ES"],
        note: null,
        responders: [blind("#Y-064", t - 14 * DAY, false), blind("#Z-912", t - 20 * DAY, false)],
        tourId: null,
      },
    ],
  };
}
