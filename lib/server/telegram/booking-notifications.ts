import "server-only";

import { Api, InlineKeyboard } from "grammy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { fmtDay, fmtDuration, fmtMoney, fmtTime, minutesBetween, tzCity, type UiLang } from "@/lib/tour-ops/time";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — уведомления модели о букингах в Telegram
 *
 * Очередь public.tour_booking_notifications пишет триггер на tour_bookings
 * (новый заказ, перенос, смена статуса, отмена, смена формата/адреса/суммы).
 * Здесь — отправка: время в поясе тура, формат, длительность, доля модели,
 * адрес при Outcall, имя гостя (без телефона) и кнопка в Комнату тура.
 *
 * Текст строится по ТЕКУЩИМ данным заказа в момент отправки, поэтому в
 * очереди хранится только ссылка на заказ (без адреса и сумм).
 *
 * Запуск: после каждого действия с заказом в кабинетах (server actions)
 * и опросом /api/telegram/notify с source=scheduler (повторы ошибок).
 * ──────────────────────────────────────────────────────────────────── */

type Kind = "created" | "rescheduled" | "status" | "cancelled" | "updated";

type Row = {
  id: string;
  booking_id: string;
  tour_id: string;
  recipient_id: string;
  kind: Kind;
  payload: Record<string, unknown> | null;
  attempts: number;
};

const FALLBACK_SITE = "https://voyage-models.com";

function langOf(value: unknown): UiLang {
  return value === "EN" || value === "ES" || value === "PT" ? value : "RU";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Ссылка в Комнату тура: только публичный https, иначе боевой домен (Telegram отклонит http/localhost). */
function roomUrl(tourId: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE).trim();
  try {
    const url = new URL(`/dashboard/tour-room/${tourId}`, base.endsWith("/") ? base : `${base}/`);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".local");
    if (url.protocol === "https:" && !local) return url.toString();
  } catch {
    // ниже — боевой домен
  }
  return `${FALLBACK_SITE}/dashboard/tour-room/${tourId}`;
}

