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
