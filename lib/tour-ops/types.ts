/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — типы и разбор ответов RPC
 * lib/tour-ops/types.ts
 *
 * Все RPC модуля возвращают jsonb. Здесь — типы и безопасный разбор:
 * неизвестные значения не роняют страницу, а становятся null / дефолтом.
 * ──────────────────────────────────────────────────────────────────── */

export const BOOKING_STATUSES = ["scheduled", "en_route", "in_progress", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_FORMATS = ["incall", "outcall"] as const;
export type BookingFormat = (typeof BOOKING_FORMATS)[number];

export const PAYMENT_METHODS = ["cash", "card", "transfer", "crypto", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const GUEST_STATUSES = ["neutral", "vip", "caution", "blacklist"] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export const GUEST_TAGS = [
  "polite", "generous", "regular", "punctual", "verified",
  "late", "no_show", "haggling", "rude", "drunk", "unsafe", "fake_payment", "police_risk",
] as const;
export type GuestTag = (typeof GUEST_TAGS)[number];
export const GUEST_TAGS_GOOD: readonly GuestTag[] = ["polite", "generous", "regular", "punctual", "verified"];

export const DOC_KINDS = ["ticket", "boarding_pass", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export type TourAccess = "owner" | "manager" | "operator" | "resident";

/** Следующий шаг заказа в один клик (cancel — отдельно, с причиной). */
export const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  scheduled: "en_route",
  en_route: "in_progress",
  in_progress: "completed",
};

export type TourListItem = {
  id: string;
  city: string;
  countryCode: string | null;
  status: string;
  departsAt: string;
  returnsAt: string | null;
  access: TourAccess | null;
  managerName: string;
  timezone: string;
  currency: string;
  hasSettings: boolean;
  models: number;
  operators: number | null;
  bookingsOpen: number;
  bookingsToday: number;
  revenue: number | null;
};

export type BoardModel = {
  id: string;
  name: string;
  avatarUrl: string | null;
  memberStatus: string;
  ticketUploaded: boolean;
  checkedInAt: string | null;
  apartmentId: string | null;
};

export type BoardOperator = {
  id: string;
  linkId: string;
  name: string;
  allModels: boolean;
  modelIds: string[];
  status: string | null;
};

export type Booking = {
  id: string;
  modelId: string;
  operatorId: string | null;
  operatorName: string | null;
  guestId: string | null;
  guestLabel: string | null;
  guestStatus: GuestStatus | null;
  format: BookingFormat;
  startsAt: string;
  endsAt: string;
  outcallAddress: string | null;
  totalAmount: number;
  modelAmount: number;
  agencyAmount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: BookingStatus;
  cancelReason: string | null;
  notes: string | null;
};

export type TourSettings = {
  exists: boolean;
  timezone: string;
  currency: string;
  modelSharePct: number;
  bufferMinutes: number;
};

export type TourBoard = {
  access: TourAccess;
  me: string;
  myTimezone: string | null;
  tour: {
    id: string;
    city: string;
    countryCode: string | null;
    iata: string | null;
    status: string;
    departsAt: string;
    returnsAt: string | null;
    managerId: string;
    managerName: string;
  };
  settings: TourSettings;
  models: BoardModel[];
  operators: BoardOperator[] | null;
  bookings: Booking[];
};

export type GuestReview = {
  id: string;
  author: string;
  authorRole: string;
  tags: GuestTag[];
  note: string | null;
  isRemoved: boolean;
  removedReason: string | null;
  createdAt: string;
};

export type GuestCard = {
  id: string;
  displayName: string | null;
  phone: string | null;
  telegram: string | null;
  whatsapp: string | null;
  status: GuestStatus;
  statusReason: string | null;
  statusSetAt: string | null;
  statusSetBy: string | null;
  reviewsTotal: number;
  flags: Partial<Record<GuestTag, number>>;
  reviews: GuestReview[];
  statusLog?: { oldStatus: string | null; newStatus: string; reason: string | null; actor: string; createdAt: string }[];
};

export type Apartment = {
  id: string;
  tourId: string;
  title: string;
  address: string;
  mapUrl: string | null;
  entranceCode: string | null;
  intercomCode: string | null;
  safeCode: string | null;
  wifi: string | null;
  hostContact: string | null;
  notes: string | null;
};

export type Logistics = { modelId: string; apartmentId: string | null; checkedInAt: string | null };

export type TourDocument = {
  id: string;
  modelId: string;
  kind: DocKind;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  createdAt: string;
  uploadedBy?: string;
  mine?: boolean;
};

export type ResidentBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  format: BookingFormat;
  outcallAddress: string | null;
  modelAmount: number;
  currency: string;
  status: BookingStatus;
  guestLabel: string | null;
  cancelReason: string | null;
};

export type ResidentRoom = {
  tour: { id: string; city: string; countryCode: string | null; iata: string | null; flightNo: string | null; status: string; departsAt: string; returnsAt: string | null; managerName: string };
  timezone: string;
  myTimezone: string | null;
  schedule: ResidentBooking[];
  documents: TourDocument[];
  apartment: Omit<Apartment, "tourId"> | null;
  readiness: { ticketUploaded: boolean; checkedInAt: string | null };
};

/* ── разбор ────────────────────────────────────────────────────────── */

type J = Record<string, unknown>;
export const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
export const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length ? v : null);
export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
export const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));
export function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}
const ACCESS = ["owner", "manager", "operator", "resident"] as const;