const COPY: Record<UiLang, {
  title: Record<Kind, string>;
  reassigned: string;
  when: string; was: string; format: string; duration: string; toReceive: string; address: string; guest: string; status: string; reason: string;
  statuses: Record<string, string>; formats: Record<string, string>; button: string; tz: (city: string) => string;
}> = {
  RU: {
    title: { created: "🗓 Новый заказ", rescheduled: "🔁 Заказ перенесён", status: "📍 Статус заказа изменён", cancelled: "✖️ Заказ отменён", updated: "✏️ Заказ изменён" },
    reassigned: "Заказ передан другой модели.",
    when: "Когда", was: "Было", format: "Формат", duration: "Длительность", toReceive: "К получению", address: "Адрес выезда", guest: "Гость", status: "Статус", reason: "Причина",
    statuses: { scheduled: "Ожидается", en_route: "Выехала / у двери", in_progress: "В процессе", completed: "Завершён", cancelled: "Отменён" },
    formats: { incall: "Incall", outcall: "Outcall" },
    button: "🗝 Открыть Комнату тура", tz: (c) => `время ${c}`,
  },
  EN: {
    title: { created: "🗓 New booking", rescheduled: "🔁 Booking rescheduled", status: "📍 Booking status changed", cancelled: "✖️ Booking cancelled", updated: "✏️ Booking updated" },
    reassigned: "The booking was moved to another model.",
    when: "When", was: "Was", format: "Format", duration: "Duration", toReceive: "You receive", address: "Outcall address", guest: "Guest", status: "Status", reason: "Reason",
    statuses: { scheduled: "Scheduled", en_route: "En route / at the door", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
    formats: { incall: "Incall", outcall: "Outcall" },
    button: "🗝 Open tour room", tz: (c) => `${c} time`,
  },
  ES: {
    title: { created: "🗓 Nueva reserva", rescheduled: "🔁 Reserva reprogramada", status: "📍 Estado de la reserva", cancelled: "✖️ Reserva cancelada", updated: "✏️ Reserva modificada" },
    reassigned: "La reserva pasó a otra modelo.",
    when: "Cuándo", was: "Antes", format: "Formato", duration: "Duración", toReceive: "A recibir", address: "Dirección", guest: "Huésped", status: "Estado", reason: "Motivo",
    statuses: { scheduled: "Programada", en_route: "En camino / en la puerta", in_progress: "En curso", completed: "Completada", cancelled: "Cancelada" },
    formats: { incall: "Incall", outcall: "Outcall" },
    button: "🗝 Abrir sala del tour", tz: (c) => `hora de ${c}`,
  },
  PT: {
    title: { created: "🗓 Nova reserva", rescheduled: "🔁 Reserva remarcada", status: "📍 Status da reserva", cancelled: "✖️ Reserva cancelada", updated: "✏️ Reserva alterada" },
    reassigned: "A reserva foi passada para outra modelo.",
    when: "Quando", was: "Antes", format: "Formato", duration: "Duração", toReceive: "A receber", address: "Endereço", guest: "Hóspede", status: "Status", reason: "Motivo",
    statuses: { scheduled: "Agendada", en_route: "A caminho / na porta", in_progress: "Em andamento", completed: "Concluída", cancelled: "Cancelada" },
    formats: { incall: "Incall", outcall: "Outcall" },
    button: "🗝 Abrir sala do tour", tz: (c) => `hora de ${c}`,
  },
};

function isBanned(p: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (p.ban_permanent === true || p.banned_until === "infinity") return true;
  const until = p.banned_until ? Date.parse(p.banned_until) : NaN;
  return Number.isFinite(until) && until > Date.now();
}

async function finish(id: string, status: "sent" | "failed" | "skipped", error: string | null): Promise<void> {
  const { error: updateError } = await getTelegramServiceClient()
    .from("tour_booking_notifications")
    .update({ status, error, sent_at: status === "sent" ? new Date().toISOString() : null })
    .eq("id", id);
  if (updateError) console.error("[booking-notify] finish failed", updateError.code ?? "unknown");
}

async function deliver(api: Api, row: Row): Promise<"sent" | "failed" | "skipped"> {
  const db = getTelegramServiceClient();
  const [{ data: booking }, { data: recipient }, { data: tour }, { data: settings }] = await Promise.all([
    db.from("tour_bookings").select("id,model_id,format,starts_at,ends_at,outcall_address,model_amount,currency,status,cancel_reason,guest_label").eq("id", row.booking_id).maybeSingle(),
    db.from("profiles").select("id,role,telegram_id,telegram_language,banned_until,ban_permanent").eq("id", row.recipient_id).maybeSingle(),
    db.from("partner_tours").select("id,city").eq("id", row.tour_id).maybeSingle(),
    db.from("tour_ops_settings").select("timezone").eq("tour_id", row.tour_id).maybeSingle(),
  ]);
  if (!booking || !recipient || !tour) {
    await finish(row.id, "skipped", "missing_data");
    return "skipped";
  }
  const chatId = String(recipient.telegram_id ?? "");
  if (!/^[0-9]{4,20}$/.test(chatId) || recipient.role !== "resident" || isBanned(recipient)) {
    await finish(row.id, "skipped", "no_telegram_or_inactive");
    return "skipped";
  }
  const reassignedAway = row.payload?.reassigned === true || String(booking.model_id) !== row.recipient_id;

  const lang = langOf(recipient.telegram_language);
  const t = COPY[lang];
  const tz = String(settings?.timezone ?? "UTC");
  const city = String(tour.city || tzCity(tz));
  const startsAt = String(booking.starts_at);
  const endsAt = String(booking.ends_at);
  const when = `${fmtDay(startsAt, tz, lang)}, ${fmtTime(startsAt, tz, lang)}–${fmtTime(endsAt, tz, lang)} (${t.tz(city)})`;

  const lines: string[] = [`<b>${escapeHtml(t.title[reassignedAway ? "cancelled" : row.kind])} · ${escapeHtml(city)}</b>`, ""];
  if (reassignedAway) {
    lines.push(escapeHtml(t.reassigned), `${t.when}: ${escapeHtml(when)}`);
  } else {
    lines.push(`${t.when}: <b>${escapeHtml(when)}</b>`);
    const oldStart = typeof row.payload?.old_starts_at === "string" ? row.payload.old_starts_at : null;
    const oldEnd = typeof row.payload?.old_ends_at === "string" ? row.payload.old_ends_at : null;
    if (row.kind === "rescheduled" && oldStart && oldEnd) {
      lines.push(`${t.was}: <s>${escapeHtml(`${fmtDay(oldStart, tz, lang)}, ${fmtTime(oldStart, tz, lang)}–${fmtTime(oldEnd, tz, lang)}`)}</s>`);
    }
    if (row.kind !== "cancelled") {
      lines.push(`${t.format}: ${escapeHtml(t.formats[String(booking.format)] ?? String(booking.format))} · ${t.duration}: ${escapeHtml(fmtDuration(minutesBetween(startsAt, endsAt), lang))}`);
      lines.push(`${t.toReceive}: <b>${escapeHtml(fmtMoney(Number(booking.model_amount ?? 0), String(booking.currency || "USD"), lang))}</b>`);
      if (booking.format === "outcall" && booking.outcall_address) lines.push(`${t.address}: ${escapeHtml(String(booking.outcall_address))}`);
      if (booking.guest_label) lines.push(`${t.guest}: ${escapeHtml(String(booking.guest_label))}`);
    }
    if (row.kind === "status" || row.kind === "cancelled") {
      lines.push(`${t.status}: <b>${escapeHtml(t.statuses[String(booking.status)] ?? String(booking.status))}</b>`);
    }
    if (row.kind === "cancelled" && booking.cancel_reason) lines.push(`${t.reason}: ${escapeHtml(String(booking.cancel_reason))}`);
  }

  try {
    await api.sendMessage(Number(chatId), lines.join("\n"), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      protect_content: true,
      reply_markup: new InlineKeyboard().url(t.button, roomUrl(row.tour_id)),
    });
    await finish(row.id, "sent", null);
    return "sent";
  } catch (error) {
    const code = error && typeof error === "object" && "error_code" in error ? String((error as { error_code: unknown }).error_code) : "send_failed";
    // 403 — модель заблокировала бота: повторять бессмысленно
    await finish(row.id, code === "403" ? "skipped" : "failed", `telegram_${code}`);
    return code === "403" ? "skipped" : "failed";
  }
}

export type BookingDrainSummary = { selected: number; sent: number; failed: number; skipped: number };

/** Отправить накопившиеся уведомления (по туру или все). Никогда не бросает. */
export async function drainBookingNotifications(options: { tourId?: string | null; limit?: number } = {}): Promise<BookingDrainSummary> {
  const summary: BookingDrainSummary = { selected: 0, sent: 0, failed: 0, skipped: 0 };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return summary;
  try {
    const { data, error } = await getTelegramServiceClient().rpc("voyage_claim_booking_notifications", {
      p_limit: options.limit ?? 25,
      p_tour: options.tourId ?? null,
    });
    if (error) {
      console.error("[booking-notify] claim failed", error.code ?? "unknown");
      return summary;
    }
    const rows = (Array.isArray(data) ? data : []) as Row[];
    summary.selected = rows.length;
    const api = new Api(token);
    for (const row of rows) {
      const result = await deliver(api, row);
      summary[result] += 1;
    }
  } catch (error) {
    console.error("[booking-notify] drain threw", error instanceof Error ? error.name : "unknown");
  }
  return summary;
}
