/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · DEAL ROOM — данные комнаты тура
 * app/(dashboard)/partner/_lib/dealRoom.ts
 *
 *   типы               стороны, версии контракта, лог событий
 *   buildRoomMock(id)  демо: tr-mxp-07 (ждём подпись), tr-dxb-05 (замена,
 *                      контракт перезаключён v2), tr-syd-03 (ждём документы)
 *   fetchDealRoom      RPC public.partner_deal_room(p_tour) — миграция
 *                      20261012090000_partner_deal_room.sql
 *   roomContract       текущая версия в формате печати ContractSeal
 * ──────────────────────────────────────────────────────────────────── */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY, HOUR, MIN } from "./clock";
import {
  CommandError,
  PROJECTS,
  list,
  num,
  obj,
  oneOf,
  parseTerms,
  parseTrust,
  str,
  time,
  type Contract,
  type ContractTerms,
  type ProjectKey,
  type Trust,
} from "./command";
import type { NotifyTemplate } from "./actions";

/* ══════════════════════════════════════════════════════════════════
 * ТИПЫ
 * ══════════════════════════════════════════════════════════════════ */

export type PartyRole = "manager" | "participant";

export type RoomParty = {
  id: string;
  name: string;
  role: PartyRole;
  /** Подключён ли бот Voyage Concierge */
  telegram: boolean;
  /** Подпись последней версии условий; null — ещё не подписала */
  signedAt: number | null;
  /** Ниже — только для участниц */
  docsAt: number | null;
  snapAt: number | null;
  trust: Trust | null;
  /** Кого заменила в составе */
  replaces: string | null;
};

export type ContractVersion = {
  version: number;
  terms: ContractTerms;
  createdAt: number;
  createdBy: string;
  signatures: { id: string; name: string; signedAt: number }[];
};

export type RoomEventKind =
  | "contract_sent"
  | "contract_signed"
  | "docs_uploaded"
  | "docs_verified"
  | "member_joined"
  | "member_replaced"
  | "member_status"
  | "reminder_sent"
  | "tour_status";

export type ActorRole = "manager" | "participant" | "admin" | "system";

export type RoomEvent = {
  id: string;
  kind: RoomEventKind;
  at: number;
  actor: { id: string | null; name: string | null; role: ActorRole };
  /** О ком событие (документы, состав) */
  subject: { id: string; name: string } | null;
  /** member_replaced: кого заменили */
  replaced: string | null;
  version: number | null;
  template: NotifyTemplate | null;
  count: number | null;
  from: string | null;
  to: string | null;
  /** docs_uploaded: какой документ */
  doc: "passport" | "snaps" | "visa" | null;
};

export type RoomTourStatus = "confirmed" | "in_tour" | "closed" | "cancelled";

export type RoomTour = {
  id: string;
  city: string;
  iata: string | null;
  project: ProjectKey;
  flightNo: string | null;
  departsAt: number;
  returnsAt: number | null;
  status: RoomTourStatus;
};

export type DealRoomData = {
  generatedAt: number;
  me: { id: string; role: "manager" | "admin" };
  /** Тур закрыт или отменён — комната только для чтения */
  readOnly: boolean;
  tour: RoomTour;
  /** Менеджер первым, затем участницы состава */
  parties: RoomParty[];
  /** Новые сверху */
  versions: ContractVersion[];
  /** Новые сверху */
  events: RoomEvent[];
};

