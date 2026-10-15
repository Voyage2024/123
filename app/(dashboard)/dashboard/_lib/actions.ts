/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — действия ленты кастингов
 * app/(dashboard)/dashboard/_lib/actions.ts
 *
 * Все запросы идут из браузера через общий клиент. Права проверяет база
 * (RLS и partner_me_can_respond), а не этот файл:
 *   insert отклика — только своего, только 'ready', только если
 *   partner_me_can_respond(casting_id): полная верификация, тумблер
 *   «Открыта к турам», нет в Blacklist, кастинг открыт и не истёк;
 *   update — отозвать свой отклик ('ready' → 'withdrawn'), вернуть
 *   отозванный — только с тем же допуском.
 * ──────────────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; reason: "closed" | "forbidden" | "network" };

/**
 * 42501 — база не пустила. Из ленты резидентка видит только кастинги,
 * которые пускают, значит чаще всего кастинг уже закрыт или тумблер
 * выключили в другой вкладке.
 */
const reasonOf = (code: string | undefined): "closed" | "network" => (code === "42501" ? "closed" : "network");

/**
 * «Готова в тур». Один отклик на кастинг (unique casting_id + resident_id).
 * Если отклик уже был и отозван — возвращаем его update-ом. Upsert не
 * подходит: права выданы по колонкам, а upsert переписывает casting_id.
 */
export async function applyToCasting(castingId: string): Promise<ActionResult> {
  const { error } = await supabase
    .from("partner_casting_responses")
    .insert({ casting_id: castingId, status: "ready" });
  if (!error) return { ok: true };

  if (error.code === "23505") {
    const { data, error: again } = await supabase
      .from("partner_casting_responses")
      .update({ status: "ready" })
      .eq("casting_id", castingId)
      .eq("status", "withdrawn")
      .select("id");
    if (again) return { ok: false, reason: "network" };
    // ни одна строка не обновилась — отклик уже активен или не возвращается
    return data && data.length > 0 ? { ok: true } : { ok: false, reason: "closed" };
  }

  return { ok: false, reason: reasonOf(error.code) };
}

/** «Отозвать отклик» — пока менеджер не поставил опцион, без последствий */
export async function withdrawResponse(castingId: string): Promise<ActionResult> {
  const { error } = await supabase
    .from("partner_casting_responses")
    .update({ status: "withdrawn" })
    .eq("casting_id", castingId)
    .eq("status", "ready");
  return error ? { ok: false, reason: "network" } : { ok: true };
}

/** Тумблер «Открыта к турам»: выключен — менеджеры её не видят, кастинги не приходят */
export async function setOpenToTours(open: boolean): Promise<ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "forbidden" };

  const { data, error } = await supabase
    .from("partner_resident_settings")
    .update({ open_to_tours: open })
    .eq("resident_id", user.id)
    .select("resident_id");
  if (error) return { ok: false, reason: "network" };

  if (data?.length === 0) {
    const { error: ins } = await supabase
      .from("partner_resident_settings")
      .insert({ resident_id: user.id, open_to_tours: open });
    return ins ? { ok: false, reason: "network" } : { ok: true };
  }
  return { ok: true };
}

/**
 * Лента просмотрена: «Новые» считаются от этого момента.
 * Строку настроек создаём, если её ещё нет.
 */
export async function markCastingsSeen(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_resident_settings")
    .update({ castings_seen_at: now })
    .eq("resident_id", user.id)
    .select("resident_id");
  if (!error && data?.length === 0) {
    await supabase.from("partner_resident_settings").insert({ resident_id: user.id, castings_seen_at: now });
  }
}
