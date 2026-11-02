"use server";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { CIRCLES, normalizeCircleKey } from "@/lib/gamification";
import { KYC3_REQUEST_PREFIX } from "@/lib/admin-review";
import { formatShoeSize, normalizeClothingSize } from "@/lib/resident-sizes";
import type {
  DossierContact,
  DossierKycFile,
  DossierKycRequest,
  DossierPdfData,
  PdfActionResult,
  PdfBadge,
  PresentationPdfData,
} from "@/lib/resident-pdf/types";

/* ──────────────────────────────────────────────────────────────────────
 * PDF карточки резидентки — серверная часть.
 *
 * Роли проверяются ЗДЕСЬ, а не в интерфейсе:
 *  - getResidentPresentationPdf → owner | admin (менеджеры сюда не попадают);
 *  - getResidentDossierPdf      → только owner.
 *
 * Досье: сначала запись в public.audit_logs (кто/кого/когда, IP, UA),
 * и только если она удалась — сбор приватных данных. Не записался лог —
 * данные не уходят (fail closed). Сам PDF собирается в браузере из
 * ответа этого действия (lib/resident-pdf/build.ts).
 * ──────────────────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNED_TTL_SECONDS = 300;
const MAX_PRESENTATION_PHOTOS = 7;
const MAX_DOSSIER_PHOTOS = 12;
const MAX_KYC_FILES = 20;

type Role = "owner" | "admin" | "manager" | "resident";
type Actor = { profileId: string; userId: string; email: string | null; role: Role };

type ProfileRow = {
  id: string;
  user_id: string | null;
  role: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  telegram_id: string | null;
  telegram_username: string | null;
  telegram_language: string | null;
  avatar_url: string | null;
  photo_urls: string[] | null;
  location: string | null;
  citizenship: string | null;
  birth_date: string | null;
  height: number | string | null;
  weight: number | string | null;
  measurements: string | null;
  clothing_size: string | null;
  shoe_size: number | string | null;
  smoking: boolean | null;
  alcohol: boolean | null;
  about: string | null;
  status: string | null;
  kyc_level: number | null;
  segment: string | null;
  circle: string | null;
  level: number | null;
  reliability: number | string | null;
  influence_index: number | null;
  tour_points: number | null;
  member_no: number | null;
  usdt_wallet: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  ban_permanent: boolean | null;
  created_at: string | null;
  last_seen_at: string | null;
  registration_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

const PROFILE_COLUMNS = [
  "id", "user_id", "role", "full_name", "name", "email", "telegram_id", "telegram_username", "telegram_language",
  "avatar_url", "photo_urls", "location", "citizenship", "birth_date", "height", "weight", "measurements",
  "clothing_size", "shoe_size", "smoking", "alcohol", "about", "status", "kyc_level", "segment", "circle", "level",
  "reliability", "influence_index", "tour_points", "member_no", "usdt_wallet", "banned_until", "ban_reason",
  "ban_permanent", "created_at", "last_seen_at", "registration_source", "utm_source", "utm_medium", "utm_campaign",
].join(",");

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const until = Date.parse(profile.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

/** Кто нажал кнопку: сессия → профиль (service role, роль из БД, не из клиента). */
async function loadActor(db: SupabaseClient): Promise<{ ok: true; actor: Actor } | { ok: false; reason: "unauthenticated" | "forbidden" | "server_error" }> {
  const session = await createClient();
  const { data: auth, error } = await session.auth.getUser();
  if (error || !auth.user) return { ok: false, reason: "unauthenticated" };

  let found = await db.from("profiles").select("id,role,banned_until,ban_permanent").eq("user_id", auth.user.id).maybeSingle();
  if (found.error) return { ok: false, reason: "server_error" };
  if (!found.data) {
    found = await db.from("profiles").select("id,role,banned_until,ban_permanent").eq("id", auth.user.id).maybeSingle();
    if (found.error) return { ok: false, reason: "server_error" };
  }
  if (!found.data || isBanActive(found.data)) return { ok: false, reason: "forbidden" };
  return {
    ok: true,
    actor: { profileId: found.data.id, userId: auth.user.id, email: auth.user.email ?? null, role: String(found.data.role) as Role },
  };
}

async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  return { ip: forwarded ? forwarded.slice(0, 128) : null, userAgent: ua ? ua.slice(0, 512) : null };
}