/** Текущая версия условий в формате печати ContractSeal */
export function roomContract(d: DealRoomData): Contract | null {
  const v = d.versions[0];
  if (!v) return null;
  const signed = d.parties.filter((p) => p.signedAt !== null);
  const sealed = signed.length === d.parties.length && d.parties.length > 0;
  return {
    version: v.version,
    signed: signed.length,
    required: d.parties.length,
    sealedAt: sealed ? Math.max(...signed.map((p) => p.signedAt ?? 0)) : null,
    terms: v.terms,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * МОКИ
 * ══════════════════════════════════════════════════════════════════ */

const ME = { id: "mg-erika", name: "Erika S." };
const ADMIN = { id: "ad-anna", name: "Anna K." };

let seq = 0;
const ev = (
  kind: RoomEventKind,
  at: number,
  actor: RoomEvent["actor"],
  extra: Partial<Omit<RoomEvent, "id" | "kind" | "at" | "actor">> = {},
): RoomEvent => ({
  id: `ev-${++seq}`,
  kind,
  at,
  actor,
  subject: null,
  replaced: null,
  version: null,
  template: null,
  count: null,
  from: null,
  to: null,
  doc: null,
  ...extra,
});

const manager = (signedAt: number | null): RoomParty => ({
  id: ME.id, name: ME.name, role: "manager", telegram: true, signedAt,
  docsAt: null, snapAt: null, trust: null, replaces: null,
});

const girl = (
  id: string,
  name: string,
  o: { signedAt: number | null; docsAt: number | null; snapAt: number | null; trust: Trust; telegram?: boolean; replaces?: string },
): RoomParty => ({
  id, name, role: "participant", telegram: o.telegram ?? true, signedAt: o.signedAt,
  docsAt: o.docsAt, snapAt: o.snapAt, trust: o.trust, replaces: o.replaces ?? null,
});

const trust = (flown: number, rating: number | null, reviews: number): Trust => ({
  flown, rating, reviews, trusted: flown >= 3 && reviews >= 3 && (rating ?? 0) >= 4.5,
});

const BASE_TERMS: ContractTerms = {
  flightPaidBy: "manager",
  hotelPaidBy: "manager",
  feeSplit: "50/50",
  feeAmount: 1200,
  feeCurrency: "USD",
  cancelFreeHours: 72,
};

export function buildRoomMock(tourId: string): DealRoomData {
  const t = Date.now();
  const mgr = { id: ME.id, name: ME.name, role: "manager" as const };
  const adm = { id: ADMIN.id, name: ADMIN.name, role: "admin" as const };
  const sys = { id: null, name: null, role: "system" as const };
  const who = (p: RoomParty) => ({ id: p.id, name: p.name, role: "participant" as const });
  const subj = (p: RoomParty) => ({ id: p.id, name: p.name });

  // ── Дубай: срыв → замена → контракт перезаключён и подписан всеми ──
  if (tourId === "tr-dxb-05") {
    const v = girl("rs-1039", "Veronika M.", { signedAt: t - 38 * MIN, docsAt: t - 4 * DAY, snapAt: t - 30 * HOUR, trust: trust(2, 4.5, 2) });
    const s = girl("rs-1033", "Sofia L.", { signedAt: t - 37 * MIN, docsAt: t - 4 * DAY, snapAt: t - 15 * HOUR, trust: trust(4, 4.8, 4) });
    const n = girl("rs-1050", "Nika V.", { signedAt: t - 30 * MIN, docsAt: t - 42 * MIN, snapAt: t - 50 * MIN, trust: trust(3, 4.7, 3), replaces: "Dasha O." });
    const terms = { ...BASE_TERMS };
    return {
      generatedAt: t,
      me: { id: ME.id, role: "manager" },
      readOnly: false,
      tour: { id: tourId, city: "Dubai", iata: "DXB", project: "event", flightNo: "EK 132", departsAt: t + 6 * HOUR + 40 * MIN, returnsAt: t + 4 * DAY, status: "confirmed" },
      parties: [manager(t - 40 * MIN), v, s, n],
      versions: [
        { version: 2, terms, createdAt: t - 40 * MIN, createdBy: ME.name, signatures: [
          { id: ME.id, name: ME.name, signedAt: t - 40 * MIN },
          { id: v.id, name: v.name, signedAt: t - 38 * MIN },
          { id: s.id, name: s.name, signedAt: t - 37 * MIN },
          { id: n.id, name: n.name, signedAt: t - 30 * MIN },
        ] },
        { version: 1, terms, createdAt: t - 5 * DAY, createdBy: ME.name, signatures: [
          { id: ME.id, name: ME.name, signedAt: t - 5 * DAY },
          { id: v.id, name: v.name, signedAt: t - 5 * DAY + 2 * HOUR },
          { id: s.id, name: s.name, signedAt: t - 5 * DAY + 3 * HOUR },
          { id: "rs-0988", name: "Dasha O.", signedAt: t - 4 * DAY },
        ] },
      ],
      events: [
        ev("contract_signed", t - 30 * MIN, who(n), { version: 2 }),
        ev("contract_signed", t - 37 * MIN, who(s), { version: 2 }),
        ev("contract_signed", t - 38 * MIN, who(v), { version: 2 }),
        ev("contract_signed", t - 40 * MIN, mgr, { version: 2 }),
        ev("contract_sent", t - 40 * MIN, mgr, { version: 2 }),
        ev("docs_verified", t - 42 * MIN, adm, { subject: subj(n) }),
        ev("docs_uploaded", t - 44 * MIN, who(n), { subject: subj(n), doc: "passport" }),
        ev("member_replaced", t - 48 * MIN, adm, { subject: subj(n), replaced: "Dasha O." }),
        ev("member_status", t - 55 * MIN, adm, { subject: { id: "rs-0988", name: "Dasha O." }, from: "confirmed", to: "late_drop" }),
        ev("docs_verified", t - 4 * DAY, adm, { subject: subj(s) }),
        ev("docs_verified", t - 4 * DAY - HOUR, adm, { subject: subj(v) }),
        ev("contract_sent", t - 5 * DAY, mgr, { version: 1 }),
        ev("member_joined", t - 5 * DAY - HOUR, sys, { subject: subj(s) }),
        ev("member_joined", t - 5 * DAY - HOUR, sys, { subject: subj(v) }),
      ],
    };
  }

  // ── Сидней: контракт подписан, ждём документы ───────────────────────
  if (tourId === "tr-syd-03") {
    const a = girl("rs-1042", "Alina S.", { signedAt: t - 6 * DAY, docsAt: t - 5 * DAY, snapAt: t - 2 * HOUR, trust: trust(6, 4.9, 5) });
    const m = girl("rs-1051", "Mia T.", { signedAt: t - 6 * DAY, docsAt: null, snapAt: t - 3 * DAY, trust: trust(1, 5, 1) });
    const r = girl("rs-1052", "Ana R.", { signedAt: t - 6 * DAY, docsAt: null, snapAt: t - 9 * DAY, trust: trust(0, null, 0), telegram: false });
    const k = girl("rs-1053", "Kate I.", { signedAt: t - 6 * DAY, docsAt: t - 4 * DAY, snapAt: t - 20 * HOUR, trust: trust(3, 4.6, 3) });
    const terms = { ...BASE_TERMS, hotelPaidBy: "split" as const };
    return {
      generatedAt: t,
      me: { id: ME.id, role: "manager" },
      readOnly: false,
      tour: { id: tourId, city: "Sydney", iata: "SYD", project: "shoot", flightNo: "QF 2", departsAt: t + 46 * HOUR, returnsAt: t + 9 * DAY, status: "confirmed" },
      parties: [manager(t - 7 * DAY), a, m, r, k],
      versions: [
        { version: 1, terms, createdAt: t - 7 * DAY, createdBy: ME.name, signatures: [
          { id: ME.id, name: ME.name, signedAt: t - 7 * DAY },
          ...[a, m, r, k].map((p) => ({ id: p.id, name: p.name, signedAt: t - 6 * DAY })),
        ] },
      ],
      events: [
        ev("reminder_sent", t - 26 * HOUR, mgr, { template: "docs_reminder", count: 1 }),
        ev("docs_verified", t - 4 * DAY, adm, { subject: subj(k) }),
        ev("docs_uploaded", t - 4 * DAY - 2 * HOUR, who(k), { subject: subj(k), doc: "passport" }),
        ev("docs_verified", t - 5 * DAY, adm, { subject: subj(a) }),
        ev("docs_uploaded", t - 5 * DAY - 3 * HOUR, who(a), { subject: subj(a), doc: "passport" }),
        ...[k, r, m, a].map((p) => ev("contract_signed", t - 6 * DAY, who(p), { version: 1 })),
        ev("contract_signed", t - 7 * DAY, mgr, { version: 1 }),
        ev("contract_sent", t - 7 * DAY, mgr, { version: 1 }),
      ],
    };
  }

  // ── Милан (по умолчанию): условия отправлены, одна подпись не пришла ─
  const v = girl("rs-1039", "Veronika M.", { signedAt: t - 8 * DAY, docsAt: t - 6 * DAY, snapAt: t - 30 * HOUR, trust: trust(2, 4.5, 2) });
  const l = girl("rs-1047", "Lena P.", { signedAt: null, docsAt: t - 5 * DAY, snapAt: t - 11 * DAY, trust: trust(0, null, 0) });
  const terms: ContractTerms = { ...BASE_TERMS, flightPaidBy: "participant" };
  return {
    generatedAt: t,
    me: { id: ME.id, role: "manager" },
    readOnly: false,
    tour: { id: tourId, city: "Milan", iata: "MXP", project: "show", flightNo: "EK 205", departsAt: t + 63 * HOUR, returnsAt: t + 6 * DAY, status: "confirmed" },
    parties: [manager(t - 9 * DAY), v, l],
    versions: [
      { version: 1, terms, createdAt: t - 9 * DAY, createdBy: ME.name, signatures: [
        { id: ME.id, name: ME.name, signedAt: t - 9 * DAY },
        { id: v.id, name: v.name, signedAt: t - 8 * DAY },
      ] },
    ],
    events: [
      ev("reminder_sent", t - 20 * HOUR, mgr, { template: "contract_reminder", count: 1 }),
      ev("docs_verified", t - 5 * DAY, adm, { subject: subj(l) }),
      ev("docs_uploaded", t - 5 * DAY - 2 * HOUR, who(l), { subject: subj(l), doc: "passport" }),
      ev("docs_verified", t - 6 * DAY, adm, { subject: subj(v) }),
      ev("docs_uploaded", t - 6 * DAY - 3 * HOUR, who(v), { subject: subj(v), doc: "passport" }),
      ev("contract_signed", t - 8 * DAY, who(v), { version: 1 }),
      ev("contract_signed", t - 9 * DAY, mgr, { version: 1 }),
      ev("contract_sent", t - 9 * DAY, mgr, { version: 1 }),
      ev("member_joined", t - 9 * DAY - HOUR, sys, { subject: subj(l) }),
      ev("member_joined", t - 9 * DAY - HOUR, sys, { subject: subj(v) }),
    ],
  };
}

/** Демо: что меняется в комнате после «Отправить на подпись» */
export function applySentLocally(d: DealRoomData, terms: ContractTerms, version: number): DealRoomData {
  const now = Date.now();
  const me = d.parties[0];
  return {
    ...d,
    parties: d.parties.map((p) => ({ ...p, signedAt: p.role === "manager" ? now : null })),
    versions: [
      { version, terms, createdAt: now, createdBy: me?.name ?? "", signatures: me ? [{ id: me.id, name: me.name, signedAt: now }] : [] },
      ...d.versions,
    ],
    events: [
      ev("contract_signed", now, { id: me?.id ?? null, name: me?.name ?? null, role: "manager" }, { version }),
      ev("contract_sent", now, { id: me?.id ?? null, name: me?.name ?? null, role: "manager" }, { version }),
      ...d.events,
    ],
  };
}

/** Демо: запись о напоминании в лог */
export function applyReminderLocally(d: DealRoomData, template: NotifyTemplate, count: number): DealRoomData {
  if (count <= 0) return d;
  const me = d.parties[0];
  return {
    ...d,
    events: [
      ev("reminder_sent", Date.now(), { id: me?.id ?? null, name: me?.name ?? null, role: "manager" }, { template, count }),
      ...d.events,
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════
 * SUPABASE
 * ══════════════════════════════════════════════════════════════════ */

export async function fetchDealRoom(supabase: SupabaseClient, tourId: string): Promise<DealRoomData> {
  const { data, error } = await supabase.rpc("partner_deal_room", { p_tour: tourId });
  if (error) {
    const reason =
      error.code === "42501" ? "forbidden" : error.code === "PGRST202" ? "missing" : !error.code ? "network" : "unknown";
    throw new CommandError(reason, error.message);
  }
  return parseDealRoom(data);
}

const EVENT_KINDS = [
  "contract_sent", "contract_signed", "docs_uploaded", "docs_verified",
  "member_joined", "member_replaced", "member_status", "reminder_sent", "tour_status",
] as const;
const ACTOR_ROLES = ["manager", "participant", "admin", "system"] as const;
const TOUR_STATUSES = ["confirmed", "in_tour", "closed", "cancelled"] as const;

export function parseDealRoom(raw: unknown): DealRoomData {
  const root = obj(raw);
  const me = obj(root.me);
  const tr = obj(root.tour);

  const tour: RoomTour = {
    id: str(tr.id) ?? "",
    city: str(tr.city) ?? "—",
    iata: str(tr.iata),
    project: oneOf(tr.project, PROJECTS) ?? "shoot",
    flightNo: str(tr.flight_no),
    departsAt: time(tr.departs_at) ?? Date.now(),
    returnsAt: time(tr.returns_at),
    status: oneOf(tr.status, TOUR_STATUSES) ?? "confirmed",
  };

  const parties = list<RoomParty>(root.parties, (p) => {
    const id = str(p.id);
    if (!id) return null;
    const role = oneOf(p.role, ["manager", "participant"] as const) ?? "participant";
    return {
      id,
      name: str(p.name) ?? "—",
      role,
      telegram: p.telegram === true,
      signedAt: time(p.signed_at),
      docsAt: time(p.docs_at),
      snapAt: time(p.snap_at),
      trust: role === "participant" ? parseTrust(p.trust) : null,
      replaces: str(p.replaces),
    };
  });

  const versions = list<ContractVersion>(root.versions, (v) => {
    const version = num(v.version);
    const terms = parseTerms(v.terms);
    const createdAt = time(v.created_at);
    if (version === null || !terms || createdAt === null) return null;
    return {
      version,
      terms,
      createdAt,
      createdBy: str(v.created_by) ?? "—",
      signatures: list(v.signatures, (s) => {
        const id = str(s.id);
        const signedAt = time(s.signed_at);
        return id && signedAt !== null ? { id, name: str(s.name) ?? "—", signedAt } : null;
      }),
    };
  });

  const events = list<RoomEvent>(root.events, (e) => {
    const id = str(e.id);
    const kind = oneOf(e.kind, EVENT_KINDS);
    const at = time(e.at);
    if (!id || !kind || at === null) return null;
    const a = obj(e.actor);
    const s = obj(e.subject);
    const pl = obj(e.payload);
    return {
      id,
      kind,
      at,
      actor: { id: str(a.id), name: str(a.name), role: oneOf(a.role, ACTOR_ROLES) ?? "system" },
      subject: str(s.id) ? { id: str(s.id) as string, name: str(s.name) ?? "—" } : null,
      replaced: str(e.replaced),
      version: num(pl.version),
      template: oneOf(pl.template, ["docs_reminder", "contract_reminder"] as const),
      count: num(pl.count),
      from: str(pl.from),
      to: str(pl.to),
      doc: oneOf(pl.doc, ["passport", "snaps", "visa"] as const),
    };
  });

  return {
    generatedAt: time(root.generated_at) ?? Date.now(),
    me: { id: str(me.id) ?? "", role: me.role === "admin" ? "admin" : "manager" },
    readOnly: root.read_only === true,
    tour,
    parties,
    versions,
    events,
  };
}

