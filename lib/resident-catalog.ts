/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток (Video Identity, этап 2)
 * lib/resident-catalog.ts
 *
 * Типы, разбор ответов RPC (миграции 20261201090000 и 20261203090000 —
 * каталог 2.0, этап A: фото — основа) и тексты RU/EN/ES/PT.
 * Кто что видит, решает только база; здесь — отображение.
 * ──────────────────────────────────────────────────────────────────── */

export type CatalogLang = "EN" | "RU" | "ES" | "PT";
export const catalogLang = (lang: string | null | undefined): CatalogLang =>
  lang === "RU" || lang === "ES" || lang === "PT" ? lang : "EN";
export const localeOf = (lang: string | null | undefined) =>
  ({ RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-PT" })[catalogLang(lang)];

/** Актуальность анкеты (этап A, D4): до 30 дней / 30–90 / старше 90 / даты нет.
 *  Считается по самому новому из «новое фото», «изменились параметры», «видео, открытое каталогу». */
export type Freshness = "fresh" | "aging" | "stale" | "none";
export const CATALOG_PAGE_SIZE = 24;
export const INVITE_MESSAGE_MAX = 300;
export const PAUSE_DAYS = [7, 14, 30] as const;
export const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"] as const;

export type CatalogReason =
  | "not_authenticated" | "not_manager" | "not_approved" | "catalog_disabled"
  | "no_access" | "suspended" | "expired";

export type CatalogViewer =
  | { mode: "staff" | "manager"; enabled: boolean; code: string; watermark: string; limits: CatalogLimits | null }
  | { mode: "none"; enabled: boolean; reason: CatalogReason };

export type CatalogLimits = { opens: number; invites: number; opensUsed: number; invitesUsed: number };
export type BusyRange = { from: string; to: string };
export type InviteMark = { status: InviteStatus; at: string } | null;
export type InviteStatus = "pending" | "interested" | "not_now" | "blocked" | "withdrawn" | "expired";

export type CatalogItem = {
  id: string;
  name: string;
  age: number | null;
  city: string | null;
  height: number | null;
  languages: string[];
  kycLevel: number;
  segment: string | null;
  /** обложка — первое фото портфолио, его выбирает резидентка */
  photo: string | null;
  photoCount: number;
  poster: string | null;
  videoAllowed: boolean;
  /** только видео, открытое каталогу; о скрытом видео база не сообщает */
  hasVideo: boolean;
  hasIntro: boolean;
  moments: number;
  videoAt: string | null;
  updatedAt: string | null;
  updatedKind: UpdatedKind | null;
  freshness: Freshness;
  busy: BusyRange[];
  inShortlist: boolean;
  invite: InviteMark;
};

export type UpdatedKind = "photos" | "profile" | "video";

export type CatalogCard = CatalogItem & {
  photos: string[];
  weight: number | null;
  measurements: string | null;
  bodyShown: boolean;
  clothingSize: string | null;
  shoeSize: number | null;
  inCatalogSince: string | null;
  shortlists: string[];
  noInvites: boolean;
};

export type CatalogFilters = {
  city?: string;
  hub?: string;
  languages?: string[];
  height_min?: number | null;
  height_max?: number | null;
  kyc_min?: number | null;
  size?: string | null;
  /** этап A: «Материалы» — все / с видео / обновлены за 30 дней */
  materials?: CatalogMaterials;
  sort?: CatalogSort;
  /** старый ключ этапа 2; база понимает его, интерфейс больше не шлёт */
  video?: "any" | "has" | "fresh";
  free_from?: string | null;
  free_to?: string | null;
};

export type CatalogMaterials = "any" | "video" | "fresh";
export type CatalogSort = "updated" | "new";
export const CATALOG_MATERIALS: readonly CatalogMaterials[] = ["any", "video", "fresh"];
export const CATALOG_SORTS: readonly CatalogSort[] = ["updated", "new"];

export type Shortlist = { id: string; title: string; count: number; updatedAt: string };
export type ShortlistEntry = (CatalogItem & { unavailable?: false; addedAt: string }) | { unavailable: true; addedAt: string };

export type ManagerCasting = {
  id: string;
  city: string;
  title: Record<string, string>;
  startsOn: string;
  endsOn: string;
  closesAt: string;
  heightMin: number | null;
  languages: string[];
  minKyc: number;
  segment: string;
  hubId: string | null;
};

export type SentInvite = {
  id: string; status: InviteStatus; createdAt: string; respondedAt: string | null; expiresAt: string;
  castingId: string; city: string; startsOn: string; residentId: string | null; name: string | null;
};

export type ChecklistState = {
  approved: boolean; kyc: boolean; photos: number; notRestricted: boolean;
  /** D6: город, рост и хотя бы один язык (если база этапа A; иначе считаем выполненным) */
  basicsRequired: boolean; city: boolean; height: boolean; languages: boolean;
};

export type CatalogState = {
  enabled: boolean;
  catalogVisible: boolean;
  catalogSince: string | null;
  pausedUntil: string | null;
  showBodyParams: boolean;
  videoScope: "catalog" | "engaged" | "hidden";
  videoConsent: boolean;
  promptDismissed: boolean;
  previewSeen: boolean;
  checklist: ChecklistState;
  listed: boolean;
  hidden: { managerId: string; mode: "hidden" | "no_invites"; since: string; label: string; badge: string | null }[];
  recent: { managerId: string; lastAt: string; label: string; badge: string | null }[];
  pulse: { views: number; catalogViews: number; shortlisted: number; invites: number };
};

export type ResidentInvite = {
  id: string;
  status: InviteStatus;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  casting: {
    id: string; city: string; title: Record<string, string>; projectType: string;
    startsOn: string; endsOn: string; closesAt: string;
    feeAmount: number | null; feeCurrency: string | null; flightPaidBy: string; hotelPaidBy: string; open: boolean;
  };
  manager: { label: string; badge: string | null; toursDone: number };
  canRespond: boolean;
  responded: boolean;
  openToTours: boolean;
};

export type CatalogFailure =
  | CatalogReason | "unavailable" | "limit_opens" | "limit_invites" | "invalid" | "message_contacts"
  | "not_your_casting" | "casting_closed" | "invites_blocked" | "invite_pending" | "invite_cooldown"
  | "already_in_casting" | "casting_requirements" | "busy" | "shortlist_limit" | "shortlist_full"
  | "not_found" | "preview_required" | "invite_closed" | "forbidden" | "manager_not_eligible" | "not_saved" | "schema" | "failed";

/* ── разбор ────────────────────────────────────────────────────────── */

type R = Record<string, unknown>;
const rec = (v: unknown): R => (v && typeof v === "object" && !Array.isArray(v) ? (v as R) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string");
const i18n = (v: unknown): Record<string, string> =>
  Object.fromEntries(Object.entries(rec(v)).filter(([, x]) => typeof x === "string")) as Record<string, string>;
const FRESH: Freshness[] = ["fresh", "aging", "stale", "none"];
const UPDATED: UpdatedKind[] = ["photos", "profile", "video"];
const INVITE: InviteStatus[] = ["pending", "interested", "not_now", "blocked", "withdrawn", "expired"];

export function parseLimits(v: unknown): CatalogLimits | null {
  const d = rec(v);
  if (d.opens == null) return null;
  return { opens: Number(d.opens) || 0, invites: Number(d.invites) || 0, opensUsed: Number(d.opens_used) || 0, invitesUsed: Number(d.invites_used) || 0 };
}

export function parseViewer(v: unknown): CatalogViewer {
  const d = rec(v);
  if (d.mode === "staff" || d.mode === "manager") {
    return { mode: d.mode, enabled: d.enabled === true, code: str(d.code), watermark: str(d.watermark), limits: parseLimits(d.limits) };
  }
  return { mode: "none", enabled: d.enabled === true, reason: (str(d.reason) || "no_access") as CatalogReason };
}

/** item.photo / item.poster приходят из базы путями; сервер заменяет их подписанными ссылками */
export function parseItem(v: unknown): CatalogItem | null {
  const d = rec(v);
  if (typeof d.id !== "string") return null;
  const inv = rec(d.invite);
  return {
    id: d.id,
    name: str(d.name) || "—",
    age: num(d.age),
    city: strOrNull(d.city),
    height: num(d.height),
    languages: strs(d.languages),
    kycLevel: Number(d.kyc_level) || 0,
    segment: strOrNull(d.segment),
    photo: strOrNull(d.photo),
    photoCount: Number(d.photo_count) || 0,
    poster: strOrNull(d.poster),
    videoAllowed: d.video_allowed === true,
    // база этапа 2 не присылает has_video — тогда видео есть, только если оно открыто каталогу
    hasVideo: d.has_video === true || (d.has_video === undefined && d.video_allowed === true && (d.has_intro === true || Number(d.moments) > 0)),
    hasIntro: d.has_intro === true,
    moments: Number(d.moments) || 0,
    videoAt: strOrNull(d.video_at),
    updatedAt: strOrNull(d.updated_at),
    updatedKind: UPDATED.includes(d.updated_kind as UpdatedKind) ? (d.updated_kind as UpdatedKind) : null,
    freshness: FRESH.includes(d.freshness as Freshness) ? (d.freshness as Freshness) : "none",
    busy: arr(d.busy).map(rec).map((b) => ({ from: str(b.from), to: str(b.to) })).filter((b) => b.from),
    inShortlist: d.in_shortlist === true,
    invite: INVITE.includes(inv.status as InviteStatus) ? { status: inv.status as InviteStatus, at: str(inv.at) } : null,
  };
}

export function parseCard(v: unknown): CatalogCard | null {
  const base = parseItem(v);
  if (!base) return null;
  const d = rec(v);
  return {
    ...base,
    photos: strs(d.photos),
    weight: num(d.weight),
    measurements: strOrNull(d.measurements),
    bodyShown: d.body_shown === true,
    clothingSize: strOrNull(d.clothing_size),
    shoeSize: num(d.shoe_size),
    inCatalogSince: strOrNull(d.in_catalog_since),
    shortlists: strs(d.shortlists),
    noInvites: d.no_invites === true,
  };
}

export function parseShortlists(v: unknown): Shortlist[] {
  return arr(v).map(rec).filter((d) => typeof d.id === "string")
    .map((d) => ({ id: str(d.id), title: str(d.title), count: Number(d.count) || 0, updatedAt: str(d.updated_at) }));
}

export function parseCastings(v: unknown): ManagerCasting[] {
  return arr(v).map(rec).filter((d) => typeof d.id === "string").map((d) => ({
    id: str(d.id), city: str(d.city), title: i18n(d.title_i18n), startsOn: str(d.starts_on), endsOn: str(d.ends_on),
    closesAt: str(d.closes_at), heightMin: num(d.height_min), languages: strs(d.languages),
    minKyc: Number(d.min_kyc_level) || 0, segment: str(d.audience_segment) || "all", hubId: strOrNull(d.map_hub_id),
  }));
}

export function parseSentInvites(v: unknown): SentInvite[] {
  return arr(v).map(rec).filter((d) => typeof d.id === "string").map((d) => ({
    id: str(d.id), status: (INVITE.includes(d.status as InviteStatus) ? d.status : "expired") as InviteStatus,
    createdAt: str(d.created_at), respondedAt: strOrNull(d.responded_at), expiresAt: str(d.expires_at),
    castingId: str(d.casting_id), city: str(d.city), startsOn: str(d.starts_on),
    residentId: strOrNull(d.resident_id), name: strOrNull(d.name),
  }));
}

export function parseState(v: unknown): CatalogState | null {
  const d = rec(v);
  if (!("catalog_visible" in d)) return null;
  const c = rec(d.checklist);
  const p = rec(d.pulse);
  const scope = d.video_scope === "catalog" || d.video_scope === "hidden" ? d.video_scope : "engaged";
  return {
    enabled: d.enabled === true,
    catalogVisible: d.catalog_visible === true,
    catalogSince: strOrNull(d.catalog_since),
    pausedUntil: strOrNull(d.paused_until),
    showBodyParams: d.show_body_params === true,
    videoScope: scope,
    videoConsent: d.video_consent === true,
    promptDismissed: d.prompt_dismissed === true,
    previewSeen: d.preview_seen === true,
    checklist: {
      approved: c.approved === true, kyc: c.kyc === true, photos: Number(c.photos) || 0, notRestricted: c.not_restricted !== false,
      basicsRequired: c.basics_required === true, city: c.city !== false, height: c.height !== false, languages: c.languages !== false,
    },
    listed: d.listed === true,
    hidden: arr(d.hidden).map(rec).map((h) => ({
      managerId: str(h.manager_id), mode: h.mode === "no_invites" ? "no_invites" as const : "hidden" as const,
      since: str(h.since), label: str(h.label) || "Manager", badge: strOrNull(h.badge),
    })),
    recent: arr(d.recent).map(rec).map((h) => ({ managerId: str(h.manager_id), lastAt: str(h.last_at), label: str(h.label) || "Manager", badge: strOrNull(h.badge) })),
    pulse: { views: Number(p.views) || 0, catalogViews: Number(p.catalog_views) || 0, shortlisted: Number(p.shortlisted) || 0, invites: Number(p.invites) || 0 },
  };
}

export function parseResidentInvites(v: unknown): ResidentInvite[] {
  return arr(v).map(rec).filter((d) => typeof d.id === "string").map((d) => {
    const c = rec(d.casting);
    const m = rec(d.manager);
    return {
      id: str(d.id),
      status: (INVITE.includes(d.status as InviteStatus) ? d.status : "expired") as InviteStatus,
      message: strOrNull(d.message),
      createdAt: str(d.created_at),
      expiresAt: str(d.expires_at),
      casting: {
        id: str(c.id), city: str(c.city), title: i18n(c.title_i18n), projectType: str(c.project_type),
        startsOn: str(c.starts_on), endsOn: str(c.ends_on), closesAt: str(c.closes_at),
        feeAmount: num(c.fee_amount), feeCurrency: strOrNull(c.fee_currency),
        flightPaidBy: str(c.flight_paid_by), hotelPaidBy: str(c.hotel_paid_by), open: c.open === true,
      },
      manager: { label: str(m.label) || "Manager", badge: strOrNull(m.badge), toursDone: Number(m.tours_done) || 0 },
      canRespond: d.can_respond === true,
      responded: d.responded === true,
      openToTours: d.open_to_tours === true,
    };
  });
}

export function catalogFailureOf(error: { code?: string | null; message?: string | null } | null): CatalogFailure {
  const msg = error?.message ?? "";
  const m = msg.match(/voyage:([a-z_]+)/);
  const known: CatalogFailure[] = [
    "not_authenticated", "not_manager", "not_approved", "catalog_disabled", "no_access", "suspended", "expired",
    "unavailable", "message_contacts", "not_your_casting", "casting_closed", "invites_blocked", "invite_pending",
    "invite_cooldown", "already_in_casting", "casting_requirements", "busy", "shortlist_limit", "shortlist_full",
    "not_found", "preview_required", "invite_closed", "forbidden", "manager_not_eligible", "not_saved",
  ];
  if (m && known.includes(m[1] as CatalogFailure)) return m[1] as CatalogFailure;
  if (m && m[1] === "invalid_arguments") return "invalid";
  if (error?.code === "42883" || error?.code === "PGRST202" || error?.code === "42P01") return "schema";
  if (error?.code === "42501") return "forbidden";
  if (error?.code === "22023" || error?.code === "22P02" || error?.code === "23514") return "invalid";
  return "failed";
}

/** Та же проверка, что и в базе (voyage_rcat_message_ok), — чтобы подсказать до отправки */
export function inviteMessageOk(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length > INVITE_MESSAGE_MAX) return false;
  if (/(https?:\/\/|www\.|t\.me|wa\.me|telegram\.me|@[a-z0-9_]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(com|ru|net|org|io|me|app|link|site|info)\b)/i.test(t)) return false;
  return !/[0-9]{7,}/.test(t.replace(/[\s()+.\-]/g, ""));
}

export function pickI18n(map: Record<string, string>, lang: string): string {
  return map[catalogLang(lang)] || map.EN || map.RU || Object.values(map)[0] || "";
}

export function fmtDay(value: string | null | undefined, lang: string): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(localeOf(lang), { day: "numeric", month: "short", timeZone: "UTC" });
}

export function fmtRange(from: string, to: string, lang: string): string {
  const a = fmtDay(from, lang);
  const b = fmtDay(to, lang);
  return b && b !== a ? `${a} – ${b}` : a;
}

/* ── тексты ────────────────────────────────────────────────────────── */

type Copy = {
  // общее
  freshness: Record<Freshness, string>;
  inviteStatus: Record<InviteStatus, string>;
  errors: Record<CatalogFailure, string>;
  years: (n: number) => string;
  cm: string;
  kg: string;
  busy: string;
  free: string;
  loading: string;
  retry: string;
  close: string;
  // кольцо и заполненность
  ringTitle: string;
  ringIntro: string;
  ringMoments: string;
  ringFresh: string;
  ringOpen: string;
  // «Моя видимость»
  visTitle: string;
  visKicker: string;
  visLead: string;
  visCatalog: string;
  visCatalogHint: string;
  visCatalogOff: string;
  visCatalogDisabled: string;
  visListed: string;
  visNotListed: string;
  visNeed: string;
  visNeedApproved: string;
  visNeedKyc: string;
  visNeedPhotos: (n: number) => string;
  visNeedRestricted: string;
  visVideoNote: string;
  visBody: string;
  visBodyHint: string;
  visPause: string;
  visPauseHint: string;
  visPauseDays: (n: number) => string;
  visPausedUntil: (d: string) => string;
  visResume: string;
  visPreview: string;
  visPreviewFirst: string;
  visPreviewConfirm: string;
  visPreviewTitle: string;
  visPreviewNote: string;
  visHiddenTitle: string;
  visHiddenEmpty: string;
  visRecentTitle: string;
  visHide: string;
  visNoInvites: string;
  visUnhide: string;
  visModeHidden: string;
  visModeNoInvites: string;
  visHideNote: string;
  visNeverShown: string;
  pulseTitle: string;
  pulseViews: string;
  pulseCatalogViews: string;
  pulseShortlisted: string;
  pulseInvites: string;
  pulseEmpty: string;
  // одноразовая карточка
  promptTitle: string;
  promptText: string;
  promptCta: string;
  promptLater: string;
  // входящие
  inboxTitle: string;
  inboxKicker: string;
  inboxFrom: string;
  inboxTours: (n: number) => string;
  inboxFee: string;
  inboxFlight: string;
  inboxHotel: string;
  paidBy: Record<string, string>;
  inboxInterested: string;
  inboxNotNow: string;
  inboxBlock: string;
  inboxBlockConfirm: string;
  inboxOpenCasting: string;
  inboxRespondHint: string;
  inboxOpenToursHint: string;
  inboxCantRespond: string;
  inboxUntil: (d: string) => string;
  inboxNote: string;
  // каталог менеджера
  catEyebrow: string;
  catTitle: string;
  catSubtitle: string;
  catGateTitle: string;
  catGate: Record<CatalogReason, string>;
  catStaffDisabled: string;
  catLimits: (opensUsed: number, opens: number, invUsed: number, inv: number) => string;
  catWatermarkNote: string;
  fCity: string;
  fHub: string;
  fLanguages: string;
  fHeight: string;
  fKyc: string;
  fSize: string;
  fVideo: string;
  fVideoAny: string;
  fVideoHas: string;
  fVideoFresh: string;
  fDates: string;
  fReset: string; fApply: string; fFilters: string;
  fForCasting: string;
  fForCastingNone: string;
  fForCastingPick: string;
  found: (n: number) => string;
  empty: string;
  more: string;
  cardOpen: string;
  cardVideo: string;
  cardNoVideo: string;
  cardVideoPrivate: string;
  cardParams: string;
  cardBodyHidden: string;
  cardSizes: string;
  cardLanguages: string;
  cardBusy: string;
  cardSince: (d: string) => string;
  cardPrev: string; cardBack: string; cardPos: (a: number, b: number) => string; cardNavHint: string;
  cardNext: string;
  shortTitle: string;
  shortNew: string;
  shortNewPlaceholder: string;
  shortCreate: string;
  shortAdd: string;
  shortIn: string;
  shortRemove: string;
  shortEmpty: string;
  shortUnavailable: string;
  shortPrune: string;
  shortDelete: string;
  shortDeleteConfirm: string;
  shortInviteAll: string;
  shortAll: string;
  inviteTitle: string;
  inviteCasting: string;
  inviteNoCastings: string;
  inviteMessage: string;
  inviteMessageHint: string;
  inviteSend: string;
  inviteSent: string;
  inviteBatchResult: (ok: number, total: number) => string;
  inviteBlocked: string;
  inviteDisabledBusy: string;
  sentTitle: string;
  sentWithdraw: string;
  sentHidden: string;
  // owner
  ownEyebrow: string;
  ownTitle: string;
  ownSubtitle: string;
  ownEnabled: string;
  ownDisabled: string;
  ownEnable: string;
  ownDisable: string;
  ownLawyer: string;
  ownSettingsMissing: string;
  ownReasonRequired: string; ownSaveLimits: string; ownLimitsSaved: string; ownSwitchHint: string; ownLimitsHint: string;
  ownDefaults: string;
  ownOpens: string;
  ownInvites: string;
  ownReason: string;
  ownReasonHint: string;
  ownSave: string; ownEdit: string;
  ownResidents: (opted: number, listed: number, paused: number, video: number) => string;
  ownInvites7: (n: number) => string;
  ownManagers: string;
  ownCode: string;
  ownToday: string;
  ownAccess: Record<"active" | "suspended" | "none", string>;
  ownGrant: string;
  ownSuspend: string;
  ownRevoke: string;
  ownNotEligible: string;
  ownExpires: string;
  ownLimitEvents: string;
  ownAccessEvents: string;
  ownNoEvents: string;
  ownReadOnly: string;
  ownKindOpens: string;
  ownKindInvites: string;
  // модерация
  modCatalog: string;
  modCatalogOff: string;
  modCatalogOn: (views: number, invites: number) => string;
  modPaused: (d: string) => string;
};

const RU: Copy = {
  freshness: { fresh: "Актуально", aging: "Пора освежить", stale: "Давно не обновлялась", none: "" },
  inviteStatus: { pending: "Ждёт ответа", interested: "Интересно", not_now: "Не сейчас", blocked: "Не приглашать", withdrawn: "Отозвано", expired: "Истекло" },
  errors: {
    not_authenticated: "Войдите в аккаунт.", not_manager: "Каталог доступен только менеджерам VOYAGE.",
    not_approved: "Доступ к каталогу — только у одобренных менеджеров.", catalog_disabled: "Каталог пока выключен.",
    no_access: "Доступ к каталогу выдаёт owner VOYAGE.", suspended: "Доступ к каталогу приостановлен.", expired: "Срок доступа к каталогу истёк.",
    unavailable: "Анкета сейчас недоступна.", limit_opens: "Лимит открытий анкет на сегодня исчерпан.", limit_invites: "Лимит приглашений на сегодня исчерпан.",
    invalid: "Проверьте данные.", message_contacts: "Без ссылок, телефонов, почты и @ников, до 300 символов.",
    not_your_casting: "Приглашать можно только в свой кастинг.", casting_closed: "Кастинг закрыт.",
    invites_blocked: "Резидентка не принимает от вас приглашения.", invite_pending: "У неё уже есть ваше приглашение.",
    invite_cooldown: "Она ответила «Не сейчас» — снова пригласить можно через 14 дней.",
    already_in_casting: "Она уже откликнулась на этот кастинг.", casting_requirements: "Она не проходит требования этого кастинга (KYC или сегмент).",
    busy: "Она занята в даты кастинга.", shortlist_limit: "Не больше 30 подборок.", shortlist_full: "В подборке не больше 100 анкет.",
    not_found: "Не найдено.", preview_required: "Сначала посмотрите, как вас видит менеджер.", invite_closed: "Приглашение уже закрыто.",
    forbidden: "Недостаточно прав.", manager_not_eligible: "Этот менеджер не одобрен или заблокирован.",
    schema: "Каталог ещё не установлен в базе.", failed: "Не получилось. Попробуйте ещё раз.",
    not_saved: "База не подтвердила изменение — ничего не изменилось. Запустите диагностику CATALOG_ENABLE_DIAG.sql.",
  },
  years: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "год" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "года" : "лет"}`,
  cm: "см", kg: "кг", busy: "Занята", free: "Свободна", loading: "Загрузка…", retry: "Повторить", close: "Закрыть",
  ringTitle: "Video Identity", ringIntro: "Визитка", ringMoments: "Moments", ringFresh: "Свежесть", ringOpen: "К видео",
  visTitle: "Моя видимость", visKicker: "Каталог VOYAGE",
  visLead: "Вы решаете, кто и сколько видит. Каждый просмотр менеджера попадает в «Кто смотрел».",
  visCatalog: "Открыта к предложениям", visCatalogHint: "Анкета в закрытом каталоге для проверенных менеджеров VOYAGE. Контактов они не получают.",
  visCatalogOff: "Анкеты нет в каталоге. Менеджеры видят её только в кастингах, на которые вы откликнулись, и в ваших турах.",
  visCatalogDisabled: "Каталог ещё не открыт для менеджеров. Настройки сохранятся и заработают, когда VOYAGE его включит.",
  visListed: "Анкета в каталоге", visNotListed: "Пока не в каталоге", visNeed: "Чтобы попасть в каталог:",
  visNeedApproved: "анкета одобрена VOYAGE", visNeedKyc: "пройден KYC 1 (паспорт)", visNeedPhotos: (n) => `не меньше 3 фото в портфолио (сейчас ${n})`,
  visNeedRestricted: "нет ограничений аккаунта", visVideoNote: "Видео не обязательно и не влияет на место в каталоге. Основа анкеты — фото.",
  visBody: "Показывать вес и параметры", visBodyHint: "Рост и размеры видны всегда, вес и параметры — только если включите.",
  visPause: "Пауза", visPauseHint: "Анкета временно пропадёт из каталога и вернётся сама.", visPauseDays: (n) => `${n} дн.`,
  visPausedUntil: (d) => `На паузе до ${d}`, visResume: "Снять паузу",
  visPreview: "Так вас видит менеджер", visPreviewFirst: "Перед включением посмотрите, как выглядит ваша анкета в каталоге.",
  visPreviewConfirm: "Всё верно, включить", visPreviewTitle: "Ваша анкета в каталоге",
  visPreviewNote: "Ровно эти данные видит менеджер. ФИО, дата рождения, гражданство, контакты и документы не показываются никогда.",
  visHiddenTitle: "Скрытые менеджеры", visHiddenEmpty: "Вы ни от кого не скрывались.",
  visRecentTitle: "Смотрели или приглашали за 90 дней", visHide: "Скрыться", visNoInvites: "Не приглашать", visUnhide: "Вернуть",
  visModeHidden: "не видит в каталоге", visModeNoInvites: "видит, но не приглашает",
  visHideNote: "Если вы сами откликнетесь на кастинг этого менеджера, он увидит анкету по обычным правилам кастинга.",
  visNeverShown: "Никогда не показываются: ФИО, дата рождения, гражданство, контакты и Telegram, документы KYC, кошелёк.",
  pulseTitle: "Пульс за 7 дней", pulseViews: "менеджеров смотрели", pulseCatalogViews: "из каталога", pulseShortlisted: "добавили в подборку",
  pulseInvites: "приглашений", pulseEmpty: "Пока тихо. Новые фото, обновлённые параметры или видео делают анкету актуальной.",
  promptTitle: "Откройтесь проверенным менеджерам", promptText: "Каталог VOYAGE — закрытый: анкету видят только одобренные менеджеры, каждый просмотр виден вам, контактов они не получают. Включить можно в «Моей видимости».",
  promptCta: "Посмотреть, как это выглядит", promptLater: "Не сейчас",
  inboxTitle: "Приглашения из каталога", inboxKicker: "Вас нашли в каталоге", inboxFrom: "Менеджер",
  inboxTours: (n) => `завершённых туров: ${n}`, inboxFee: "Гонорар", inboxFlight: "Перелёт", inboxHotel: "Отель",
  paidBy: { manager: "менеджер", participant: "участница", split: "пополам" },
  inboxInterested: "Интересно", inboxNotNow: "Не сейчас", inboxBlock: "Не приглашать меня",
  inboxBlockConfirm: "Этот менеджер больше не сможет вас приглашать. Снять можно в «Моей видимости».",
  inboxOpenCasting: "Открыть кастинг и откликнуться", inboxRespondHint: "Отклик — обычной кнопкой кастинга, дальше опцион и рукопожатие как всегда.",
  inboxOpenToursHint: "Чтобы откликнуться, включите «Открыта к турам» в ленте кастингов.",
  inboxCantRespond: "Сейчас откликнуться нельзя: проверьте требования кастинга.", inboxUntil: (d) => `до ${d}`,
  inboxNote: "Контакты не передаются до рукопожатия.",
  catEyebrow: "Каталог резиденток", catTitle: "Открыты к предложениям",
  catSubtitle: "Резидентки, которые сами открыли анкету проверенным менеджерам VOYAGE. Каждое открытие видно резидентке. Контакты — только после рукопожатия.",
  catGateTitle: "Каталог недоступен",
  catGate: {
    not_authenticated: "Войдите в аккаунт менеджера.", not_manager: "Каталог — только для менеджеров VOYAGE.",
    not_approved: "Каталог открывается одобренным менеджерам.", catalog_disabled: "Каталог ещё не запущен. Мы сообщим, когда он откроется.",
    no_access: "Доступ выдаёт owner VOYAGE после проверки. Напишите в поддержку, если он нужен.", suspended: "Ваш доступ к каталогу приостановлен.", expired: "Срок вашего доступа к каталогу истёк.",
  },
  catStaffDisabled: "Каталог выключен для менеджеров. Вы видите его как персонал VOYAGE.",
  catLimits: (a, b, c, d) => `Сегодня: анкет ${a} из ${b} · приглашений ${c} из ${d}`,
  catWatermarkNote: "Фото и видео помечены вашим кодом и датой.",
  fCity: "Город", fHub: "Локация", fLanguages: "Языки", fHeight: "Рост", fKyc: "KYC", fSize: "Размер", fVideo: "Видео",
  fVideoAny: "Все", fVideoHas: "С видео", fVideoFresh: "Свежее видео", fDates: "Свободна в даты", fReset: "Сбросить", fApply: "Показать", fFilters: "Фильтры",
  fForCasting: "Под кастинг", fForCastingNone: "Нет открытых кастингов", fForCastingPick: "Выберите кастинг",
  found: (n) => `Найдено: ${n}`, empty: "По этим фильтрам никого нет.", more: "Показать ещё",
  cardOpen: "Открыть анкету", cardVideo: "Есть видео", cardNoVideo: "Без видео", cardVideoPrivate: "Видео она показывает только тем, с кем работает.",
  cardParams: "Параметры", cardBodyHidden: "Вес и параметры скрыты резиденткой", cardSizes: "Размеры", cardLanguages: "Языки", cardBusy: "Занята",
  cardSince: (d) => `в каталоге с ${d}`, cardPrev: "Предыдущая", cardNext: "Следующая", cardBack: "Каталог", cardPos: (a, b) => `${a} из ${b}`, cardNavHint: "← → — листать, Esc — закрыть",
  shortTitle: "Подборки", shortNew: "Новая подборка", shortNewPlaceholder: "Например, «Дубай, апрель»", shortCreate: "Создать",
  shortAdd: "В подборку", shortIn: "В подборке", shortRemove: "Убрать", shortEmpty: "Подборка пуста.",
  shortUnavailable: "Анкета недоступна", shortPrune: "Убрать недоступные", shortDelete: "Удалить подборку",
  shortDeleteConfirm: "Удалить подборку?", shortInviteAll: "Пригласить всю подборку", shortAll: "Все анкеты",
  inviteTitle: "Пригласить в кастинг", inviteCasting: "Кастинг", inviteNoCastings: "Нет открытых кастингов. Создайте кастинг, чтобы приглашать.",
  inviteMessage: "Личное слово", inviteMessageHint: "До 300 символов, без ссылок, телефонов и @ников.", inviteSend: "Пригласить",
  inviteSent: "Приглашение отправлено.", inviteBatchResult: (ok, total) => `Отправлено ${ok} из ${total}.`,
  inviteBlocked: "Она не принимает от вас приглашения.", inviteDisabledBusy: "Занята в даты кастинга",
  sentTitle: "Мои приглашения", sentWithdraw: "Отозвать", sentHidden: "анкета недоступна",
  ownEyebrow: "Контроль · только owner", ownTitle: "Каталог резиденток",
  ownSubtitle: "Кто из менеджеров видит каталог, их лимиты и события. Доступ выдаётся явно и только одобренным менеджерам.",
  ownEnabled: "Каталог включён для менеджеров", ownDisabled: "Каталог выключен для менеджеров",
  ownEnable: "Включить каталог", ownDisable: "Выключить каталог",
  ownSettingsMissing: "В базе нет строки общего выключателя каталога, включение не сработает. Запустите CATALOG_ENABLE_DIAG.sql.",
  ownReasonRequired: "Сначала напишите причину (от 3 символов) — она попадёт в журнал.", ownSaveLimits: "Сохранить лимиты", ownLimitsSaved: "Лимиты по умолчанию сохранены",
  ownSwitchHint: "Причина обязательна для включения и выключения.", ownLimitsHint: "Эта кнопка меняет только лимиты и не включает каталог.",
  ownLawyer: "Решение D5: включать после проверки юристом. Резидентки могут готовить анкеты заранее.",
  ownDefaults: "Лимиты по умолчанию в сутки", ownOpens: "Открытий анкет", ownInvites: "Приглашений",
  ownReason: "Причина", ownReasonHint: "Пишется в журнал (от 3 символов).", ownSave: "Сохранить", ownEdit: "Настроить доступ",
  ownResidents: (o, l, p, v) => `Включили каталог: ${o} · видны сейчас: ${l} · на паузе: ${p} · видео для каталога: ${v}`,
  ownInvites7: (n) => `Приглашений за 7 дней: ${n}`, ownManagers: "Менеджеры", ownCode: "Код знака", ownToday: "Сегодня",
  ownAccess: { active: "Доступ открыт", suspended: "Приостановлен", none: "Нет доступа" },
  ownGrant: "Открыть доступ", ownSuspend: "Приостановить", ownRevoke: "Снять доступ",
  ownNotEligible: "Не одобрен или заблокирован — доступ выдать нельзя", ownExpires: "Действует до (необязательно)",
  ownLimitEvents: "Превышения лимитов", ownAccessEvents: "Изменения доступа", ownNoEvents: "Событий нет.",
  ownReadOnly: "Просмотр. Менять доступы может только owner.", ownKindOpens: "открытия анкет", ownKindInvites: "приглашения",
  modCatalog: "Каталог", modCatalogOff: "не в каталоге", modCatalogOn: (v, i) => `в каталоге · просмотров за 30 дней: ${v} · приглашений: ${i}`,
  modPaused: (d) => `на паузе до ${d}`,
};

const EN: Copy = {
  freshness: { fresh: "Up to date", aging: "Time to refresh", stale: "Not updated for a while", none: "" },
  inviteStatus: { pending: "Awaiting reply", interested: "Interested", not_now: "Not now", blocked: "No invites", withdrawn: "Withdrawn", expired: "Expired" },
  errors: {
    not_authenticated: "Please sign in.", not_manager: "The catalog is for VOYAGE managers only.",
    not_approved: "Only approved managers can use the catalog.", catalog_disabled: "The catalog is switched off for now.",
    no_access: "Catalog access is granted by the VOYAGE owner.", suspended: "Your catalog access is suspended.", expired: "Your catalog access has expired.",
    unavailable: "This profile isn't available right now.", limit_opens: "You've reached today's profile limit.", limit_invites: "You've reached today's invite limit.",
    invalid: "Please check the details.", message_contacts: "No links, phone numbers, emails or @handles, up to 300 characters.",
    not_your_casting: "You can only invite to your own casting.", casting_closed: "The casting is closed.",
    invites_blocked: "She doesn't accept invites from you.", invite_pending: "She already has your invite.",
    invite_cooldown: "She replied “Not now” — you can invite again in 14 days.",
    already_in_casting: "She has already applied to this casting.", casting_requirements: "She doesn't meet this casting's requirements (KYC or segment).",
    busy: "She's busy on the casting dates.", shortlist_limit: "Up to 30 shortlists.", shortlist_full: "Up to 100 profiles per shortlist.",
    not_found: "Not found.", preview_required: "First see how managers will see you.", invite_closed: "This invite is already closed.",
    forbidden: "Not allowed.", manager_not_eligible: "This manager isn't approved or is blocked.",
    schema: "The catalog isn't installed in the database yet.", failed: "Something went wrong. Please try again.",
    not_saved: "The database did not confirm the change — nothing was changed. Run CATALOG_ENABLE_DIAG.sql.",
  },
  years: (n) => `${n} y.o.`,
  cm: "cm", kg: "kg", busy: "Busy", free: "Available", loading: "Loading…", retry: "Retry", close: "Close",
  ringTitle: "Video Identity", ringIntro: "Intro", ringMoments: "Moments", ringFresh: "Freshness", ringOpen: "Go to video",
  visTitle: "My visibility", visKicker: "VOYAGE catalog",
  visLead: "You decide who sees what. Every manager view shows up in “Who viewed”.",
  visCatalog: "Open to offers", visCatalogHint: "Your profile in the private catalog for verified VOYAGE managers. They never get your contacts.",
  visCatalogOff: "Your profile isn't in the catalog. Managers see it only in castings you applied to and in your tours.",
  visCatalogDisabled: "The catalog isn't open to managers yet. Your settings are saved and will apply once VOYAGE switches it on.",
  visListed: "Profile is in the catalog", visNotListed: "Not in the catalog yet", visNeed: "To appear in the catalog:",
  visNeedApproved: "profile approved by VOYAGE", visNeedKyc: "KYC level 1 (passport) done", visNeedPhotos: (n) => `at least 3 portfolio photos (now ${n})`,
  visNeedRestricted: "no account restrictions", visVideoNote: "Video is optional and does not affect your place in the catalog. Photos are the core of your profile.",
  visBody: "Show weight and measurements", visBodyHint: "Height and sizes are always shown; weight and measurements only if you switch this on.",
  visPause: "Pause", visPauseHint: "Your profile leaves the catalog for a while and comes back by itself.", visPauseDays: (n) => `${n} days`,
  visPausedUntil: (d) => `Paused until ${d}`, visResume: "End pause",
  visPreview: "How managers see you", visPreviewFirst: "Before switching on, see how your profile looks in the catalog.",
  visPreviewConfirm: "Looks right, switch on", visPreviewTitle: "Your catalog profile",
  visPreviewNote: "This is exactly what a manager sees. Full name, date of birth, citizenship, contacts and documents are never shown.",
  visHiddenTitle: "Hidden managers", visHiddenEmpty: "You haven't hidden from anyone.",
  visRecentTitle: "Viewed or invited you in 90 days", visHide: "Hide", visNoInvites: "No invites", visUnhide: "Undo",
  visModeHidden: "can't see you in the catalog", visModeNoInvites: "can see you, can't invite",
  visHideNote: "If you apply to this manager's casting yourself, they'll see your profile under the usual casting rules.",
  visNeverShown: "Never shown: full name, date of birth, citizenship, contacts and Telegram, KYC documents, wallet.",
  pulseTitle: "Pulse, last 7 days", pulseViews: "managers viewed", pulseCatalogViews: "from the catalog", pulseShortlisted: "added to a shortlist",
  pulseInvites: "invites", pulseEmpty: "Quiet for now. New photos, updated details or a video keep your profile up to date.",
  promptTitle: "Open up to verified managers", promptText: "The VOYAGE catalog is private: only approved managers see profiles, you see every view, and they never get your contacts. Switch it on in “My visibility”.",
  promptCta: "See how it looks", promptLater: "Not now",
  inboxTitle: "Catalog invites", inboxKicker: "Found you in the catalog", inboxFrom: "Manager",
  inboxTours: (n) => `completed tours: ${n}`, inboxFee: "Fee", inboxFlight: "Flight", inboxHotel: "Hotel",
  paidBy: { manager: "manager", participant: "you", split: "split" },
  inboxInterested: "Interested", inboxNotNow: "Not now", inboxBlock: "Don't invite me",
  inboxBlockConfirm: "This manager won't be able to invite you again. You can undo it in “My visibility”.",
  inboxOpenCasting: "Open the casting and apply", inboxRespondHint: "You apply with the usual casting button; option and handshake work as always.",
  inboxOpenToursHint: "To apply, switch on “Open to tours” in the casting feed.",
  inboxCantRespond: "You can't apply right now: check the casting requirements.", inboxUntil: (d) => `until ${d}`,
  inboxNote: "No contacts are shared before the handshake.",
  catEyebrow: "Resident catalog", catTitle: "Open to offers",
  catSubtitle: "Residents who chose to open their profile to verified VOYAGE managers. Every view is visible to her. Contacts only after the handshake.",
  catGateTitle: "Catalog unavailable",
  catGate: {
    not_authenticated: "Sign in with a manager account.", not_manager: "The catalog is for VOYAGE managers only.",
    not_approved: "The catalog opens to approved managers.", catalog_disabled: "The catalog hasn't launched yet. We'll let you know when it opens.",
    no_access: "Access is granted by the VOYAGE owner after review. Contact support if you need it.", suspended: "Your catalog access is suspended.", expired: "Your catalog access has expired.",
  },
  catStaffDisabled: "The catalog is off for managers. You see it as VOYAGE staff.",
  catLimits: (a, b, c, d) => `Today: profiles ${a} of ${b} · invites ${c} of ${d}`,
  catWatermarkNote: "Photos and videos carry your code and the date.",
  fCity: "City", fHub: "Location", fLanguages: "Languages", fHeight: "Height", fKyc: "KYC", fSize: "Size", fVideo: "Video",
  fVideoAny: "All", fVideoHas: "With video", fVideoFresh: "Fresh video", fDates: "Available on", fReset: "Reset", fApply: "Show", fFilters: "Filters",
  fForCasting: "For a casting", fForCastingNone: "No open castings", fForCastingPick: "Pick a casting",
  found: (n) => `Found: ${n}`, empty: "No one matches these filters.", more: "Show more",
  cardOpen: "Open profile", cardVideo: "Has video", cardNoVideo: "No video", cardVideoPrivate: "She shows video only to managers she works with.",
  cardParams: "Details", cardBodyHidden: "Weight and measurements hidden by her", cardSizes: "Sizes", cardLanguages: "Languages", cardBusy: "Busy",
  cardSince: (d) => `in the catalog since ${d}`, cardPrev: "Previous", cardNext: "Next", cardBack: "Catalog", cardPos: (a, b) => `${a} of ${b}`, cardNavHint: "← → to browse, Esc to close",
  shortTitle: "Shortlists", shortNew: "New shortlist", shortNewPlaceholder: "e.g. “Dubai, April”", shortCreate: "Create",
  shortAdd: "Shortlist", shortIn: "Shortlisted", shortRemove: "Remove", shortEmpty: "This shortlist is empty.",
  shortUnavailable: "Profile unavailable", shortPrune: "Remove unavailable", shortDelete: "Delete shortlist",
  shortDeleteConfirm: "Delete this shortlist?", shortInviteAll: "Invite the whole shortlist", shortAll: "All profiles",
  inviteTitle: "Invite to a casting", inviteCasting: "Casting", inviteNoCastings: "No open castings. Create one to send invites.",
  inviteMessage: "Personal note", inviteMessageHint: "Up to 300 characters, no links, phone numbers or @handles.", inviteSend: "Invite",
  inviteSent: "Invite sent.", inviteBatchResult: (ok, total) => `Sent ${ok} of ${total}.`,
  inviteBlocked: "She doesn't accept invites from you.", inviteDisabledBusy: "Busy on the casting dates",
  sentTitle: "My invites", sentWithdraw: "Withdraw", sentHidden: "profile unavailable",
  ownEyebrow: "Control · owner only", ownTitle: "Resident catalog",
  ownSubtitle: "Which managers see the catalog, their limits and events. Access is granted explicitly and only to approved managers.",
  ownEnabled: "Catalog is on for managers", ownDisabled: "Catalog is off for managers",
  ownEnable: "Switch catalog on", ownDisable: "Switch catalog off",
  ownSettingsMissing: "The catalog master switch row is missing in the database, so enabling will not work. Run CATALOG_ENABLE_DIAG.sql.",
  ownReasonRequired: "Write a reason first (3+ characters) — it goes to the log.", ownSaveLimits: "Save limits", ownLimitsSaved: "Default limits saved",
  ownSwitchHint: "A reason is required to switch the catalog on or off.", ownLimitsHint: "This button only changes limits and does not switch the catalog on.",
  ownLawyer: "Decision D5: switch on after the legal review. Residents can prepare their profiles in advance.",
  ownDefaults: "Default daily limits", ownOpens: "Profile opens", ownInvites: "Invites",
  ownReason: "Reason", ownReasonHint: "Saved to the log (3+ characters).", ownSave: "Save", ownEdit: "Manage access",
  ownResidents: (o, l, p, v) => `Opted in: ${o} · visible now: ${l} · paused: ${p} · video for catalog: ${v}`,
  ownInvites7: (n) => `Invites in 7 days: ${n}`, ownManagers: "Managers", ownCode: "Mark code", ownToday: "Today",
  ownAccess: { active: "Access on", suspended: "Suspended", none: "No access" },
  ownGrant: "Grant access", ownSuspend: "Suspend", ownRevoke: "Remove access",
  ownNotEligible: "Not approved or blocked — access can't be granted", ownExpires: "Valid until (optional)",
  ownLimitEvents: "Limit hits", ownAccessEvents: "Access changes", ownNoEvents: "No events.",
  ownReadOnly: "View only. Only the owner can change access.", ownKindOpens: "profile opens", ownKindInvites: "invites",
  modCatalog: "Catalog", modCatalogOff: "not in the catalog", modCatalogOn: (v, i) => `in the catalog · views in 30 days: ${v} · invites: ${i}`,
  modPaused: (d) => `paused until ${d}`,
};

const ES: Copy = {
  ...EN,
  freshness: { fresh: "Al día", aging: "Hora de actualizar", stale: "Sin actualizar hace tiempo", none: "" },
  inviteStatus: { pending: "Esperando respuesta", interested: "Me interesa", not_now: "Ahora no", blocked: "Sin invitaciones", withdrawn: "Retirada", expired: "Caducada" },
  errors: {
    ...EN.errors,
    not_authenticated: "Inicia sesión.", not_manager: "El catálogo es solo para managers de VOYAGE.",
    not_approved: "Solo managers aprobados pueden usar el catálogo.", catalog_disabled: "El catálogo está desactivado por ahora.",
    no_access: "El acceso lo concede el owner de VOYAGE.", suspended: "Tu acceso al catálogo está suspendido.", expired: "Tu acceso al catálogo ha caducado.",
    unavailable: "Este perfil no está disponible ahora.", limit_opens: "Has alcanzado el límite de perfiles de hoy.", limit_invites: "Has alcanzado el límite de invitaciones de hoy.",
    invalid: "Revisa los datos.", message_contacts: "Sin enlaces, teléfonos, correos ni @usuarios, hasta 300 caracteres.",
    not_your_casting: "Solo puedes invitar a tu propio casting.", casting_closed: "El casting está cerrado.",
    invites_blocked: "No acepta invitaciones tuyas.", invite_pending: "Ya tiene tu invitación.",
    invite_cooldown: "Respondió «Ahora no»: podrás invitar de nuevo en 14 días.",
    already_in_casting: "Ya se postuló a este casting.", casting_requirements: "No cumple los requisitos del casting (KYC o segmento).",
    busy: "Está ocupada en las fechas del casting.", shortlist_limit: "Hasta 30 selecciones.", shortlist_full: "Hasta 100 perfiles por selección.",
    not_found: "No encontrado.", preview_required: "Primero mira cómo te ven los managers.", invite_closed: "La invitación ya está cerrada.",
    forbidden: "No permitido.", manager_not_eligible: "Este manager no está aprobado o está bloqueado.",
    schema: "El catálogo aún no está instalado en la base de datos.", failed: "Algo salió mal. Inténtalo de nuevo.",
    not_saved: "La base de datos no confirmó el cambio: no se cambió nada. Ejecuta CATALOG_ENABLE_DIAG.sql.",
  },
  years: (n) => `${n} años`,
  busy: "Ocupada", free: "Disponible", loading: "Cargando…", retry: "Reintentar", close: "Cerrar",
  ringIntro: "Presentación", ringFresh: "Frescura", ringOpen: "Ir al vídeo",
  visTitle: "Mi visibilidad", visKicker: "Catálogo VOYAGE",
  visLead: "Tú decides quién ve qué. Cada vista de un manager aparece en «Quién vio».",
  visCatalog: "Abierta a propuestas", visCatalogHint: "Tu perfil en el catálogo privado para managers verificados de VOYAGE. Nunca reciben tus contactos.",
  visCatalogOff: "Tu perfil no está en el catálogo. Los managers lo ven solo en castings a los que te postulaste y en tus tours.",
  visCatalogDisabled: "El catálogo aún no está abierto a managers. Tus ajustes se guardan y se aplicarán cuando VOYAGE lo active.",
  visListed: "Perfil en el catálogo", visNotListed: "Aún no está en el catálogo", visNeed: "Para aparecer en el catálogo:",
  visNeedApproved: "perfil aprobado por VOYAGE", visNeedKyc: "KYC nivel 1 (pasaporte)", visNeedPhotos: (n) => `al menos 3 fotos de portafolio (ahora ${n})`,
  visNeedRestricted: "sin restricciones de cuenta", visVideoNote: "El vídeo es opcional y no influye en tu lugar en el catálogo. La base del perfil son las fotos.",
  visBody: "Mostrar peso y medidas", visBodyHint: "Altura y tallas se ven siempre; peso y medidas solo si lo activas.",
  visPause: "Pausa", visPauseHint: "Tu perfil sale del catálogo un tiempo y vuelve solo.", visPauseDays: (n) => `${n} días`,
  visPausedUntil: (d) => `En pausa hasta el ${d}`, visResume: "Quitar pausa",
  visPreview: "Cómo te ven los managers", visPreviewFirst: "Antes de activarlo, mira cómo se ve tu perfil en el catálogo.",
  visPreviewConfirm: "Todo bien, activar", visPreviewTitle: "Tu perfil en el catálogo",
  visPreviewNote: "Esto es exactamente lo que ve un manager. Nombre completo, fecha de nacimiento, nacionalidad, contactos y documentos nunca se muestran.",
  visHiddenTitle: "Managers ocultos", visHiddenEmpty: "No te has ocultado de nadie.",
  visRecentTitle: "Te vieron o invitaron en 90 días", visHide: "Ocultarme", visNoInvites: "Sin invitaciones", visUnhide: "Deshacer",
  visModeHidden: "no te ve en el catálogo", visModeNoInvites: "te ve, no puede invitar",
  visHideNote: "Si te postulas tú al casting de este manager, verá tu perfil según las reglas habituales del casting.",
  visNeverShown: "Nunca se muestran: nombre completo, fecha de nacimiento, nacionalidad, contactos y Telegram, documentos KYC, monedero.",
  pulseTitle: "Pulso, últimos 7 días", pulseViews: "managers vieron", pulseCatalogViews: "desde el catálogo", pulseShortlisted: "te añadieron a una selección",
  pulseInvites: "invitaciones", pulseEmpty: "Todo tranquilo. Fotos nuevas, datos actualizados o un vídeo mantienen tu perfil al día.",
  promptTitle: "Ábrete a managers verificados", promptText: "El catálogo VOYAGE es privado: solo managers aprobados ven perfiles, tú ves cada vista y nunca reciben tus contactos. Actívalo en «Mi visibilidad».",
  promptCta: "Ver cómo se ve", promptLater: "Ahora no",
  inboxTitle: "Invitaciones del catálogo", inboxKicker: "Te encontraron en el catálogo",
  inboxTours: (n) => `tours completados: ${n}`, inboxFee: "Honorarios", inboxFlight: "Vuelo", inboxHotel: "Hotel",
  paidBy: { manager: "manager", participant: "tú", split: "a medias" },
  inboxInterested: "Me interesa", inboxNotNow: "Ahora no", inboxBlock: "No invitarme",
  inboxBlockConfirm: "Este manager no podrá invitarte de nuevo. Puedes deshacerlo en «Mi visibilidad».",
  inboxOpenCasting: "Abrir el casting y postularme", inboxRespondHint: "Te postulas con el botón habitual del casting; opción y apretón de manos como siempre.",
  inboxOpenToursHint: "Para postularte, activa «Disponible para tours» en el feed de castings.",
  inboxCantRespond: "Ahora no puedes postularte: revisa los requisitos del casting.", inboxUntil: (d) => `hasta el ${d}`,
  inboxNote: "No se comparten contactos antes del apretón de manos.",
  catEyebrow: "Catálogo de residentes", catTitle: "Abiertas a propuestas",
  catSubtitle: "Residentes que decidieron abrir su perfil a managers verificados de VOYAGE. Cada vista es visible para ella. Contactos solo tras el apretón de manos.",
  catGateTitle: "Catálogo no disponible",
  catGate: {
    not_authenticated: "Inicia sesión con una cuenta de manager.", not_manager: "El catálogo es solo para managers de VOYAGE.",
    not_approved: "El catálogo se abre a managers aprobados.", catalog_disabled: "El catálogo aún no se ha lanzado. Te avisaremos cuando abra.",
    no_access: "El acceso lo concede el owner de VOYAGE tras revisión. Escribe a soporte si lo necesitas.", suspended: "Tu acceso al catálogo está suspendido.", expired: "Tu acceso al catálogo ha caducado.",
  },
  catStaffDisabled: "El catálogo está desactivado para managers. Lo ves como personal de VOYAGE.",
  catLimits: (a, b, c, d) => `Hoy: perfiles ${a} de ${b} · invitaciones ${c} de ${d}`,
  catWatermarkNote: "Fotos y vídeos llevan tu código y la fecha.",
  fCity: "Ciudad", fHub: "Ubicación", fLanguages: "Idiomas", fHeight: "Altura", fSize: "Talla", fVideo: "Vídeo",
  fVideoAny: "Todas", fVideoHas: "Con vídeo", fVideoFresh: "Vídeo reciente", fDates: "Disponible en", fReset: "Restablecer", fApply: "Mostrar", fFilters: "Filtros",
  fForCasting: "Para un casting", fForCastingNone: "No hay castings abiertos", fForCastingPick: "Elige un casting",
  found: (n) => `Encontradas: ${n}`, empty: "Nadie coincide con estos filtros.", more: "Mostrar más",
  cardOpen: "Abrir perfil", cardVideo: "Con vídeo", cardNoVideo: "Sin vídeo", cardVideoPrivate: "Solo muestra vídeo a los managers con los que trabaja.",
  cardParams: "Datos", cardBodyHidden: "Peso y medidas ocultos por ella", cardSizes: "Tallas", cardLanguages: "Idiomas", cardBusy: "Ocupada",
  cardSince: (d) => `en el catálogo desde ${d}`, cardPrev: "Anterior", cardNext: "Siguiente", cardBack: "Catálogo", cardPos: (a, b) => `${a} de ${b}`, cardNavHint: "← → para pasar, Esc para cerrar",
  shortTitle: "Selecciones", shortNew: "Nueva selección", shortNewPlaceholder: "p. ej. «Dubái, abril»", shortCreate: "Crear",
  shortAdd: "A selección", shortIn: "En selección", shortRemove: "Quitar", shortEmpty: "La selección está vacía.",
  shortUnavailable: "Perfil no disponible", shortPrune: "Quitar no disponibles", shortDelete: "Eliminar selección",
  shortDeleteConfirm: "¿Eliminar esta selección?", shortInviteAll: "Invitar a toda la selección", shortAll: "Todos los perfiles",
  inviteTitle: "Invitar a un casting", inviteNoCastings: "No hay castings abiertos. Crea uno para invitar.",
  inviteMessage: "Nota personal", inviteMessageHint: "Hasta 300 caracteres, sin enlaces, teléfonos ni @usuarios.", inviteSend: "Invitar",
  inviteSent: "Invitación enviada.", inviteBatchResult: (ok, total) => `Enviadas ${ok} de ${total}.`,
  inviteBlocked: "No acepta invitaciones tuyas.", inviteDisabledBusy: "Ocupada en las fechas del casting",
  sentTitle: "Mis invitaciones", sentWithdraw: "Retirar", sentHidden: "perfil no disponible",
  ownEyebrow: "Control · solo owner", ownTitle: "Catálogo de residentes",
  ownSubtitle: "Qué managers ven el catálogo, sus límites y eventos. El acceso se concede de forma explícita y solo a managers aprobados.",
  ownEnabled: "Catálogo activado para managers", ownDisabled: "Catálogo desactivado para managers",
  ownEnable: "Activar catálogo", ownDisable: "Desactivar catálogo",
  ownSettingsMissing: "Falta en la base la fila del interruptor general del catálogo; activarlo no funcionará. Ejecuta CATALOG_ENABLE_DIAG.sql.",
  ownReasonRequired: "Primero escribe un motivo (3+ caracteres): se guarda en el registro.", ownSaveLimits: "Guardar límites", ownLimitsSaved: "Límites por defecto guardados",
  ownSwitchHint: "El motivo es obligatorio para activar o desactivar el catálogo.", ownLimitsHint: "Este botón solo cambia los límites y no activa el catálogo.",
  ownLawyer: "Decisión D5: activar tras la revisión legal. Las residentes pueden preparar sus perfiles antes.",
  ownDefaults: "Límites diarios por defecto", ownOpens: "Perfiles abiertos", ownInvites: "Invitaciones",
  ownReason: "Motivo", ownReasonHint: "Se guarda en el registro (3+ caracteres).", ownSave: "Guardar", ownEdit: "Gestionar acceso",
  ownResidents: (o, l, p, v) => `Activaron: ${o} · visibles ahora: ${l} · en pausa: ${p} · vídeo para catálogo: ${v}`,
  ownInvites7: (n) => `Invitaciones en 7 días: ${n}`, ownCode: "Código de marca", ownToday: "Hoy",
  ownAccess: { active: "Acceso activo", suspended: "Suspendido", none: "Sin acceso" },
  ownGrant: "Dar acceso", ownSuspend: "Suspender", ownRevoke: "Quitar acceso",
  ownNotEligible: "No aprobado o bloqueado: no se puede dar acceso", ownExpires: "Válido hasta (opcional)",
  ownLimitEvents: "Límites alcanzados", ownAccessEvents: "Cambios de acceso", ownNoEvents: "Sin eventos.",
  ownReadOnly: "Solo lectura. Solo el owner cambia accesos.", ownKindOpens: "perfiles abiertos", ownKindInvites: "invitaciones",
  modCatalog: "Catálogo", modCatalogOff: "no está en el catálogo", modCatalogOn: (v, i) => `en el catálogo · vistas en 30 días: ${v} · invitaciones: ${i}`,
  modPaused: (d) => `en pausa hasta el ${d}`,
};

const PT: Copy = {
  ...EN,
  freshness: { fresh: "Atualizado", aging: "Hora de atualizar", stale: "Sem atualização há muito", none: "" },
  inviteStatus: { pending: "Aguarda resposta", interested: "Interessa-me", not_now: "Agora não", blocked: "Sem convites", withdrawn: "Retirado", expired: "Expirado" },
  errors: {
    ...EN.errors,
    not_authenticated: "Inicie sessão.", not_manager: "O catálogo é só para managers da VOYAGE.",
    not_approved: "Só managers aprovados podem usar o catálogo.", catalog_disabled: "O catálogo está desligado por agora.",
    no_access: "O acesso é dado pelo owner da VOYAGE.", suspended: "O seu acesso ao catálogo está suspenso.", expired: "O seu acesso ao catálogo expirou.",
    unavailable: "Este perfil não está disponível agora.", limit_opens: "Atingiu o limite de perfis de hoje.", limit_invites: "Atingiu o limite de convites de hoje.",
    invalid: "Verifique os dados.", message_contacts: "Sem links, telefones, e-mails ou @utilizadores, até 300 caracteres.",
    not_your_casting: "Só pode convidar para o seu casting.", casting_closed: "O casting está fechado.",
    invites_blocked: "Ela não aceita convites seus.", invite_pending: "Ela já tem o seu convite.",
    invite_cooldown: "Ela respondeu «Agora não» — pode convidar de novo daqui a 14 dias.",
    already_in_casting: "Ela já se candidatou a este casting.", casting_requirements: "Ela não cumpre os requisitos do casting (KYC ou segmento).",
    busy: "Ela está ocupada nas datas do casting.", shortlist_limit: "Até 30 seleções.", shortlist_full: "Até 100 perfis por seleção.",
    not_found: "Não encontrado.", preview_required: "Veja primeiro como os managers a veem.", invite_closed: "O convite já está fechado.",
    forbidden: "Não permitido.", manager_not_eligible: "Este manager não está aprovado ou está bloqueado.",
    schema: "O catálogo ainda não está instalado na base de dados.", failed: "Algo correu mal. Tente de novo.",
    not_saved: "A base de dados não confirmou a alteração: nada mudou. Execute CATALOG_ENABLE_DIAG.sql.",
  },
  years: (n) => `${n} anos`,
  busy: "Ocupada", free: "Disponível", loading: "A carregar…", retry: "Tentar de novo", close: "Fechar",
  ringIntro: "Apresentação", ringFresh: "Atualidade", ringOpen: "Ir para o vídeo",
  visTitle: "A minha visibilidade", visKicker: "Catálogo VOYAGE",
  visLead: "É você quem decide quem vê o quê. Cada visualização de um manager aparece em «Quem viu».",
  visCatalog: "Aberta a propostas", visCatalogHint: "O seu perfil no catálogo privado para managers verificados da VOYAGE. Nunca recebem os seus contactos.",
  visCatalogOff: "O seu perfil não está no catálogo. Os managers só o veem nos castings a que se candidatou e nos seus tours.",
  visCatalogDisabled: "O catálogo ainda não está aberto a managers. As definições ficam guardadas e aplicam-se quando a VOYAGE o ligar.",
  visListed: "Perfil no catálogo", visNotListed: "Ainda não está no catálogo", visNeed: "Para aparecer no catálogo:",
  visNeedApproved: "perfil aprovado pela VOYAGE", visNeedKyc: "KYC nível 1 (passaporte)", visNeedPhotos: (n) => `pelo menos 3 fotos no portefólio (agora ${n})`,
  visNeedRestricted: "sem restrições na conta", visVideoNote: "O vídeo é opcional e não influencia o seu lugar no catálogo. A base do perfil são as fotos.",
  visBody: "Mostrar peso e medidas", visBodyHint: "Altura e tamanhos aparecem sempre; peso e medidas só se ligar isto.",
  visPause: "Pausa", visPauseHint: "O perfil sai do catálogo por algum tempo e volta sozinho.", visPauseDays: (n) => `${n} dias`,
  visPausedUntil: (d) => `Em pausa até ${d}`, visResume: "Terminar pausa",
  visPreview: "Como os managers a veem", visPreviewFirst: "Antes de ligar, veja como o seu perfil aparece no catálogo.",
  visPreviewConfirm: "Está certo, ligar", visPreviewTitle: "O seu perfil no catálogo",
  visPreviewNote: "É exatamente isto que um manager vê. Nome completo, data de nascimento, nacionalidade, contactos e documentos nunca aparecem.",
  visHiddenTitle: "Managers ocultos", visHiddenEmpty: "Não se ocultou de ninguém.",
  visRecentTitle: "Viram ou convidaram em 90 dias", visHide: "Ocultar-me", visNoInvites: "Sem convites", visUnhide: "Desfazer",
  visModeHidden: "não a vê no catálogo", visModeNoInvites: "vê, mas não convida",
  visHideNote: "Se se candidatar ao casting deste manager, ele verá o perfil pelas regras normais do casting.",
  visNeverShown: "Nunca aparecem: nome completo, data de nascimento, nacionalidade, contactos e Telegram, documentos KYC, carteira.",
  pulseTitle: "Pulso, últimos 7 dias", pulseViews: "managers viram", pulseCatalogViews: "pelo catálogo", pulseShortlisted: "adicionaram a uma seleção",
  pulseInvites: "convites", pulseEmpty: "Tudo calmo. Fotos novas, dados atualizados ou um vídeo mantêm o perfil atualizado.",
  promptTitle: "Abra-se a managers verificados", promptText: "O catálogo VOYAGE é privado: só managers aprovados veem perfis, você vê cada visualização e eles nunca recebem os seus contactos. Ligue-o em «A minha visibilidade».",
  promptCta: "Ver como fica", promptLater: "Agora não",
  inboxTitle: "Convites do catálogo", inboxKicker: "Encontraram-na no catálogo",
  inboxTours: (n) => `tours concluídos: ${n}`, inboxFee: "Cachê", inboxFlight: "Voo", inboxHotel: "Hotel",
  paidBy: { manager: "manager", participant: "você", split: "a meias" },
  inboxInterested: "Interessa-me", inboxNotNow: "Agora não", inboxBlock: "Não me convidar",
  inboxBlockConfirm: "Este manager não poderá voltar a convidá-la. Pode desfazer em «A minha visibilidade».",
  inboxOpenCasting: "Abrir o casting e candidatar-me", inboxRespondHint: "Candidata-se com o botão habitual do casting; opção e aperto de mão como sempre.",
  inboxOpenToursHint: "Para se candidatar, ligue «Disponível para tours» no feed de castings.",
  inboxCantRespond: "Agora não pode candidatar-se: veja os requisitos do casting.", inboxUntil: (d) => `até ${d}`,
  inboxNote: "Nenhum contacto é partilhado antes do aperto de mão.",
  catEyebrow: "Catálogo de residentes", catTitle: "Abertas a propostas",
  catSubtitle: "Residentes que decidiram abrir o perfil a managers verificados da VOYAGE. Cada visualização é visível para ela. Contactos só após o aperto de mão.",
  catGateTitle: "Catálogo indisponível",
  catGate: {
    not_authenticated: "Inicie sessão com uma conta de manager.", not_manager: "O catálogo é só para managers da VOYAGE.",
    not_approved: "O catálogo abre para managers aprovados.", catalog_disabled: "O catálogo ainda não foi lançado. Avisaremos quando abrir.",
    no_access: "O acesso é dado pelo owner da VOYAGE após revisão. Contacte o suporte se precisar.", suspended: "O seu acesso ao catálogo está suspenso.", expired: "O seu acesso ao catálogo expirou.",
  },
  catStaffDisabled: "O catálogo está desligado para managers. Vê-o como equipa VOYAGE.",
  catLimits: (a, b, c, d) => `Hoje: perfis ${a} de ${b} · convites ${c} de ${d}`,
  catWatermarkNote: "Fotos e vídeos levam o seu código e a data.",
  fCity: "Cidade", fHub: "Localização", fLanguages: "Idiomas", fHeight: "Altura", fSize: "Tamanho", fVideo: "Vídeo",
  fVideoAny: "Todas", fVideoHas: "Com vídeo", fVideoFresh: "Vídeo recente", fDates: "Disponível em", fReset: "Repor", fApply: "Mostrar", fFilters: "Filtros",
  fForCasting: "Para um casting", fForCastingNone: "Sem castings abertos", fForCastingPick: "Escolha um casting",
  found: (n) => `Encontradas: ${n}`, empty: "Ninguém corresponde a estes filtros.", more: "Mostrar mais",
  cardOpen: "Abrir perfil", cardVideo: "Com vídeo", cardNoVideo: "Sem vídeo", cardVideoPrivate: "Só mostra vídeo aos managers com quem trabalha.",
  cardParams: "Dados", cardBodyHidden: "Peso e medidas ocultos por ela", cardSizes: "Tamanhos", cardLanguages: "Idiomas", cardBusy: "Ocupada",
  cardSince: (d) => `no catálogo desde ${d}`, cardPrev: "Anterior", cardNext: "Seguinte", cardBack: "Catálogo", cardPos: (a, b) => `${a} de ${b}`, cardNavHint: "← → para navegar, Esc para fechar",
  shortTitle: "Seleções", shortNew: "Nova seleção", shortNewPlaceholder: "ex.: «Dubai, abril»", shortCreate: "Criar",
  shortAdd: "Para seleção", shortIn: "Na seleção", shortRemove: "Remover", shortEmpty: "A seleção está vazia.",
  shortUnavailable: "Perfil indisponível", shortPrune: "Remover indisponíveis", shortDelete: "Apagar seleção",
  shortDeleteConfirm: "Apagar esta seleção?", shortInviteAll: "Convidar a seleção inteira", shortAll: "Todos os perfis",
  inviteTitle: "Convidar para um casting", inviteNoCastings: "Sem castings abertos. Crie um para convidar.",
  inviteMessage: "Nota pessoal", inviteMessageHint: "Até 300 caracteres, sem links, telefones ou @utilizadores.", inviteSend: "Convidar",
  inviteSent: "Convite enviado.", inviteBatchResult: (ok, total) => `Enviados ${ok} de ${total}.`,
  inviteBlocked: "Ela não aceita convites seus.", inviteDisabledBusy: "Ocupada nas datas do casting",
  sentTitle: "Os meus convites", sentWithdraw: "Retirar", sentHidden: "perfil indisponível",
  ownEyebrow: "Controlo · só owner", ownTitle: "Catálogo de residentes",
  ownSubtitle: "Que managers veem o catálogo, os seus limites e eventos. O acesso é dado de forma explícita e só a managers aprovados.",
  ownEnabled: "Catálogo ligado para managers", ownDisabled: "Catálogo desligado para managers",
  ownEnable: "Ligar catálogo", ownDisable: "Desligar catálogo",
  ownSettingsMissing: "Falta na base a linha do interruptor geral do catálogo; ligar não vai funcionar. Execute CATALOG_ENABLE_DIAG.sql.",
  ownReasonRequired: "Escreva primeiro um motivo (3+ caracteres): fica no registo.", ownSaveLimits: "Guardar limites", ownLimitsSaved: "Limites por defeito guardados",
  ownSwitchHint: "O motivo é obrigatório para ligar ou desligar o catálogo.", ownLimitsHint: "Este botão só altera os limites e não liga o catálogo.",
  ownLawyer: "Decisão D5: ligar após a revisão jurídica. As residentes podem preparar os perfis antes.",
  ownDefaults: "Limites diários por defeito", ownOpens: "Perfis abertos", ownInvites: "Convites",
  ownReason: "Motivo", ownReasonHint: "Fica no registo (3+ caracteres).", ownSave: "Guardar", ownEdit: "Gerir acesso",
  ownResidents: (o, l, p, v) => `Ligaram: ${o} · visíveis agora: ${l} · em pausa: ${p} · vídeo para catálogo: ${v}`,
  ownInvites7: (n) => `Convites em 7 dias: ${n}`, ownCode: "Código da marca", ownToday: "Hoje",
  ownAccess: { active: "Acesso ativo", suspended: "Suspenso", none: "Sem acesso" },
  ownGrant: "Dar acesso", ownSuspend: "Suspender", ownRevoke: "Retirar acesso",
  ownNotEligible: "Não aprovado ou bloqueado — não é possível dar acesso", ownExpires: "Válido até (opcional)",
  ownLimitEvents: "Limites atingidos", ownAccessEvents: "Alterações de acesso", ownNoEvents: "Sem eventos.",
  ownReadOnly: "Só leitura. Só o owner altera acessos.", ownKindOpens: "perfis abertos", ownKindInvites: "convites",
  modCatalog: "Catálogo", modCatalogOff: "não está no catálogo", modCatalogOn: (v, i) => `no catálogo · visualizações em 30 dias: ${v} · convites: ${i}`,
  modPaused: (d) => `em pausa até ${d}`,
};

export const CATALOG_COPY: Record<CatalogLang, Copy> = { RU, EN, ES, PT };
export const catalogCopy = (lang: string | null | undefined): Copy => CATALOG_COPY[catalogLang(lang)];
export type CatalogCopy = Copy;

/* ── каталог 2.0, этап A: фото — основа, видео — бонус ─────────────── */

type PhotoFirstCopy = {
  badgeFresh: string;
  badgeVideo: string;
  photos: (n: number) => string;
  actuality: string;
  updated: Record<UpdatedKind, (d: string) => string>;
  tabPhotos: string;
  tabVideo: string;
  galleryOpen: string;
  galleryPos: (a: number, b: number) => string;
  galleryPrev: string;
  galleryNext: string;
  galleryClose: string;
  galleryThumb: (n: number) => string;
  fMaterials: string;
  fMatAny: string;
  fMatVideo: string;
  fMatFresh: string;
  fSort: string;
  sortUpdated: string;
  sortNew: string;
  ringTitle: string;
  ringNote: string;
  ringIntro: string;
  ringMoment: string;
  ringAdd: string;
  needCity: string;
  needHeight: string;
  needLanguages: string;
  basicsTitle: string;
  basicsText: string;
  basicsCity: string;
  basicsHeight: string;
  langsLabel: string;
  langsHint: string;
  langsSave: string;
  langsSaved: string;
  langsError: string;
  ownMissingBasics: (n: number) => string;
  watermarkPhotos: string;
};

const PF: Record<CatalogLang, PhotoFirstCopy> = {
  RU: {
    badgeFresh: "Актуально", badgeVideo: "Видео",
    photos: (n) => `${n} фото`,
    actuality: "Актуальность",
    updated: { photos: (d) => `Новые фото · ${d}`, profile: (d) => `Анкета обновлена · ${d}`, video: (d) => `Новое видео · ${d}` },
    tabPhotos: "Фото", tabVideo: "Видео",
    galleryOpen: "Открыть фото на весь экран", galleryPos: (a, b) => `${a} / ${b}`,
    galleryPrev: "Предыдущее фото", galleryNext: "Следующее фото", galleryClose: "Закрыть фото", galleryThumb: (n) => `Фото ${n}`,
    fMaterials: "Материалы", fMatAny: "Все анкеты", fMatVideo: "С видео", fMatFresh: "Обновлены за 30 дней",
    fSort: "Порядок", sortUpdated: "Сначала актуальные", sortNew: "Новые в каталоге",
    ringTitle: "Живость анкеты", ringNote: "По желанию. На заполненность и место в каталоге не влияет.",
    ringIntro: "Визитка", ringMoment: "Moment", ringAdd: "Добавить видео",
    needCity: "город", needHeight: "рост", needLanguages: "хотя бы один язык",
    basicsTitle: "Анкета сейчас не видна менеджерам",
    basicsText: "В каталоге менеджеры ищут по городу, росту и языкам, поэтому эти поля теперь обязательны. Добавьте недостающее, и анкета вернётся в каталог сама, включать её заново не нужно.",
    basicsCity: "Указать город", basicsHeight: "Указать рост",
    langsLabel: "Языки", langsHint: "До 5. Видят менеджеры каталога и кастингов.", langsSave: "Сохранить языки",
    langsSaved: "Языки сохранены", langsError: "Не удалось сохранить языки. Попробуйте ещё раз.",
    ownMissingBasics: (n) => `Включили каталог, но не видны менеджерам: ${n}. Не хватает города, роста или языка, им показано уведомление.`,
    watermarkPhotos: "Фото помечены вашим кодом и датой.",
  },
  EN: {
    badgeFresh: "Up to date", badgeVideo: "Video",
    photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
    actuality: "Up to date",
    updated: { photos: (d) => `New photos · ${d}`, profile: (d) => `Profile updated · ${d}`, video: (d) => `New video · ${d}` },
    tabPhotos: "Photos", tabVideo: "Video",
    galleryOpen: "Open photo full screen", galleryPos: (a, b) => `${a} / ${b}`,
    galleryPrev: "Previous photo", galleryNext: "Next photo", galleryClose: "Close photo", galleryThumb: (n) => `Photo ${n}`,
    fMaterials: "Materials", fMatAny: "All profiles", fMatVideo: "With video", fMatFresh: "Updated in 30 days",
    fSort: "Order", sortUpdated: "Most up to date first", sortNew: "New in catalog",
    ringTitle: "Profile liveliness", ringNote: "Optional. Does not affect completeness or your place in the catalog.",
    ringIntro: "Intro", ringMoment: "Moment", ringAdd: "Add video",
    needCity: "city", needHeight: "height", needLanguages: "at least one language",
    basicsTitle: "Managers can’t see your profile right now",
    basicsText: "Managers search the catalog by city, height and languages, so these fields are now required. Add what is missing and your profile returns to the catalog automatically, no need to switch it on again.",
    basicsCity: "Add city", basicsHeight: "Add height",
    langsLabel: "Languages", langsHint: "Up to 5. Visible to catalog and casting managers.", langsSave: "Save languages",
    langsSaved: "Languages saved", langsError: "Could not save languages. Please try again.",
    ownMissingBasics: (n) => `Opted in but not visible to managers: ${n}. City, height or language is missing; they see a notice.`,
    watermarkPhotos: "Photos carry your code and the date.",
  },
  ES: {
    badgeFresh: "Al día", badgeVideo: "Vídeo",
    photos: (n) => `${n} foto${n === 1 ? "" : "s"}`,
    actuality: "Actualidad",
    updated: { photos: (d) => `Fotos nuevas · ${d}`, profile: (d) => `Perfil actualizado · ${d}`, video: (d) => `Vídeo nuevo · ${d}` },
    tabPhotos: "Fotos", tabVideo: "Vídeo",
    galleryOpen: "Abrir foto a pantalla completa", galleryPos: (a, b) => `${a} / ${b}`,
    galleryPrev: "Foto anterior", galleryNext: "Foto siguiente", galleryClose: "Cerrar foto", galleryThumb: (n) => `Foto ${n}`,
    fMaterials: "Materiales", fMatAny: "Todos los perfiles", fMatVideo: "Con vídeo", fMatFresh: "Actualizados en 30 días",
    fSort: "Orden", sortUpdated: "Primero los más al día", sortNew: "Nuevos en el catálogo",
    ringTitle: "Vida del perfil", ringNote: "Opcional. No influye en el porcentaje ni en tu lugar en el catálogo.",
    ringIntro: "Presentación", ringMoment: "Moment", ringAdd: "Añadir vídeo",
    needCity: "ciudad", needHeight: "altura", needLanguages: "al menos un idioma",
    basicsTitle: "Ahora los managers no ven tu perfil",
    basicsText: "En el catálogo los managers buscan por ciudad, altura e idiomas, por eso estos campos ahora son obligatorios. Añade lo que falta y tu perfil volverá al catálogo solo, sin activarlo de nuevo.",
    basicsCity: "Indicar ciudad", basicsHeight: "Indicar altura",
    langsLabel: "Idiomas", langsHint: "Hasta 5. Los ven los managers del catálogo y de los castings.", langsSave: "Guardar idiomas",
    langsSaved: "Idiomas guardados", langsError: "No se pudieron guardar los idiomas. Inténtalo de nuevo.",
    ownMissingBasics: (n) => `Activaron el catálogo pero no son visibles: ${n}. Falta ciudad, altura o idioma; ven un aviso.`,
    watermarkPhotos: "Las fotos llevan tu código y la fecha.",
  },
  PT: {
    badgeFresh: "Atualizado", badgeVideo: "Vídeo",
    photos: (n) => `${n} foto${n === 1 ? "" : "s"}`,
    actuality: "Atualidade",
    updated: { photos: (d) => `Fotos novas · ${d}`, profile: (d) => `Perfil atualizado · ${d}`, video: (d) => `Vídeo novo · ${d}` },
    tabPhotos: "Fotos", tabVideo: "Vídeo",
    galleryOpen: "Abrir foto em ecrã inteiro", galleryPos: (a, b) => `${a} / ${b}`,
    galleryPrev: "Foto anterior", galleryNext: "Foto seguinte", galleryClose: "Fechar foto", galleryThumb: (n) => `Foto ${n}`,
    fMaterials: "Materiais", fMatAny: "Todos os perfis", fMatVideo: "Com vídeo", fMatFresh: "Atualizados em 30 dias",
    fSort: "Ordem", sortUpdated: "Mais atualizados primeiro", sortNew: "Novos no catálogo",
    ringTitle: "Vida do perfil", ringNote: "Opcional. Não influencia a percentagem nem o seu lugar no catálogo.",
    ringIntro: "Apresentação", ringMoment: "Moment", ringAdd: "Adicionar vídeo",
    needCity: "cidade", needHeight: "altura", needLanguages: "pelo menos um idioma",
    basicsTitle: "Neste momento os managers não veem o seu perfil",
    basicsText: "No catálogo os managers pesquisam por cidade, altura e idiomas, por isso estes campos passaram a ser obrigatórios. Adicione o que falta e o perfil volta ao catálogo sozinho, sem o ligar outra vez.",
    basicsCity: "Indicar cidade", basicsHeight: "Indicar altura",
    langsLabel: "Idiomas", langsHint: "Até 5. Visíveis para os managers do catálogo e dos castings.", langsSave: "Guardar idiomas",
    langsSaved: "Idiomas guardados", langsError: "Não foi possível guardar os idiomas. Tente novamente.",
    ownMissingBasics: (n) => `Ligaram o catálogo mas não estão visíveis: ${n}. Falta cidade, altura ou idioma; veem um aviso.`,
    watermarkPhotos: "As fotos levam o seu código e a data.",
  },
};

export const photoFirstCopy = (lang: string | null | undefined): PhotoFirstCopy => PF[catalogLang(lang)];
export type PhotoFirstCopyT = PhotoFirstCopy;

/** Что не хватает до D6 (пусто — всё есть или база ещё этапа 2) */
export function missingBasics(ck: ChecklistState): ("city" | "height" | "languages")[] {
  if (!ck.basicsRequired) return [];
  return (["city", "height", "languages"] as const).filter((k) => !ck[k]);
}