async function writeAudit(
  db: SupabaseClient,
  actor: Actor,
  action: string,
  target: { id: string; label: string },
  metadata: Record<string, unknown>,
): Promise<string | null> {
  const meta = await requestMeta();
  const { data, error } = await db.from("audit_logs").insert({
    action,
    actor_profile_id: actor.profileId,
    actor_user_id: actor.userId,
    actor_email: actor.email,
    actor_role: actor.role,
    target_profile_id: target.id,
    target_label: target.label.slice(0, 200),
    ip: meta.ip,
    user_agent: meta.userAgent,
    metadata,
  }).select("id").single();
  if (error || !data) {
    console.error("[resident-dossier] audit insert failed", error?.code ?? "no_row");
    return null;
  }
  return String(data.id);
}

async function loadTarget(db: SupabaseClient, profileId: string) {
  let { data, error } = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", profileId).maybeSingle();
  // 42703 = колонки размеров ещё не созданы (миграция не применена) — PDF всё равно отдаём.
  if (error?.code === "42703") {
    const legacy = PROFILE_COLUMNS.split(",").filter((c) => c !== "clothing_size" && c !== "shoe_size").join(",");
    ({ data, error } = await db.from("profiles").select(legacy).eq("id", profileId).maybeSingle());
  }
  if (error) {
    console.error("[resident-dossier] load profile", error.code ?? "unknown");
    return { ok: false as const, reason: "server_error" as const };
  }
  if (!data) return { ok: false as const, reason: "not_found" as const };
  const profile = data as unknown as ProfileRow;
  if (profile.role !== "resident") return { ok: false as const, reason: "not_resident" as const };
  return { ok: true as const, profile };
}

/* ── Форматирование ──────────────────────────────────────────────── */

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function memberNo(profile: ProfileRow): string {
  if (profile.member_no !== null && profile.member_no !== undefined) return String(profile.member_no).padStart(4, "0");
  return profile.id.replace(/-/g, "").slice(0, 4).toUpperCase();
}

function fullNameOf(profile: ProfileRow): string {
  return clean(profile.full_name) ?? clean(profile.name) ?? "Без имени";
}

/** «Анна Викторовна Кузнецова» → «Анна К.» — фамилия в буклете не нужна */
function publicName(profile: ProfileRow): string {
  const parts = fullNameOf(profile).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Resident";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

function fmtDate(value: string | null | undefined, withTime = true): string | null {
  if (!value) return null;
  if (value === "infinity") return "Навсегда";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ru-RU", withTime ? { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" } : { dateStyle: "medium", timeZone: "UTC" }) + (withTime ? " UTC" : "");
}

function withUnit(value: unknown, unit: string): string | null {
  const s = clean(value);
  return s ? `${s} ${unit}` : null;
}

/** Вырезает из «О себе» всё, по чему можно связаться в обход клуба */
function stripContacts(text: string | null): string | null {
  if (!text) return null;
  const out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "•••")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "•••")
    .replace(/\b(?:t\.me|wa\.me|instagram\.com|vk\.com|tiktok\.com)\/\S*/gi, "•••")
    .replace(/(^|\s)@[\w.]{2,}/g, "$1•••")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "•••")
    .trim();
  return out ? out.slice(0, 1200) : null;
}

function badgeOf(profile: ProfileRow): PdfBadge {
  const levelRaw = Number(profile.level ?? 1);
  const level = Number.isFinite(levelRaw) ? Math.min(6, Math.max(1, Math.floor(levelRaw))) : 1;
  const key = normalizeCircleKey(profile.circle);
  const circle = CIRCLES.find((c) => c.key === key) ?? CIRCLES.find((c) => c.level === level) ?? CIRCLES[0];
  const kycRaw = Number(profile.kyc_level ?? 0);
  const kyc = Number.isFinite(kycRaw) ? Math.min(3, Math.max(0, Math.floor(kycRaw))) : 0;
  return {
    circleTitle: circle.title,
    circleLevel: circle.level,
    kycLevel: kyc,
    vip: kyc >= 3,
    segment: profile.segment === "elite" ? "elite" : "working",
  };
}