export function parseTourList(v: unknown): TourListItem[] {
  return arr(v).map((raw) => {
    const r = obj(raw);
    return {
      id: str(r.id),
      city: str(r.city),
      countryCode: strOrNull(r.country_code),
      status: str(r.status),
      departsAt: str(r.departs_at),
      returnsAt: strOrNull(r.returns_at),
      access: typeof r.access === "string" ? oneOf(r.access, ACCESS, "operator") : null,
      managerName: str(r.manager_name),
      timezone: str(r.timezone) || "UTC",
      currency: str(r.currency) || "USD",
      hasSettings: r.has_settings === true,
      models: num(r.models),
      operators: numOrNull(r.operators),
      bookingsOpen: num(r.bookings_open),
      bookingsToday: num(r.bookings_today),
      revenue: numOrNull(r.revenue),
    };
  });
}

export function parseBooking(raw: unknown): Booking {
  const b = obj(raw);
  return {
    id: str(b.id),
    modelId: str(b.model_id),
    operatorId: strOrNull(b.operator_id),
    operatorName: strOrNull(b.operator_name),
    guestId: strOrNull(b.guest_id),
    guestLabel: strOrNull(b.guest_label),
    guestStatus: typeof b.guest_status === "string" ? oneOf(b.guest_status, GUEST_STATUSES, "neutral") : null,
    format: oneOf(b.format, BOOKING_FORMATS, "incall"),
    startsAt: str(b.starts_at),
    endsAt: str(b.ends_at),
    outcallAddress: strOrNull(b.outcall_address),
    totalAmount: num(b.total_amount),
    modelAmount: num(b.model_amount),
    agencyAmount: num(b.agency_amount),
    currency: str(b.currency) || "USD",
    paymentMethod: oneOf(b.payment_method, PAYMENT_METHODS, "cash"),
    status: oneOf(b.status, BOOKING_STATUSES, "scheduled"),
    cancelReason: strOrNull(b.cancel_reason),
    notes: strOrNull(b.notes),
  };
}

export function parseBoard(v: unknown): TourBoard | null {
  const r = obj(v);
  if (!r.tour) return null;
  const t = obj(r.tour);
  const s = obj(r.settings);
  return {
    access: oneOf(r.access, ACCESS, "operator"),
    me: str(r.me),
    myTimezone: strOrNull(r.my_timezone),
    tour: {
      id: str(t.id),
      city: str(t.city),
      countryCode: strOrNull(t.country_code),
      iata: strOrNull(t.iata),
      status: str(t.status),
      departsAt: str(t.departs_at),
      returnsAt: strOrNull(t.returns_at),
      managerId: str(t.manager_id),
      managerName: str(t.manager_name),
    },
    settings: {
      exists: s.exists === true,
      timezone: str(s.timezone) || "UTC",
      currency: str(s.currency) || "USD",
      modelSharePct: num(s.model_share_pct ?? 50),
      bufferMinutes: num(s.buffer_minutes ?? 30),
    },
    models: arr(r.models).map((raw) => {
      const m = obj(raw);
      return {
        id: str(m.id),
        name: str(m.name) || "—",
        avatarUrl: strOrNull(m.avatar_url),
        memberStatus: str(m.member_status),
        ticketUploaded: m.ticket_uploaded === true,
        checkedInAt: strOrNull(m.checked_in_at),
        apartmentId: strOrNull(m.apartment_id),
      };
    }),
    operators: Array.isArray(r.operators)
      ? r.operators.map((raw) => {
          const o = obj(raw);
          return {
            id: str(o.id),
            linkId: str(o.link_id),
            name: str(o.name),
            allModels: o.all_models === true,
            modelIds: arr(o.model_ids).map(str),
            status: strOrNull(o.status),
          };
        })
      : null,
    bookings: arr(r.bookings).map(parseBooking),
  };
}

