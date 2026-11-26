"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { createConciergeRequest } from "@/app/actions/concierge";
import type { Lang } from "@/app/context/LanguageContext";
import {
  IDENTITY_REQUEST_PREFIX,
  IDENTITY_REQUEST_TITLE,
  formatBirthDate,
  normalizeAbout,
  normalizeBirthDate,
  normalizeCitizenship,
  normalizeLocation,
  sanitizeRequestComment,
} from "@/lib/resident-profile-fields";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Резидентка сохраняет город, «о себе», гражданство и дату рождения
 *
 * Раньше анкета писала эти поля прямым upsert из браузера, а у роли
 * authenticated на profiles есть UPDATE только на full_name/name/avatar_url
 * (INSERT нет) — запись отклонялась (42501).
 *
 *  - Город и «о себе»: service-role UPDATE своего профиля (id из сессии),
 *    как resident-physical.ts / resident-sizes.ts.
 *  - Гражданство и дата рождения: RPC public.voyage_resident_set_identity
 *    от имени самой резидентки (её JWT). БД сама находит её профиль, сама
 *    проверяет блокировку (KYC отправлен на проверку или подтверждён) и в той
 *    же транзакции пишет журнал 'profile.identity_change' (триггер).
 *  - Под блокировкой — только запрос команде клуба:
 *    requestResidentIdentityChange → заявка консьержу. Профиль не меняется
 *    до решения owner/admin (app/actions/admin-resident-identity.ts).
 * ──────────────────────────────────────────────────────────────────── */

type FieldsError = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "identity_locked" | "server_error";

export type ProfileFieldsResult =
  | {
      ok: true;
      location: string | null;
      about: string | null;
      citizenship: string | null;
      birth_date: string | null;
      identity_locked: boolean;
    }
  | { ok: false; reason: FieldsError };

