/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Манифест»
 * app/(dashboard)/partner/_lib/manifest.ts
 *
 * Пока демо. При подключении: туры менеджера (partner_tours,
 * manager_id = me) с составом, документами и печатью контракта —
 * те же поля, что FlightItem в Штабе, плюс статус тура и итог.
 * ──────────────────────────────────────────────────────────────────── */

import { DAY, HOUR, MIN } from "./clock";
import type { Contract, ContractTerms, CrewMember, FlightStatus, ProjectKey } from "./command";

/** Статус тура в базе (partner_tours.status) */
export type TourStatus = "confirmed" | "in_tour" | "closed" | "cancelled";

export type TourRow = {
  id: string;
  city: string;
  iata: string | null;
  project: ProjectKey;
  flightNo: string | null;
  departsAt: number;
  returnsAt: number | null;
  status: TourStatus;
  /** Готовность подтверждённого тура: подписи, документы, замена. Для остальных — null */
  readiness: FlightStatus | null;
  crew: CrewMember[];
  replacement: string | null;
  replacementId: string | null;
  contract: Contract | null;
  /** Закрытый тур: сколько участниц долетели и сколько сорвались */
  outcome: { flown: number; dropped: number } | null;
};

export type ManifestData = { generatedAt: number; tours: TourRow[] };

const TERMS: ContractTerms = {
  flightPaidBy: "manager",
  hotelPaidBy: "manager",
  feeSplit: "50/50",
  feeAmount: 1200,
  feeCurrency: "USD",
  cancelFreeHours: 72,
};

