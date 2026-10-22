"use server";

import { createClient } from "@/lib/supabase/server";

export type CastingActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function inputError(...values: string[]) {
  return values.some((value) => !UUID_RE.test(value));
}

function messageFor(error: { code?: string; message: string }) {
  if (error.code === "42501") return "Недостаточно прав для этого действия.";
  if (error.code === "P0002") return "Кастинг, отклик или тур не найден.";
  if (error.message.includes("casting_full")) return "Все места уже зарезервированы или заняты.";
  if (error.message.includes("candidate_not_eligible")) return "Кандидатка больше не проходит условия допуска (KYC / Blacklist).";
  if (error.message.includes("tour_locked")) return "Для рукопожатия нужен подтверждённый тур.";
  if (error.message.includes("tour_casting_mismatch")) return "Тур не совпадает с городом или типом проекта кастинга.";
  if (error.message.includes("casting_closed")) return "Кастинг закрыт или срок откликов истёк.";
  if (error.message.includes("response_not_declineable")) return "Этот отклик уже обработан и не может быть отклонён повторно.";
  if (error.message.includes("invalid_iata")) return "Код аэропорта — три латинские буквы, например DXB.";
  if (error.message.includes("invalid_dates")) return "Проверьте даты: возвращение не раньше вылета.";
  if (error.message.includes("casting_cancelled")) return "Кастинг отменён — тур создать нельзя.";
  return error.message || "Не удалось выполнить действие.";
}

/** Создать/продлить опцион. Лимиты мест и KYC повторно проверяются внутри RPC. */
export async function setCastingResponseOption(
  castingId: string,
  residentId: string,
  hours = 24,
): Promise<CastingActionResult> {
  if (inputError(castingId, residentId) || !Number.isInteger(hours) || hours < 1 || hours > 72) {
    return { ok: false, error: "Некорректные параметры опциона." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_set_option", {
    p_casting_id: castingId,
    p_resident_id: residentId,
    p_hours: hours,
  });
  return error ? { ok: false, error: messageFor(error) } : { ok: true };
}

/** Отказать только по активным ready/option ответам; selected не перезаписывается. */
export async function declineCastingResponse(
  castingId: string,
  residentId: string,
): Promise<CastingActionResult> {
  if (inputError(castingId, residentId)) return { ok: false, error: "Некорректные идентификаторы." };

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc("partner_manager_decline_response", {
    p_casting_id: castingId,
    p_resident_id: residentId,
  });
  return error ? { ok: false, error: messageFor(error) } : { ok: true };
}

/** Рукопожатие использует штатный RPC: связывает выбранную резидентку с подтверждённым туром. */
export async function completeCastingHandshake(
  castingId: string,
  tourId: string,
  residentId: string,
): Promise<CastingActionResult> {
  if (inputError(castingId, tourId, residentId)) return { ok: false, error: "Некорректные идентификаторы." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_handshake", {
    p_casting_id: castingId,
    p_tour_id: tourId,
    p_resident_id: residentId,
  });
  return error ? { ok: false, error: messageFor(error) } : { ok: true };
}

/** Подтверждённый тур из кастинга: организатор, город и тип проекта берутся из кастинга. */
export async function createTourFromCasting(
  castingId: string,
  input: { departsAt: string; returnsAt: string | null; flightNo?: string; iata?: string },
): Promise<CastingActionResult> {
  if (inputError(castingId)) return { ok: false, error: "Некорректный идентификатор кастинга." };
  const departs = Date.parse(input.departsAt);
  const returns = input.returnsAt ? Date.parse(input.returnsAt) : null;
  if (!Number.isFinite(departs) || (returns !== null && (!Number.isFinite(returns) || returns < departs))) {
    return { ok: false, error: "Проверьте даты: возвращение не раньше вылета." };
  }
  const iata = (input.iata ?? "").trim().toUpperCase();
  if (iata && !/^[A-Z]{3}$/.test(iata)) return { ok: false, error: "Код аэропорта — три латинские буквы, например DXB." };
  const flightNo = (input.flightNo ?? "").trim().slice(0, 12);

  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_create_tour", {
    p_casting: castingId,
    p_departs_at: new Date(departs).toISOString(),
    p_returns_at: returns === null ? null : new Date(returns).toISOString(),
    p_flight_no: flightNo || null,
    p_iata: iata || null,
  });
  return error ? { ok: false, error: messageFor(error) } : { ok: true };
}