type Patch = { location?: string | null; about?: string | null; citizenship?: string | null; birth_date?: string | null };

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const until = Date.parse(profile.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

type OwnProfile = {
  id: string;
  role: string | null;
  kyc_level: number | null;
  location: string | null;
  about: string | null;
  citizenship: string | null;
  birth_date: string | null;
  banned_until: string | null;
  ban_permanent: boolean | null;
};

const OWN_COLUMNS = "id,role,kyc_level,location,about,citizenship,birth_date,banned_until,ban_permanent";

type Session = Awaited<ReturnType<typeof createClient>>;
type Db = ReturnType<typeof getTelegramServiceClient>;

/** Сессия → собственный профиль (service role) + блокировка из БД. Профиль никогда не берётся от клиента. */
async function loadOwnProfile(): Promise<
  | { ok: true; profile: OwnProfile; locked: boolean; db: Db; session: Session }
  | { ok: false; reason: FieldsError }
> {
  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { ok: false, reason: "unauthenticated" };

  const db = getTelegramServiceClient();
  let found = await db.from("profiles").select(OWN_COLUMNS).eq("id", auth.user.id).maybeSingle();
  if (found.error) return { ok: false, reason: "server_error" };
  // Старые профили: profiles.id ≠ auth.users.id, связь через user_id.
  if (!found.data) {
    found = await db.from("profiles").select(OWN_COLUMNS).eq("user_id", auth.user.id).maybeSingle();
    if (found.error) return { ok: false, reason: "server_error" };
  }
  if (!found.data) return { ok: false, reason: "not_found" };
  const profile = found.data as OwnProfile;
  if (isBanActive(profile)) return { ok: false, reason: "forbidden" };

  const lock = await db.rpc("voyage_identity_locked", { p_profile: profile.id });
  if (lock.error) return { ok: false, reason: "server_error" }; // fail closed
  return { ok: true, profile, locked: lock.data === true, db, session };
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** Для анкеты: заблокированы ли гражданство и дата рождения (KYC отправлен или подтверждён). */
export async function getResidentIdentityLock(): Promise<{ ok: true; locked: boolean } | { ok: false; reason: FieldsError }> {
  try {
    const own = await loadOwnProfile();
    if (!own.ok) return own;
    return { ok: true, locked: own.locked };
  } catch {
    return { ok: false, reason: "server_error" };
  }
}

export async function updateResidentProfileFields(input: Patch): Promise<ProfileFieldsResult> {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  const has = (key: keyof Patch) => Object.prototype.hasOwnProperty.call(input, key);

  const plain: { location?: string | null; about?: string | null } = {};
  const identity: { citizenship?: string | null; birth_date?: string | null } = {};
  if (has("location")) {
    const r = normalizeLocation(input.location);
    if (!r.ok) return { ok: false, reason: "invalid" };
    plain.location = r.value;
  }
  if (has("about")) {
    const r = normalizeAbout(input.about);
    if (!r.ok) return { ok: false, reason: "invalid" };
    plain.about = r.value;
  }
  if (has("citizenship")) {
    const r = normalizeCitizenship(input.citizenship);
    if (!r.ok) return { ok: false, reason: "invalid" };
    identity.citizenship = r.value;
  }
  if (has("birth_date")) {
    const r = normalizeBirthDate(input.birth_date);
    if (!r.ok) return { ok: false, reason: "invalid" };
    identity.birth_date = r.value;
  }
  const hasPlain = Object.keys(plain).length > 0;
  const hasIdentity = Object.keys(identity).length > 0;
  // Один вызов — один вид данных: так обе ветки атомарны (анкета шлёт по одному полю).
  if (hasPlain === hasIdentity) return { ok: false, reason: "invalid" };

  try {
    const own = await loadOwnProfile();
    if (!own.ok) return own;
    const { profile, locked, db, session } = own;
    let row: Record<string, unknown> = { ...profile, birth_date: formatBirthDate(profile.birth_date) };

    if (hasIdentity) {
      // То же значение повторно — не изменение, ничего не вызываем.
      const changes =
        (identity.citizenship !== undefined && identity.citizenship !== (profile.citizenship ?? null)) ||
        (identity.birth_date !== undefined && identity.birth_date !== formatBirthDate(profile.birth_date));
      if (changes) {
        if (locked) return { ok: false, reason: "identity_locked" };
        const { data, error } = await session.rpc("voyage_resident_set_identity", { p_patch: identity });
        if (error) {
          const msg = String(error.message ?? "");
          if (msg.includes("identity_locked")) return { ok: false, reason: "identity_locked" };
          if (msg.includes("invalid_value") || error.code === "22023") return { ok: false, reason: "invalid" };
          if (error.code === "42501") return { ok: false, reason: "forbidden" };
          if (error.code === "28000") return { ok: false, reason: "unauthenticated" };
          console.error("[resident-profile-fields] identity rpc failed", error.code ?? "unknown");
          return { ok: false, reason: "server_error" };
        }
        const d = (data ?? {}) as { citizenship?: unknown; birth_date?: unknown };
        row = { ...row, citizenship: d.citizenship ?? null, birth_date: formatBirthDate(d.birth_date) };
      }
    } else {
      const { data, error } = await db.from("profiles")
        .update({ ...plain, updated_at: new Date().toISOString() })
        .eq("id", profile.id)
        .select("location,about,citizenship,birth_date")
        .maybeSingle();
      if (error) {
        console.error("[resident-profile-fields] update failed", error.code ?? "unknown");
        return { ok: false, reason: error.code === "23514" ? "invalid" : "server_error" };
      }
      if (!data) return { ok: false, reason: "not_found" };
      row = { ...(data as Record<string, unknown>), birth_date: formatBirthDate((data as Record<string, unknown>).birth_date) };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/admin/database/${profile.id}`);
    return {
      ok: true,
      location: text(row.location),
      about: text(row.about),
      citizenship: text(row.citizenship),
      birth_date: (row.birth_date as string | null) ?? null,
      identity_locked: locked,
    };
  } catch (err) {
    console.error("[resident-profile-fields] unexpected", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}

type RequestError = FieldsError | "not_locked" | "nothing_to_change" | "already_requested" | "not_approved" | "request_failed";

export type IdentityRequestResult = { ok: true; requestId: string } | { ok: false; reason: RequestError };

const FIELD_LABEL = { citizenship: "гражданство", birth_date: "дата рождения" } as const;

/**
 * Резидентка, чьи данные «под KYC», просит изменить гражданство и/или дату
 * рождения.
 *  - Профиль берётся только из сессии: в input нет id, лишние ключи
 *    (user_id, resident_id, profileId…) игнорируются; заявку создаёт
 *    существующий createConciergeRequest тоже по сессии.
 *  - Персональные данные не уходят в Telegram: в тексте заявки (он
 *    пересылается в рабочий чат) — только названия полей. Значения
 *    «было → стало» и комментарий — отдельным сообщением в переписке заявки
 *    (partner_concierge_messages), которое видят только она и команда клуба.
 *  - Профиль не меняется до решения owner/admin.
 */
export async function requestResidentIdentityChange(input: {
  citizenship?: string | null;
  birth_date?: string | null;
  comment?: string | null;
  language?: Lang;
}): Promise<IdentityRequestResult> {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);
  const lang: Lang = input.language && ["EN", "RU", "ES", "PT"].includes(input.language) ? input.language : "RU";

  let citizenship: string | null | undefined;
  let birthDate: string | null | undefined;
  if (has("citizenship")) {
    const r = normalizeCitizenship(input.citizenship);
    if (!r.ok) return { ok: false, reason: "invalid" };
    citizenship = r.value;
  }
  if (has("birth_date")) {
    const r = normalizeBirthDate(input.birth_date);
    if (!r.ok) return { ok: false, reason: "invalid" };
    birthDate = r.value;
  }
  const comment = sanitizeRequestComment(input.comment);

  try {
    const own = await loadOwnProfile();
    if (!own.ok) return own;
    const { profile, locked, db } = own;
    if (profile.role !== "resident") return { ok: false, reason: "forbidden" };
    if (!locked) return { ok: false, reason: "not_locked" }; // до отправки KYC резидентка правит сама

    const currentBirth = formatBirthDate(profile.birth_date);
    const fields: (keyof typeof FIELD_LABEL)[] = [];
    const details: string[] = [];
    if (citizenship !== undefined && citizenship !== (profile.citizenship ?? null)) {
      fields.push("citizenship");
      details.push(`Гражданство: ${profile.citizenship ?? "—"} → ${citizenship ?? "—"}`);
    }
    if (birthDate !== undefined && birthDate !== currentBirth) {
      fields.push("birth_date");
      details.push(`Дата рождения: ${currentBirth ?? "—"} → ${birthDate ?? "—"}`);
    }
    if (fields.length === 0) return { ok: false, reason: "nothing_to_change" };

    const open = await db.from("partner_concierge_requests")
      .select("id")
      .eq("resident_id", profile.id)
      .in("status", ["open", "in_progress"])
      .like("title", `${IDENTITY_REQUEST_PREFIX}%`)
      .limit(1)
      .maybeSingle();
    if (open.error) return { ok: false, reason: "server_error" };
    if (open.data) return { ok: false, reason: "already_requested" };

    // Этот текст уходит и в рабочий чат Telegram — без значений.
    const message = [
      `Резидентка просит изменить данные, сверяемые с документами KYC: ${fields.map((f) => FIELD_LABEL[f]).join(", ")}.`,
      "Новые значения и комментарий — в переписке этой заявки (раздел «Консьерж»).",
      `Правка — в карточке резидентки, блок «Идентификационные данные» (/admin/database/${profile.id}).`,
    ].join("\n");

    const created = await createConciergeRequest({
      title: IDENTITY_REQUEST_TITLE,
      category: "documents",
      message,
      tripStage: "before_tour",
      desiredAt: null,
      language: lang,
    });
    if (!created.ok) {
      const reason = (created as { reason?: string }).reason;
      if (reason === "not_approved" || reason === "resident_only") return { ok: false, reason: "not_approved" };
      if (reason === "banned") return { ok: false, reason: "forbidden" };
      return { ok: false, reason: "request_failed" };
    }
    const requestId = String((created as { request?: { id?: unknown } }).request?.id ?? "");

    // Значения — только в переписке заявки (не в Telegram).
    const body = [...details, "", `Комментарий: ${comment || "—"}`].join("\n");
    const msg = await db.from("partner_concierge_messages")
      .insert({ request_id: requestId, sender_profile_id: profile.id, sender_role: "resident", body })
      .select("id")
      .single();
    if (msg.error || !msg.data) {
      // Без значений заявка бесполезна: удаляем её, резидентка может отправить снова.
      console.error("[resident-profile-fields] identity request details failed", msg.error?.code ?? "no_row");
      await db.from("partner_concierge_requests").delete().eq("id", requestId).eq("resident_id", profile.id);
      return { ok: false, reason: "request_failed" };
    }
    return { ok: true, requestId };
  } catch (err) {
    console.error("[resident-profile-fields] identity request unexpected", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}
