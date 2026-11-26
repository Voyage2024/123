"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import {
  formatPhysicalNumber,
  normalizeHeight,
  normalizeMeasurements,
  normalizeWeight,
} from "@/lib/resident-physical";

type PhysicalError = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "server_error";

export type PhysicalResult =
  | { ok: true; height: string | null; weight: string | null; measurements: string | null }
  | { ok: false; reason: PhysicalError };

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const until = Date.parse(profile.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

/**
 * Резидентка сохраняет свой рост, вес и/или объёмы.
 *
 * Раньше анкета писала эти поля прямым upsert из браузера. У роли
 * authenticated на profiles нет INSERT и есть UPDATE только на
 * full_name/name/avatar_url, поэтому запрос падал с 42501 (permission
 * denied), а интерфейс показывал новое значение до перезагрузки.
 *
 * Здесь — тот же принцип, что у размеров (resident-sizes.ts):
 * - пишем только в собственный профиль (id из сессии, не из клиента);
 * - меняем только переданные поля из белого списка;
 * - значения проверяются на сервере (lib/resident-physical.ts);
 * - запись service-role клиентом; триггеры profiles отрабатывают как обычно;
 * - в ответе — значения, которые реально легли в БД.
 */
export async function updateResidentPhysical(input: {
  height?: string | number | null;
  weight?: string | number | null;
  measurements?: string | null;
}): Promise<PhysicalResult> {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);

  const patch: { height?: number | null; weight?: number | null; measurements?: string | null } = {};
  if (has("height")) {
    const r = normalizeHeight(input.height);
    if (!r.ok) return { ok: false, reason: "invalid" };
    patch.height = r.value;
  }
  if (has("weight")) {
    const r = normalizeWeight(input.weight);
    if (!r.ok) return { ok: false, reason: "invalid" };
    patch.weight = r.value;
  }
  if (has("measurements")) {
    const r = normalizeMeasurements(input.measurements);
    if (!r.ok) return { ok: false, reason: "invalid" };
    patch.measurements = r.value;
  }
  if (Object.keys(patch).length === 0) return { ok: false, reason: "invalid" };

  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { ok: false, reason: "unauthenticated" };

  try {
    const db = getTelegramServiceClient();
    let found = await db.from("profiles")
      .select("id,banned_until,ban_permanent")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (found.error) return { ok: false, reason: "server_error" };
    // Старые профили: profiles.id ≠ auth.users.id, связь через user_id.
    if (!found.data) {
      found = await db.from("profiles")
        .select("id,banned_until,ban_permanent")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (found.error) return { ok: false, reason: "server_error" };
    }
    if (!found.data) return { ok: false, reason: "not_found" };
    if (isBanActive(found.data)) return { ok: false, reason: "forbidden" };

    const { data, error } = await db.from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", found.data.id)
      .select("height,weight,measurements")
      .maybeSingle();
    if (error) {
      console.error("[resident-physical] update failed", error.code ?? "unknown");
      return { ok: false, reason: error.code === "23514" || error.code === "22003" ? "invalid" : "server_error" };
    }
    if (!data) return { ok: false, reason: "not_found" };

    revalidatePath("/dashboard");
    revalidatePath(`/admin/database/${found.data.id}`);
    return {
      ok: true,
      height: formatPhysicalNumber(data.height),
      weight: formatPhysicalNumber(data.weight),
      measurements: typeof data.measurements === "string" && data.measurements.trim() ? data.measurements : null,
    };
  } catch (err) {
    console.error("[resident-physical] unexpected", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}