export function buildManifestMock(): ManifestData {
  const t = Date.now();
  const crew = (id: string, name: string, docs = true, signed = true): CrewMember => ({ id, name, docs, signed });
  const sealed = (version: number, n: number, at: number, terms: ContractTerms = TERMS): Contract => ({
    version, signed: n, required: n, sealedAt: at, terms,
  });
  /** Закрытый тур: все долетели, контракт подписан за 6 дней до вылета */
  const closedTour = (
    id: string, city: string, iata: string, project: ProjectKey, flightNo: string,
    departsAt: number, members: CrewMember[], o: { version?: number } = {},
  ): TourRow => ({
    id, city, iata, project, flightNo, departsAt, returnsAt: departsAt + 4 * DAY,
    status: "closed", readiness: null, crew: members, replacement: null, replacementId: null,
    contract: sealed(o.version ?? 1, members.length + 1, departsAt - 6 * DAY),
    outcome: { flown: members.length, dropped: 0 },
  });

  return {
    generatedAt: t,
    tours: [
      {
        id: "tr-dxb-05", city: "Dubai", iata: "DXB", project: "event", flightNo: "EK 132",
        departsAt: t + 6 * HOUR + 40 * MIN, returnsAt: t + 3 * DAY, status: "confirmed", readiness: "replacement",
        crew: [crew("rs-1039", "Veronika M."), crew("rs-1033", "Sofia L."), crew("rs-1050", "Nika V.")],
        replacement: "Nika V.", replacementId: "rs-1050",
        contract: sealed(2, 4, t - 30 * MIN), outcome: null,
      },
      {
        id: "tr-syd-03", city: "Sydney", iata: "SYD", project: "shoot", flightNo: "QF 2",
        departsAt: t + 46 * HOUR, returnsAt: t + 7 * DAY, status: "confirmed", readiness: "docs",
        crew: [
          crew("rs-1042", "Alina S."), crew("rs-1051", "Mia T.", false),
          crew("rs-1052", "Ana R.", false), crew("rs-1053", "Kate I."),
        ],
        replacement: null, replacementId: null,
        contract: sealed(1, 5, t - 6 * DAY, { ...TERMS, hotelPaidBy: "split" }), outcome: null,
      },
      {
        id: "tr-mxp-07", city: "Milan", iata: "MXP", project: "show", flightNo: "EK 205",
        departsAt: t + 63 * HOUR, returnsAt: t + 6 * DAY, status: "confirmed", readiness: "contract",
        crew: [crew("rs-1039", "Veronika M."), crew("rs-1047", "Lena P.", true, false)],
        replacement: null, replacementId: null,
        contract: { version: 1, signed: 2, required: 3, sealedAt: null, terms: { ...TERMS, flightPaidBy: "participant" } },
        outcome: null,
      },
      {
        id: "tr-cdg-09", city: "Paris", iata: "CDG", project: "shoot", flightNo: null,
        departsAt: t + 9 * DAY, returnsAt: t + 11 * DAY, status: "confirmed", readiness: "contract",
        crew: [
          crew("rs-1061", "Daria K.", false, false), crew("rs-1062", "Eva N.", true, false),
          crew("rs-1063", "Marta G.", false, false),
        ],
        replacement: null, replacementId: null,
        contract: { version: 1, signed: 1, required: 4, sealedAt: null, terms: TERMS }, outcome: null,
      },
      {
        id: "tr-lhr-02", city: "London", iata: "LHR", project: "event", flightNo: "BA 108",
        departsAt: t - 2 * DAY, returnsAt: t + 2 * DAY + 5 * HOUR, status: "in_tour", readiness: null,
        crew: [crew("rs-1044", "Irina B."), crew("rs-1045", "Yana F.")],
        replacement: null, replacementId: null,
        contract: sealed(1, 3, t - 9 * DAY), outcome: null,
      },
      // ── закрытые: 7 за последние 12 месяцев (идут в зачёт Ключа) + 2 старше ──
      closedTour("tr-ist-01", "Istanbul", "IST", "campaign", "TK 760", t - 20 * DAY,
        [crew("rs-1042", "Alina S."), crew("rs-1053", "Kate I."), crew("rs-1033", "Sofia L.")]),
      {
        ...closedTour("tr-dxb-04", "Dubai", "DXB", "shoot", "EK 130", t - 45 * DAY,
          [crew("rs-1039", "Veronika M."), crew("rs-1046", "Olga S.")], { version: 2 }),
        replacement: "Olga S.", replacementId: "rs-1046",
        outcome: { flown: 2, dropped: 1 },
      },
      closedTour("tr-mxp-05", "Milan", "MXP", "show", "AZ 7605", t - 70 * DAY,
        [crew("rs-1039", "Veronika M."), crew("rs-1047", "Lena P."), crew("rs-1044", "Irina B."), crew("rs-1062", "Eva N.")]),
      closedTour("tr-cdg-04", "Paris", "CDG", "shoot", "AF 1145", t - 110 * DAY,
        [crew("rs-1061", "Daria K."), crew("rs-1063", "Marta G."), crew("rs-1033", "Sofia L.")]),
      closedTour("tr-syd-01", "Sydney", "SYD", "shoot", "QF 2", t - 160 * DAY,
        [crew("rs-1042", "Alina S."), crew("rs-1051", "Mia T."), crew("rs-1053", "Kate I."),
         crew("rs-1045", "Yana F."), crew("rs-1064", "Polina D.")]),
      closedTour("tr-lhr-01", "London", "LHR", "event", "BA 108", t - 220 * DAY,
        [crew("rs-1044", "Irina B."), crew("rs-1045", "Yana F."), crew("rs-1065", "Kira M.")]),
      closedTour("tr-dxb-02", "Dubai", "DXB", "campaign", "EK 132", t - 300 * DAY,
        [crew("rs-1039", "Veronika M."), crew("rs-1042", "Alina S."), crew("rs-1065", "Kira M.")]),
      closedTour("tr-ist-00", "Istanbul", "IST", "event", "TK 760", t - 400 * DAY,
        [crew("rs-1044", "Irina B."), crew("rs-1061", "Daria K."), crew("rs-1065", "Kira M.")]),
      closedTour("tr-dxb-01", "Dubai", "DXB", "shoot", "EK 130", t - 460 * DAY,
        [crew("rs-1039", "Veronika M."), crew("rs-1063", "Marta G.")]),
      {
        id: "tr-mco-01", city: "Monaco", iata: "NCE", project: "event", flightNo: null,
        departsAt: t - 10 * DAY, returnsAt: null, status: "cancelled", readiness: null,
        crew: [crew("rs-1047", "Lena P.", false, false)],
        replacement: null, replacementId: null,
        contract: null, outcome: null,
      },
    ],
  };
}