/** Аватар + портфолио → подписанные ссылки (бакет user-uploads приватный) */
async function resolvePhotos(db: SupabaseClient, profile: ProfileRow, max: number): Promise<string[]> {
  const entries = Array.from(new Set([profile.avatar_url, ...(profile.photo_urls ?? [])].map(clean).filter((v): v is string => Boolean(v)))).slice(0, max);
  const paths = entries.filter((e) => !/^https?:\/\//i.test(e)).map((e) => e.replace(/^\/+/, "").replace(/^user-uploads\//, ""));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await db.storage.from("user-uploads").createSignedUrls(paths, SIGNED_TTL_SECONDS);
    if (error) console.error("[resident-dossier] sign photos", error.name);
    for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  }
  return entries
    .map((e) => (/^https?:\/\//i.test(e) ? e : signed.get(e.replace(/^\/+/, "").replace(/^user-uploads\//, "")) ?? null))
    .filter((u): u is string => Boolean(u));
}

/* ── Презентационный PDF: owner + admin ──────────────────────────── */

export async function getResidentPresentationPdf(profileId: string): Promise<PdfActionResult<PresentationPdfData>> {
  if (typeof profileId !== "string" || !UUID_RE.test(profileId)) return { ok: false, reason: "invalid" };
  try {
    const db = getTelegramServiceClient();
    const actorResult = await loadActor(db);
    if (!actorResult.ok) return actorResult;
    const { actor } = actorResult;
    if (actor.role !== "owner" && actor.role !== "admin") return { ok: false, reason: "forbidden" };

    const target = await loadTarget(db, profileId);
    if (!target.ok) return target;
    const p = target.profile;

    // Буклет без приватных данных — лог для статистики, на выдачу не влияет.
    await writeAudit(db, actor, "resident.presentation_pdf", { id: p.id, label: publicName(p) }, { scope: "presentation" });

    return {
      ok: true,
      data: {
        kind: "presentation",
        generatedAt: new Date().toISOString(),
        profileId: p.id,
        memberNo: memberNo(p),
        displayName: publicName(p),
        age: ageFrom(p.birth_date),
        location: clean(p.location),
        citizenship: clean(p.citizenship),
        height: withUnit(p.height, "cm"),
        weight: withUnit(p.weight, "kg"),
        measurements: clean(p.measurements),
        clothingSize: normalizeClothingSize(p.clothing_size),
        shoeSize: formatShoeSize(p.shoe_size),
        badge: badgeOf(p),
        about: stripContacts(clean(p.about)),
        photos: await resolvePhotos(db, p, MAX_PRESENTATION_PHOTOS),
      },
    };
  } catch (err) {
    console.error("[resident-dossier] presentation", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}

/* ── Полное досье: только owner, с журналом ──────────────────────── */

function kindOf(mime: string | null, path: string): DossierKycFile["kind"] {
  const m = (mime ?? "").toLowerCase();
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"].includes(ext)) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("video/") || ["mp4", "mov", "webm", "m4v", "avi"].includes(ext)) return "video";
  return "other";
}

function kycPath(value: string): string | null {
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const match = new URL(path).pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/kyc-vault\/(.+)$/i);
      if (!match) return null;
      path = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  path = path.replace(/^\/+/, "").replace(/^kyc-vault\//, "");
  if (!path || path.split("/").some((part) => part === ".." || part === ".")) return null;
  return path;
}

const STATUS_RU: Record<string, string> = { pending: "На проверке", approved: "Подтверждён", rejected: "Отклонён" };
const REQUEST_STATUS_RU: Record<string, string> = { open: "Открыт", in_progress: "В работе", done: "Выполнен", impossible: "Невозможно" };

export async function getResidentDossierPdf(profileId: string): Promise<PdfActionResult<DossierPdfData>> {
  if (typeof profileId !== "string" || !UUID_RE.test(profileId)) return { ok: false, reason: "invalid" };
  try {
    const db = getTelegramServiceClient();
    const actorResult = await loadActor(db);
    if (!actorResult.ok) return actorResult;
    const { actor } = actorResult;
    if (actor.role !== "owner") return { ok: false, reason: "forbidden" };

    const target = await loadTarget(db, profileId);
    if (!target.ok) return target;
    const p = target.profile;
    const fullName = fullNameOf(p);

    // 1) Сначала журнал. Нет записи — нет досье.
    const auditId = await writeAudit(db, actor, "resident.dossier_pdf", { id: p.id, label: fullName }, { scope: "full_dossier", format: "pdf" });
    if (!auditId) return { ok: false, reason: "audit_failed" };

    // 2) Контакты из всех источников
    const ids = Array.from(new Set([p.id, p.user_id].filter((v): v is string => Boolean(v) && UUID_RE.test(String(v)))));
    const contacts: DossierContact[] = [];
    const seen = new Set<string>();
    const addContact = (label: string, value: unknown, source: string) => {
      const v = clean(value);
      if (!v) return;
      const key = `${label}|${v.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      contacts.push({ label, value: v.slice(0, 300), source });
    };

    addContact("Email", p.email, "Профиль");
    if (p.telegram_username) addContact("Telegram", `@${p.telegram_username.replace(/^@/, "")}`, "Профиль");
    addContact("Telegram ID", p.telegram_id, "Профиль");

    try {
      const { data: authUser } = await db.auth.admin.getUserById(p.user_id ?? p.id);
      addContact("Email", authUser?.user?.email, "Аккаунт входа");
      addContact("Телефон", authUser?.user?.phone ? `+${String(authUser.user.phone).replace(/^\+/, "")}` : null, "Аккаунт входа");
    } catch {
      // профиль без auth-пользователя (импорт) — не ошибка
    }

    const [apps, guestsByProfile, guestsByTelegram] = await Promise.all([
      db.from("resident_applications").select("phone,full_name,created_at").in("user_id", ids).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
      db.from("guest_applications").select("contact,telegram,whatsapp,instagram,portfolio_url,created_at").eq("linked_profile_id", p.id).order("created_at", { ascending: false }).limit(10),
      p.telegram_id && /^\d{4,20}$/.test(p.telegram_id)
        ? db.from("guest_applications").select("contact,telegram,whatsapp,instagram,portfolio_url,created_at").eq("telegram_id", p.telegram_id).order("created_at", { ascending: false }).limit(10)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const row of (apps.data ?? []) as { phone: string | null }[]) addContact("Телефон", row.phone, "Анкета резидента");
    for (const row of [...(guestsByProfile.data ?? []), ...(guestsByTelegram.data ?? [])] as Record<string, string | null>[]) {
      addContact("Контакт", row.contact, "Заявка с сайта");
      addContact("Telegram", row.telegram, "Заявка с сайта");
      addContact("WhatsApp", row.whatsapp, "Заявка с сайта");
      addContact("Instagram", row.instagram, "Заявка с сайта");
      addContact("Портфолио", row.portfolio_url, "Заявка с сайта");
    }

    // 3) История KYC + файлы паспорта
    const { data: subs, error: subsError } = await db.from("kyc_submissions")
      .select("id,level,file_path,mime_type,size_bytes,status,created_at,reviewed_at,reviewed_by")
      .in("profile_id", ids)
      .order("created_at", { ascending: true })
      .limit(MAX_KYC_FILES);
    if (subsError) console.error("[resident-dossier] kyc", subsError.code ?? "unknown");
    const subRows = (subs ?? []) as {
      id: string; level: number; file_path: string; mime_type: string | null; size_bytes: number | null;
      status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null;
    }[];

    const reviewerIds = Array.from(new Set(subRows.map((r) => r.reviewed_by).filter((v): v is string => Boolean(v))));
    const reviewerNames = new Map<string, string>();
    if (reviewerIds.length) {
      const { data: reviewers } = await db.from("profiles").select("id,full_name,name,email").in("id", reviewerIds);
      for (const r of (reviewers ?? []) as { id: string; full_name: string | null; name: string | null; email: string | null }[]) {
        reviewerNames.set(r.id, clean(r.full_name) ?? clean(r.name) ?? clean(r.email) ?? r.id.slice(0, 8));
      }
    }

    const kycFiles: DossierKycFile[] = [];
    for (const row of subRows) {
      const path = kycPath(row.file_path);
      const kind = kindOf(row.mime_type, row.file_path);
      let url: string | null = null;
      if (path && (kind === "image" || kind === "pdf")) {
        const { data: signed } = await db.storage.from("kyc-vault").createSignedUrl(path, SIGNED_TTL_SECONDS);
        url = signed?.signedUrl ?? null;
      }
      kycFiles.push({
        id: row.id,
        level: row.level,
        status: STATUS_RU[row.status] ?? row.status,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        createdAt: fmtDate(row.created_at) ?? row.created_at,
        reviewedAt: fmtDate(row.reviewed_at),
        reviewedBy: row.reviewed_by ? reviewerNames.get(row.reviewed_by) ?? row.reviewed_by.slice(0, 8) : null,
        fileName: (path ?? row.file_path).split("/").pop() ?? "file",
        url,
        kind,
      });
    }

    const { data: requests } = await db.from("partner_concierge_requests")
      .select("id,title,status,created_at,resolved_at,admin_feedback")
      .in("resident_id", ids)
      .like("title", `${KYC3_REQUEST_PREFIX}%`)
      .order("created_at", { ascending: true })
      .limit(20);
    const kycRequests: DossierKycRequest[] = ((requests ?? []) as {
      id: string; title: string; status: string; created_at: string; resolved_at: string | null; admin_feedback: string | null;
    }[]).map((r) => ({
      id: r.id,
      title: r.title,
      status: REQUEST_STATUS_RU[r.status] ?? r.status,
      createdAt: fmtDate(r.created_at) ?? r.created_at,
      resolvedAt: fmtDate(r.resolved_at),
      feedback: clean(r.admin_feedback),
    }));

    const badge = badgeOf(p);
    const pairs = (rows: [string, string | null][]) => rows.filter((r): r is [string, string] => Boolean(r[1])).map(([label, value]) => ({ label, value }));
    const age = ageFrom(p.birth_date);

    return {
      ok: true,
      data: {
        kind: "dossier",
        generatedAt: new Date().toISOString(),
        auditId,
        viewer: { email: actor.email, profileId: actor.profileId },
        profileId: p.id,
        memberNo: memberNo(p),
        fullName,
        identity: pairs([
          ["ФИО", fullName],
          ["Имя в профиле", clean(p.name)],
          ["Дата рождения", p.birth_date ? `${fmtDate(p.birth_date, false)}${age ? ` · ${age} лет` : ""}` : null],
          ["Гражданство", clean(p.citizenship)],
          ["Локация", clean(p.location)],
          ["Profile ID", p.id],
          ["Auth user ID", clean(p.user_id)],
          ["Язык Telegram", clean(p.telegram_language)],
          ["USDT кошелёк", clean(p.usdt_wallet)],
        ]),
        contacts,
        physical: pairs([
          ["Рост", withUnit(p.height, "см")],
          ["Вес", withUnit(p.weight, "кг")],
          ["Параметры", clean(p.measurements)],
          ["Размер одежды", normalizeClothingSize(p.clothing_size)],
          ["Размер обуви", formatShoeSize(p.shoe_size) ? `${formatShoeSize(p.shoe_size)} EU` : null],
          ["Курение", p.smoking === null ? null : p.smoking ? "Да" : "Нет"],
          ["Алкоголь", p.alcohol === null ? null : p.alcohol ? "Да" : "Нет"],
        ]),
        club: pairs([
          ["Статус", clean(p.status)],
          ["Сегмент", badge.segment === "elite" ? "ELITE" : "WORKING"],
          ["Circle", `${badge.circleTitle} · уровень ${badge.circleLevel}`],
          ["KYC", `${badge.kycLevel}/3${badge.vip ? " · VIP" : ""}`],
          ["Надёжность", clean(p.reliability) ? `${clean(p.reliability)}%` : null],
          ["Индекс влияния", clean(p.influence_index)],
          ["Баллы", clean(p.tour_points)],
          ["Регистрация", fmtDate(p.created_at)],
          ["Источник", clean(p.registration_source)],
          ["UTM", [p.utm_source, p.utm_medium, p.utm_campaign].map(clean).filter(Boolean).join(" / ") || null],
          ["Был(а) в сети", fmtDate(p.last_seen_at)],
          ["Блокировка", p.ban_permanent ? "Навсегда" : isBanActive(p) ? `до ${fmtDate(p.banned_until)}` : null],
          ["Причина блокировки", isBanActive(p) ? clean(p.ban_reason) : null],
        ]),
        badge,
        about: clean(p.about),
        photos: await resolvePhotos(db, p, MAX_DOSSIER_PHOTOS),
        kycFiles,
        kycRequests,
      },
    };
  } catch (err) {
    console.error("[resident-dossier] dossier", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}
