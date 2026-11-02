"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { formatShoeSize, normalizeClothingSize, normalizeShoeSize, type ClothingSize } from "@/lib/resident-sizes";

type SizesError = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "required" | "server_error";

export type SizesResult =
  | { ok: true; clothing_size: ClothingSize | null; shoe_size: string | null }
  | { ok: false; reason: SizesError };

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const until = Date.parse(profile.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

/**
 * Резидентка сохраняет свой размер одежды и/или обуви.
 *
 * - Пишет только в собственный профиль (id из сессии, не из клиента).
 * - Значения проверяются по той же сетке, что и CHECK в БД.
 * - Размеры обязательные: уже указанный размер можно сменить, но не стереть.
 * - Запись идёт service-role клиентом, поэтому не зависит от column-grants
 *   на profiles (у authenticated там UPDATE только на full_name/name/avatar_url).
 */
export async function updateResidentSizes(input: {
  clothing_size?: string | null;
  shoe_size?: string | number | null;
}): Promise<SizesResult> {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  const hasClothing = Object.prototype.hasOwnProperty.call(input, "clothing_size");
  const hasShoe = Object.prototype.hasOwnProperty.call(input, "shoe_size");
  if (!hasClothing && !hasShoe) return { ok: false, reason: "invalid" };

  const patch: { clothing_size?: ClothingSize; shoe_size?: number } = {};
  if (hasClothing) {
    if (input.clothing_size === null || input.clothing_size === "") return { ok: false, reason: "required" };
    const value = normalizeClothingSize(input.clothing_size);
    if (!value) return { ok: false, reason: "invalid" };
    patch.clothing_size = value;
  }
  if (hasShoe) {
    if (input.shoe_size === null || input.shoe_size === "") return { ok: false, reason: "required" };
    const value = normalizeShoeSize(input.shoe_size);
    if (value === null) return { ok: false, reason: "invalid" };
    patch.shoe_size = value;
  }

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
      .select("clothing_size,shoe_size")
      .maybeSingle();
    if (error) {
      console.error("[resident-sizes] update failed", error.code ?? "unknown");
      return { ok: false, reason: error.code === "23514" ? "invalid" : "server_error" };
    }
    if (!data) return { ok: false, reason: "not_found" };

    revalidatePath("/dashboard");
    revalidatePath(`/admin/database/${found.data.id}`);
    return {
      ok: true,
      clothing_size: normalizeClothingSize(data.clothing_size),
      shoe_size: formatShoeSize(data.shoe_size),
    };
  } catch (err) {
    console.error("[resident-sizes] unexpected", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}