export function parseGuest(v: unknown): GuestCard | null {
  const g = obj(v);
  if (!g.id) return null;
  const flags: Partial<Record<GuestTag, number>> = {};
  for (const [k, n] of Object.entries(obj(g.flags))) {
    if ((GUEST_TAGS as readonly string[]).includes(k)) flags[k as GuestTag] = num(n);
  }
  return {
    id: str(g.id),
    displayName: strOrNull(g.display_name),
    phone: strOrNull(g.phone),
    telegram: strOrNull(g.telegram),
    whatsapp: strOrNull(g.whatsapp),
    status: oneOf(g.status, GUEST_STATUSES, "neutral"),
    statusReason: strOrNull(g.status_reason),
    statusSetAt: strOrNull(g.status_set_at),
    statusSetBy: strOrNull(g.status_set_by),
    reviewsTotal: num(g.reviews_total),
    flags,
    reviews: arr(g.reviews).map((raw) => {
      const x = obj(raw);
      return {
        id: str(x.id),
        author: str(x.author),
        authorRole: str(x.author_role),
        tags: arr(x.tags).filter((t): t is GuestTag => (GUEST_TAGS as readonly string[]).includes(str(t))),
        note: strOrNull(x.note),
        isRemoved: x.is_removed === true,
        removedReason: strOrNull(x.removed_reason),
        createdAt: str(x.created_at),
      };
    }),
    statusLog: Array.isArray(g.status_log)
      ? g.status_log.map((raw) => {
          const l = obj(raw);
          return {
            oldStatus: strOrNull(l.old_status),
            newStatus: str(l.new_status),
            reason: strOrNull(l.reason),
            actor: str(l.actor),
            createdAt: str(l.created_at),
          };
        })
      : undefined,
  };
}

export function parseApartment(raw: unknown): Apartment {
  const a = obj(raw);
  return {
    id: str(a.id),
    tourId: str(a.tour_id),
    title: str(a.title),
    address: str(a.address),
    mapUrl: strOrNull(a.map_url),
    entranceCode: strOrNull(a.entrance_code),
    intercomCode: strOrNull(a.intercom_code),
    safeCode: strOrNull(a.safe_code),
    wifi: strOrNull(a.wifi),
    hostContact: strOrNull(a.host_contact),
    notes: strOrNull(a.notes),
  };
}

export function parseLogistics(v: unknown): Logistics[] {
  return arr(v).map((raw) => {
    const l = obj(raw);
    return { modelId: str(l.model_id), apartmentId: strOrNull(l.apartment_id), checkedInAt: strOrNull(l.checked_in_at) };
  });
}

export function parseDocuments(v: unknown): TourDocument[] {
  return arr(v).map((raw) => {
    const d = obj(raw);
    return {
      id: str(d.id),
      modelId: str(d.model_id),
      kind: oneOf(d.kind, DOC_KINDS, "other"),
      fileName: str(d.file_name),
      storagePath: str(d.storage_path),
      mimeType: strOrNull(d.mime_type),
      createdAt: str(d.created_at),
      uploadedBy: strOrNull(d.uploaded_by) ?? undefined,
      mine: d.mine === true,
    };
  });
}

export function parseResidentRoom(v: unknown): ResidentRoom | null {
  const r = obj(v);
  if (!r.tour) return null;
  const t = obj(r.tour);
  const ap = r.apartment ? parseApartment(r.apartment) : null;
  const rd = obj(r.readiness);
  return {
    tour: {
      id: str(t.id),
      city: str(t.city),
      countryCode: strOrNull(t.country_code),
      iata: strOrNull(t.iata),
      flightNo: strOrNull(t.flight_no),
      status: str(t.status),
      departsAt: str(t.departs_at),
      returnsAt: strOrNull(t.returns_at),
      managerName: str(t.manager_name),
    },
    timezone: str(r.timezone) || "UTC",
    myTimezone: strOrNull(r.my_timezone),
    schedule: arr(r.schedule).map((raw) => {
      const b = obj(raw);
      return {
        id: str(b.id),
        startsAt: str(b.starts_at),
        endsAt: str(b.ends_at),
        format: oneOf(b.format, BOOKING_FORMATS, "incall"),
        outcallAddress: strOrNull(b.outcall_address),
        modelAmount: num(b.model_amount),
        currency: str(b.currency) || "USD",
        status: oneOf(b.status, BOOKING_STATUSES, "scheduled"),
        guestLabel: strOrNull(b.guest_label),
        cancelReason: strOrNull(b.cancel_reason),
      };
    }),
    documents: parseDocuments(r.documents),
    apartment: ap ? (({ tourId: _omit, ...rest }) => rest)(ap) : null,
    readiness: { ticketUploaded: rd.ticket_uploaded === true, checkedInAt: strOrNull(rd.checked_in_at) },
  };
}

/** Код ошибки «voyage:xxx» из сообщения Postgres. */
export function errorCode(message: string | null | undefined): string {
  const m = /voyage:([a-z_]+)/.exec(message ?? "");
  if (m) return m[1];
  if (/row-level security|permission denied/i.test(message ?? "")) return "forbidden";
  return "failed";
}
