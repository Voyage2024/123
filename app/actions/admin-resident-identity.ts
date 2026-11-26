"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatBirthDate, normalizeBirthDate, normalizeCitizenship } from "@/lib/resident-profile-fields";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Команда клуба меняет гражданство / дату рождения
 *
 * Единственный путь для owner/admin — и из карточки резидентки, и из
 * справочника /admin (club_admin_update_profile гражданство больше не
 * принимает). Вся работа — в одной функции БД
 * public.voyage_staff_set_resident_identity (миграция 20261128090000),
 * вызываемой от имени сотрудника (его JWT):
 *  - роль owner/admin и бан проверяет БД по auth.uid();
 *  - причина обязательна (5–500 символов);
 *  - UPDATE профиля и запись 'profile.identity_change' в audit_logs
 *    (триггер profiles_identity_audit) — в одной транзакции: не прошло
 *    одно — не остаётся и другого.
 * KYC не трогается.
 * ──────────────────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IdentityError = "invalid" | "reason_required" | "nothing_to_change" | "unauthenticated" | "forbidden" | "not_found" | "server_error";

export type StaffIdentityResult =
  | { ok: true; citizenship: string | null; birth_date: string | null; auditId: number | null }
  | { ok: false; reason: IdentityError };

async function requestMeta() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const ua = h.get("user-agent");
    return { ip: forwarded ? forwarded.slice(0, 128) : null, userAgent: ua ? ua.slice(0, 512) : null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function staffUpdateResidentIdentity(input: {
  profileId: string;
  citizenship?: string | null;
  birth_date?: string | null;
  reason: string;
}): Promise<StaffIdentityResult> {
  if (!input || typeof input !== "object" || typeof input.profileId !== "string" || !UUID_RE.test(input.profileId)) {
    return { ok: false, reason: "invalid" };
  }
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  const reason = typeof input.reason === "string" ? input.reason.replace(/\s+/g, " ").trim() : "";
  if (reason.length < 5 || reason.length > 500) return { ok: false, reason: "reason_required" };

  const patch: { citizenship?: string | null; birth_date?: string | null } = {};
  if (has("citizenship")) {
    const r = normalizeCitizenship(input.citizenship);
    if (!r.ok) return { ok: false, reason: "invalid" };
    patch.citizenship = r.value;
  }
  if (has("birth_date")) {
    const r = normalizeBirthDate(input.birth_date);
    if (!r.ok) return { ok: false, reason: "invalid" };
    patch.birth_date = r.value;
  }
  if (Object.keys(patch).length === 0) return { ok: false, reason: "nothing_to_change" };

  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { ok: false, reason: "unauthenticated" };

  try {
    const meta = await requestMeta();
    const { data, error } = await session.rpc("voyage_staff_set_resident_identity", {
      p_profile: input.profileId,
      p_patch: patch,
      p_reason: reason,
      p_ip: meta.ip,
      p_user_agent: meta.userAgent,
    });
    if (error) {
      const msg = String(error.message ?? "");
      if (msg.includes("nothing_to_change")) return { ok: false, reason: "nothing_to_change" };
      if (msg.includes("reason_required")) return { ok: false, reason: "reason_required" };
      if (msg.includes("invalid_value") || msg.includes("field_not_allowed") || error.code === "22023") return { ok: false, reason: "invalid" };
      if (error.code === "42501") return { ok: false, reason: "forbidden" };
      if (error.code === "28000") return { ok: false, reason: "unauthenticated" };
      if (error.code === "P0002") return { ok: false, reason: "not_found" };
      console.error("[admin-resident-identity] rpc failed", error.code ?? "unknown");
      return { ok: false, reason: "server_error" };
    }
    const d = (data ?? {}) as { citizenship?: string | null; birth_date?: string | null; audit_id?: number | null };
    revalidatePath(`/admin/database/${input.profileId}`);
    revalidatePath("/admin/database");
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      ok: true,
      citizenship: d.citizenship ?? null,
      birth_date: formatBirthDate(d.birth_date),
      auditId: typeof d.audit_id === "number" ? d.audit_id : d.audit_id ? Number(d.audit_id) : null,
    };
  } catch (err) {
    console.error("[admin-resident-identity] unexpected", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}
