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
    .update({ kyc_level: 1, status: "approved" }, { count: "exact" })
    .eq("id", id);

  if (error) return { error: error.message };
  if (count === 0) {
    return { error: "Заявка не найдена, уже обработана или нет прав на изменение." };
  }
  return { error: null };
}

export async function declineApplication(id: string): Promise<ActionResult> {
  const supabase = await createClient();

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
  return { error: null };
}
