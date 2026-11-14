"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { drainBookingNotifications } from "@/lib/server/telegram/booking-notifications";
import { purgeExpiredTelegramMessages } from "@/lib/server/telegram/message-purge";
import { BOOKING_FORMATS, BOOKING_STATUSES, PAYMENT_METHODS, errorCode, type BookingFormat, type BookingStatus, type PaymentMethod } from "@/lib/tour-ops/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — действия с заказами, настройками, операторами тура
 * и апартаментами.
 *
 * Всё выполняется клиентом С СЕССИЕЙ пользователя: права решают RLS и
 * триггеры БД (admin к модулю доступа не имеет — см. миграции 202611130*).
 * Здесь — только проверка роли, разбор ввода и запуск уведомлений
 * моделям после изменений заказа.
 * ──────────────────────────────────────────────────────────────────── */

export type OpsResult<T = undefined> = { ok: true; data?: T } | { ok: false; code: string };

const DESK = ["owner", "manager", "operator"] as const;
const MANAGE = ["owner", "manager"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const clean = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
};
const money = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};

async function guard(roles: readonly ("owner" | "manager" | "operator" | "resident")[]): Promise<{ userId: string; role: string } | OpsResult> {
  try {
    return await requireRole(roles);
  } catch (error) {
    return { ok: false, code: error instanceof AuthorizationError ? "forbidden" : "failed" };
  }
}
const denied = (g: unknown): g is OpsResult => typeof g === "object" && g !== null && "ok" in g;

/** После изменения заказа: отправить уведомления модели и почистить старые пароли. */
async function afterBookingChange(tourId: string) {
  await drainBookingNotifications({ tourId, limit: 10 });
  await purgeExpiredTelegramMessages(10);
  revalidatePath(`/partner/bookings/${tourId}`);
}

/* ── заказы ───────────────────────────────────────────────────────── */

export type BookingInput = {
  id?: string | null;
  tourId: string;
  modelId: string;
  operatorId?: string | null;
  guestId?: string | null;
  guestLabel?: string | null;
  format: BookingFormat;
  startsAt: string;
  endsAt: string;
  outcallAddress?: string | null;
  totalAmount: number;
  modelAmount: number;
  agencyAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  /** Оператор/менеджер подтвердил «впритык» — пересечение БД не пропустит в любом случае. */
  confirmTight?: boolean;
};

export async function saveBooking(input: BookingInput): Promise<OpsResult<{ id: string }>> {
  const g = await guard(DESK);
  if (denied(g)) return g;
  if (!isUuid(input.tourId) || !isUuid(input.modelId) || (input.id && !isUuid(input.id))) return { ok: false, code: "failed" };
  if (!(BOOKING_FORMATS as readonly string[]).includes(input.format)) return { ok: false, code: "failed" };
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) return { ok: false, code: "failed" };
  const starts = new Date(input.startsAt);
  const ends = new Date(input.endsAt);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) return { ok: false, code: "failed" };
  const total = money(input.totalAmount);
  const model = money(input.modelAmount);
  const agency = money(input.agencyAmount);
  if ([total, model, agency].some(Number.isNaN) || Math.abs(model + agency - total) > 0.01) return { ok: false, code: "money_split" };
  if (input.format === "outcall" && !clean(input.outcallAddress)) return { ok: false, code: "address_required" };

  const supabase = await createClient();

  // Свободно ли окно (пересечение — жёсткий запрет в триггере; «впритык» — подтверждение).
  const { data: slot } = await supabase.rpc("voyage_booking_check_slot", {
    p_tour: input.tourId,
    p_model: input.modelId,
    p_starts: starts.toISOString(),
    p_ends: ends.toISOString(),
    p_exclude: input.id ?? null,
  });
  const s = (slot ?? {}) as { overlap?: boolean; tight?: boolean };
  if (s.overlap) return { ok: false, code: "booking_overlap" };
  if (s.tight && !input.confirmTight) return { ok: false, code: "slot_tight" };

  const row: Record<string, unknown> = {
    tour_id: input.tourId,
    model_id: input.modelId,
    guest_id: isUuid(input.guestId) ? input.guestId : null,
    guest_label: clean(input.guestLabel, 80),
    format: input.format,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    outcall_address: input.format === "outcall" ? clean(input.outcallAddress, 300) : null,
    total_amount: total,
    model_amount: model,
    agency_amount: agency,
    payment_method: input.paymentMethod,
    notes: clean(input.notes, 1000),
  };
  // Оператора назначает менеджер/owner; оператор всегда ставится сам (триггер).
  if (g.role !== "operator") row.operator_id = isUuid(input.operatorId) ? input.operatorId : null;

  const query = input.id
    ? supabase.from("tour_bookings").update(row).eq("id", input.id).select("id").maybeSingle()
    : supabase.from("tour_bookings").insert(row).select("id").maybeSingle();
  const { data, error } = await query;
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  await afterBookingChange(input.tourId);
  return { ok: true, data: { id: String(data.id) } };
}

