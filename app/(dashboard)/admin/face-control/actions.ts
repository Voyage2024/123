"use server";

import { createClient } from "@/lib/supabase/server";

/* ──────────────────────────────────────────────────────────────────────
 * Серверные экшены Face Control.
 *
 * Держим мутации на сервере: клиент лишь вызывает approve/decline и
 * оптимистично убирает карточку, а фактическая запись в БД (и проверка
 * прав через RLS/сессию) происходит здесь. Возвращаем { error } —
 * клиент по нему решает, откатывать ли оптимистичное удаление.
 * ──────────────────────────────────────────────────────────────────── */

type ActionResult = { error: string | null };

export async function approveApplication(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  // count: "exact" — чтобы отличить «обновили строку» от «строка не найдена
  // или RLS не пропустил» (в обоих случаях Supabase вернёт error: null).
  const { error, count } = await supabase
    .from("profiles")
    .update({ kyc_level: 0, status: "approved" }, { count: "exact" })
    .eq("id", id);

  if (error) return { error: error.message };
  if (count === 0) {
    return { error: "Заявка не найдена, уже обработана или нет прав на изменение." };
  }
  return { error: null };
}

export async function declineApplication(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Capture linked web lead metadata before the profile is removed from the queue.
  const { data: profile, error: lookupError } = await supabase
    .from("profiles")
    .select("id,telegram_id,source_metadata")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (!profile) return { error: "Заявка не найдена, уже обработана или нет прав на изменение." };

  // Вариант по умолчанию — удаляем запись из очереди.
  const { error, count } = await supabase
    .from("profiles")
    .delete({ count: "exact" })
    .eq("id", id);

  // Если предпочитаете «мягкий» отказ вместо удаления — закомментируйте
  // блок выше и раскомментируйте блок ниже (запись останется в БД,
  // но с kyc_level = -1 и статусом declined, и выпадет из выборки очереди):
  //
  // const { error, count } = await supabase
  //   .from("profiles")
  //   .update({ kyc_level: -1, status: "declined" }, { count: "exact" })
  //   .eq("id", id);

  if (error) return { error: error.message };
  if (count === 0) {
    return { error: "Заявка не найдена, уже обработана или нет прав на изменение." };
  }
  const sourceMetadata = profile.source_metadata && typeof profile.source_metadata === "object"
    ? profile.source_metadata as Record<string, unknown>
    : {};
  const linkedApplicationIds = Array.from(new Set([
    ...(typeof sourceMetadata.guest_application_id === "string" ? [sourceMetadata.guest_application_id] : []),
    ...(Array.isArray(sourceMetadata.guest_application_ids)
      ? sourceMetadata.guest_application_ids.filter((value): value is string => typeof value === "string")
      : []),
  ])).filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
  for (const guestApplicationId of linkedApplicationIds) {
    const { error: leadError } = await supabase.from("guest_applications")
      .update({ status: "rejected" })
      .eq("id", guestApplicationId)
      .eq("telegram_id", String(profile.telegram_id ?? ""));
    if (leadError) console.error("[Face Control] linked website application rejection sync failed", leadError.code ?? "unknown");
  }
  return { error: null };
}
