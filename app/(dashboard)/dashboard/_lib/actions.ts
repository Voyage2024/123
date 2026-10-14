/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — действия ленты кастингов (заглушки)
 * app/(dashboard)/dashboard/_lib/actions.ts
 *
 * Одно место, где кнопки ленты встречаются с базой. Сейчас — имитация
 * с задержкой, чтобы были видны состояния «Отправляем…» и «Готово».
 *
 * Подключение — два равноценных пути:
 *
 *  A) Server action. Добавьте в начало файла директиву "use server"
 *     и замените тела функций на код из блоков ниже, взяв клиент так:
 *       import { createClient } from "@/lib/supabase/server";
 *       const supabase = await createClient();
 *
 *  B) Прямо из браузера тем же кодом через
 *       import { supabase } from "@/lib/supabase";
 *
 * В обоих случаях права проверяет база (RLS), а не этот файл:
 *   insert отклика — только своего, только со статусом 'ready' и только
 *   если partner_me_can_respond(casting_id): полная верификация, нет
 *   в Blacklist, кастинг открыт и не истёк;
 *   update — только своего отклика и только в 'ready' / 'declined' / 'withdrawn'.
 * ──────────────────────────────────────────────────────────────────── */

export type ActionResult = { ok: true } | { ok: false; reason: "closed" | "forbidden" | "network" };

const DEMO_DELAY_MS = 900;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * «Готова в тур». Один отклик на кастинг (unique casting_id + resident_id).
 * Upsert не подойдёт: права выданы по колонкам, а upsert переписывает
 * casting_id. Поэтому insert, а если отклик уже был и отозван — update.
 */
export async function applyToCasting(castingId: string): Promise<ActionResult> {
  // const { error } = await supabase
  //   .from("partner_casting_responses")
  //   .insert({ casting_id: castingId, status: "ready" });
  // if (error?.code === "23505") {
  //   // уже откликалась и отозвала — возвращаем отклик
  //   const { error: again } = await supabase
  //     .from("partner_casting_responses")
  //     .update({ status: "ready" })
  //     .eq("casting_id", castingId)
  //     .eq("status", "withdrawn");
  //   return again ? { ok: false, reason: "network" } : { ok: true };
  // }
  // if (error) return { ok: false, reason: error.code === "42501" ? "closed" : "network" };
  // return { ok: true };
  void castingId;
  await wait(DEMO_DELAY_MS);
  return { ok: true };
}

/** «Отозвать отклик» — пока менеджер не поставил опцион, без последствий */
export async function withdrawResponse(castingId: string): Promise<ActionResult> {
  // const { error } = await supabase
  //   .from("partner_casting_responses")
  //   .update({ status: "withdrawn" })
  //   .eq("casting_id", castingId)
  //   .eq("status", "ready");
  // return error ? { ok: false, reason: "network" } : { ok: true };
  void castingId;
  await wait(DEMO_DELAY_MS);
  return { ok: true };
}

/** Тумблер «Открыта к турам»: выключен — менеджеры её не видят, кастинги не приходят */
export async function setOpenToTours(open: boolean): Promise<ActionResult> {
  // Строку настроек создаёт триггер верификации; если её ещё нет — insert
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return { ok: false, reason: "forbidden" };
  // const { data, error } = await supabase
  //   .from("partner_resident_settings")
  //   .update({ open_to_tours: open })
  //   .eq("resident_id", user.id)
  //   .select("resident_id");
  // if (!error && data?.length === 0) {
  //   const { error: ins } = await supabase
  //     .from("partner_resident_settings")
  //     .insert({ resident_id: user.id, open_to_tours: open });
  //   return ins ? { ok: false, reason: "network" } : { ok: true };
  // }
  // return error ? { ok: false, reason: "network" } : { ok: true };
  void open;
  await wait(DEMO_DELAY_MS / 2);
  return { ok: true };
}