/** Статус в один клик. Отмена — только с причиной (≥ 3 символа). */
export async function setBookingStatus(bookingId: string, status: BookingStatus, reason?: string | null): Promise<OpsResult> {
  const g = await guard(DESK);
  if (denied(g)) return g;
  if (!isUuid(bookingId) || !(BOOKING_STATUSES as readonly string[]).includes(status)) return { ok: false, code: "failed" };
  const why = clean(reason, 300);
  if (status === "cancelled" && (!why || why.length < 3)) return { ok: false, code: "reason_required" };

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "cancelled") patch.cancel_reason = why;
  const { data, error } = await supabase.from("tour_bookings").update(patch).eq("id", bookingId).select("tour_id").maybeSingle();
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  await afterBookingChange(String(data.tour_id));
  return { ok: true };
}

/** Физическое удаление — только owner. Остальные отменяют с причиной. */
export async function deleteBooking(bookingId: string): Promise<OpsResult> {
  const g = await guard(["owner"]);
  if (denied(g)) return g;
  if (!isUuid(bookingId)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tour_bookings").delete().eq("id", bookingId).select("tour_id").maybeSingle();
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  revalidatePath(`/partner/bookings/${String(data.tour_id)}`);
  return { ok: true };
}

/* ── настройки тура ───────────────────────────────────────────────── */

export async function saveTourSettings(
  tourId: string,
  input: { timezone: string; currency: string; modelSharePct: number; bufferMinutes: number },
): Promise<OpsResult> {
  const g = await guard(MANAGE);
  if (denied(g)) return g;
  if (!isUuid(tourId)) return { ok: false, code: "failed" };
  const currency = String(input.currency ?? "").trim().toUpperCase();
  const share = Math.round(Number(input.modelSharePct));
  const buffer = Math.round(Number(input.bufferMinutes));
  if (!/^[A-Z]{3}$/.test(currency) || !(share >= 0 && share <= 100) || !(buffer >= 0 && buffer <= 240)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { error } = await supabase.from("tour_ops_settings").upsert(
    { tour_id: tourId, timezone: String(input.timezone ?? "").trim(), currency, model_share_pct: share, buffer_minutes: buffer },
    { onConflict: "tour_id" },
  );
  if (error) return { ok: false, code: errorCode(error.message) };
  revalidatePath(`/partner/bookings/${tourId}`);
  return { ok: true };
}

/* ── операторы тура ───────────────────────────────────────────────── */

export async function assignTourOperator(tourId: string, operatorId: string, allModels: boolean, modelIds: string[]): Promise<OpsResult> {
  const g = await guard(MANAGE);
  if (denied(g)) return g;
  if (!isUuid(tourId) || !isUuid(operatorId)) return { ok: false, code: "failed" };
  const models = Array.from(new Set((modelIds ?? []).filter(isUuid))).slice(0, 100);
  if (!allModels && models.length === 0) return { ok: false, code: "pick_models" };

  const supabase = await createClient();
  const { data: link, error } = await supabase
    .from("tour_operators")
    .upsert({ tour_id: tourId, operator_id: operatorId, all_models: allModels }, { onConflict: "tour_id,operator_id" })
    .select("id")
    .maybeSingle();
  if (error || !link) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };

  const linkId = String(link.id);
  const { error: clearError } = await supabase.from("tour_operator_models").delete().eq("tour_operator_id", linkId);
  if (clearError) return { ok: false, code: errorCode(clearError.message) };
  if (!allModels) {
    const { error: modelsError } = await supabase
      .from("tour_operator_models")
      .insert(models.map((model_id) => ({ tour_operator_id: linkId, model_id })));
    if (modelsError) return { ok: false, code: errorCode(modelsError.message) };
  }
  revalidatePath(`/partner/bookings/${tourId}`);
  return { ok: true };
}

export async function unassignTourOperator(linkId: string): Promise<OpsResult> {
  const g = await guard(MANAGE);
  if (denied(g)) return g;
  if (!isUuid(linkId)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tour_operators").delete().eq("id", linkId).select("id").maybeSingle();
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  return { ok: true };
}

/* ── апартаменты и заселение ──────────────────────────────────────── */

export type ApartmentInput = {
  id?: string | null;
  tourId: string;
  title: string;
  address: string;
  mapUrl?: string | null;
  entranceCode?: string | null;
  intercomCode?: string | null;
  safeCode?: string | null;
  wifi?: string | null;
  hostContact?: string | null;
  notes?: string | null;
};

export async function saveApartment(input: ApartmentInput): Promise<OpsResult<{ id: string }>> {
  const g = await guard(MANAGE);
  if (denied(g)) return g;
  if (!isUuid(input.tourId) || (input.id && !isUuid(input.id))) return { ok: false, code: "failed" };
  const title = clean(input.title, 80);
  const address = clean(input.address, 300);
  if (!title || !address) return { ok: false, code: "failed" };
  const mapUrl = clean(input.mapUrl, 500);
  if (mapUrl && !/^https:\/\//i.test(mapUrl)) return { ok: false, code: "bad_url" };
  const row = {
    tour_id: input.tourId,
    title,
    address,
    map_url: mapUrl,
    entrance_code: clean(input.entranceCode, 60),
    intercom_code: clean(input.intercomCode, 60),
    safe_code: clean(input.safeCode, 60),
    wifi: clean(input.wifi, 120),
    host_contact: clean(input.hostContact, 200),
    notes: clean(input.notes, 1000),
  };
  const supabase = await createClient();
  const query = input.id
    ? supabase.from("tour_apartments").update(row).eq("id", input.id).select("id").maybeSingle()
    : supabase.from("tour_apartments").insert(row).select("id").maybeSingle();
  const { data, error } = await query;
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  return { ok: true, data: { id: String(data.id) } };
}

export async function deleteApartment(id: string): Promise<OpsResult> {
  const g = await guard(MANAGE);
  if (denied(g)) return g;
  if (!isUuid(id)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tour_apartments").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  return { ok: true };
}

export async function assignApartment(tourId: string, modelId: string, apartmentId: string | null): Promise<OpsResult> {
  const g = await guard(MANAGE);
  if (denied(g)) return g;
  if (!isUuid(tourId) || !isUuid(modelId) || (apartmentId !== null && !isUuid(apartmentId))) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tour_member_logistics")
    .upsert({ tour_id: tourId, model_id: modelId, apartment_id: apartmentId }, { onConflict: "tour_id,model_id" });
  if (error) return { ok: false, code: errorCode(error.message) };
  return { ok: true };
}

/** Отметка «заселена»: менеджер/owner или оператор, которому видна модель. */
export async function setCheckedIn(tourId: string, modelId: string, checkedIn: boolean): Promise<OpsResult> {
  const g = await guard(DESK);
  if (denied(g)) return g;
  if (!isUuid(tourId) || !isUuid(modelId)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("voyage_set_checked_in", { p_tour: tourId, p_model: modelId, p_checked_in: checkedIn });
  if (error) return { ok: false, code: errorCode(error.message) };
  return { ok: true };
}

/* ── мой часовой пояс (мелкое время на таймлайне) ─────────────────── */

export async function setMyTimezone(timezone: string): Promise<OpsResult> {
  const g = await guard(["owner", "manager", "operator", "resident"]);
  if (denied(g)) return g;
  const supabase = await createClient();
  const { error } = await supabase.rpc("voyage_set_my_timezone", { p_timezone: String(timezone ?? "").trim() || null });
  if (error) return { ok: false, code: errorCode(error.message) };
  return { ok: true };
}
