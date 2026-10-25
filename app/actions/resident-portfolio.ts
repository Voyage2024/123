"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

/* ──────────────────────────────────────────────────────────────────────
 * Портфолио резидента (profiles.photo_urls + бакет user-uploads).
 *
 * Почему через сервер, а не напрямую из браузера:
 * 1. Политики storage.objects для `user-uploads` разрешают резиденту
 *    INSERT/DELETE только файлов `<uid>/avatar-<uuid>.*`. Фото портфолио
 *    браузер не мог ни загрузить, ни удалить — Supabase при этом молча
 *    возвращает пустой результат, а UI думал, что всё прошло.
 * 2. Ошибки upsert в profiles глотались, а удаление шло по индексу
 *    картинки на экране, который не совпадал с индексом в photo_urls
 *    (прямые ссылки и пути сортировались по-разному, «битые» файлы
 *    выпадали из списка) — удалялось не то фото или ничего.
 *
 * Теперь каждое изменение — это атомарная операция на сервере:
 * читаем текущий массив → меняем → пишем с проверкой updated_at
 * (если параллельно что-то записали, повторяем) → возвращаем клиенту
 * актуальный массив из БД вместе с signed URL. Клиент показывает ровно
 * то, что лежит в базе, поэтому после перезагрузки ничего не «откатится».
 * ──────────────────────────────────────────────────────────────────── */

const BUCKET = "user-uploads";
const MAX_PORTFOLIO_PHOTOS = 12;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60; // 1 час
const WRITE_ATTEMPTS = 3;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const PORTFOLIO_FILE_RE =
  /^portfolio-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif)$/i;

export type PortfolioPhoto = { entry: string; src: string | null };

export type PortfolioError =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "too_many"
  | "too_large"
  | "conflict"
  | "server_error";

export type PortfolioResult =
  | { ok: true; photoUrls: string[]; photos: PortfolioPhoto[] }
  | { ok: false; reason: PortfolioError };

export type UploadSlot = { path: string; token: string };

type Owner = {
  profileId: string;
  telegramId: string | null;
  photoUrls: string[];
  avatarUrl: string | null;
  updatedAt: string;
};

type Fail = { ok: false; reason: PortfolioError };

const isDirectUrl = (entry: string) => /^https?:\/\//i.test(entry);

function cleanEntries(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
}

/** Папки бакета, которые принадлежат резиденту: id профиля и (для анкет из бота) telegram_id. */
function ownsStoragePath(owner: Owner, path: string): boolean {
  if (isDirectUrl(path) || path.split("/").some((p) => p === "" || p === "." || p === "..")) return false;
  const folder = path.split("/")[0];
  return folder === owner.profileId || (!!owner.telegramId && folder === owner.telegramId);
}

async function loadOwner(): Promise<{ ok: true; owner: Owner } | Fail> {
  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { ok: false, reason: "unauthenticated" };

  const db = getTelegramServiceClient();
  const columns = "id,role,telegram_id,photo_urls,avatar_url,updated_at,banned_until,ban_permanent";
  let query = await db.from("profiles").select(columns).eq("id", auth.user.id).maybeSingle();
  if (query.error) return { ok: false, reason: "server_error" };
  // Старые записи, где PK профиля и auth user_id различаются.
  if (!query.data) {
    query = await db.from("profiles").select(columns).eq("user_id", auth.user.id).maybeSingle();
    if (query.error) return { ok: false, reason: "server_error" };
  }
  const row = query.data;
  if (!row) return { ok: false, reason: "not_found" };

  const banned =
    row.ban_permanent === true ||
    (typeof row.banned_until === "string" &&
      (row.banned_until === "infinity" || Date.parse(row.banned_until) > Date.now()));
  if (banned || String(row.role) !== "resident") return { ok: false, reason: "forbidden" };

  return {
    ok: true,
    owner: {
      profileId: String(row.id),
      telegramId: row.telegram_id ? String(row.telegram_id) : null,
      photoUrls: cleanEntries(row.photo_urls),
      avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
      updatedAt: String(row.updated_at),
    },
  };
}

/** Signed URL в том же порядке, что и photo_urls. src = null — файла в бакете нет. */
async function signEntries(entries: string[]): Promise<PortfolioPhoto[]> {
  const paths = entries.filter((e) => !isDirectUrl(e));
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await getTelegramServiceClient()
      .storage.from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) console.error("[resident-portfolio] sign failed", error.name ?? "unknown");
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) signedByPath.set(item.path, item.signedUrl);
    }
  }
  return entries.map((entry) => ({
    entry,
    src: isDirectUrl(entry) ? entry : signedByPath.get(entry) ?? null,
  }));
}

/**
 * Меняет photo_urls с защитой от гонок: запись проходит, только если
 * updated_at не изменился с момента чтения (его обновляет триггер
 * guard_profile_update). Иначе перечитываем и пробуем снова.
 */
async function mutatePhotoUrls(
  initial: Owner,
  change: (current: string[]) => string[] | Fail
): Promise<{ ok: true; owner: Owner; photoUrls: string[] } | Fail> {
  const db = getTelegramServiceClient();
  let owner = initial;

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const next = change(owner.photoUrls);
    if (!Array.isArray(next)) return next;

    const { data, error } = await db
      .from("profiles")
      .update({ photo_urls: next })
      .eq("id", owner.profileId)
      .eq("updated_at", owner.updatedAt)
      .select("photo_urls")
      .maybeSingle();
    if (error) {
      console.error("[resident-portfolio] update failed", { code: error.code ?? "unknown" });
      return { ok: false, reason: "server_error" };
    }
    if (data) return { ok: true, owner, photoUrls: cleanEntries(data.photo_urls) };

    const reloaded = await loadOwner();
    if (!reloaded.ok) return reloaded;
    owner = reloaded.owner;
  }
  return { ok: false, reason: "conflict" };
}

async function done(photoUrls: string[]): Promise<PortfolioResult> {
  revalidatePath("/dashboard");
  return { ok: true, photoUrls, photos: await signEntries(photoUrls) };
}

/** Актуальное портфолио из БД (например, для повторной синхронизации). */
export async function getPortfolio(): Promise<PortfolioResult> {
  const loaded = await loadOwner();
  if (!loaded.ok) return loaded;
  return { ok: true, photoUrls: loaded.owner.photoUrls, photos: await signEntries(loaded.owner.photoUrls) };
}

/**
 * Шаг 1 загрузки: выдаёт одноразовые signed upload URL в папку резидента.
 * Сам файл браузер отправляет напрямую в Storage (uploadToSignedUrl),
 * минуя лимит размера тела Server Action.
 */
export async function createPortfolioUploadSlots(
  files: { size: number; type: string; name?: string }[]
): Promise<{ ok: true; slots: UploadSlot[] } | Fail> {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_PORTFOLIO_PHOTOS) {
    return { ok: false, reason: "invalid" };
  }
  const loaded = await loadOwner();
  if (!loaded.ok) return loaded;
  if (loaded.owner.photoUrls.length + files.length > MAX_PORTFOLIO_PHOTOS) {
    return { ok: false, reason: "too_many" };
  }

  const storage = getTelegramServiceClient().storage.from(BUCKET);
  const slots: UploadSlot[] = [];
  for (const file of files) {
    // Некоторые телефоны отдают HEIC с пустым type — тогда смотрим на расширение.
    const byName = String(file?.name ?? "").toLowerCase().match(/\.(jpe?g|png|webp|heic|heif)$/)?.[1];
    const ext =
      EXT_BY_MIME[String(file?.type ?? "").toLowerCase()] ??
      (byName ? (byName === "jpeg" ? "jpg" : byName) : undefined);
    if (!ext) return { ok: false, reason: "invalid" };
    if (typeof file.size !== "number" || file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      return { ok: false, reason: "too_large" };
    }
    const path = `${loaded.owner.profileId}/portfolio-${randomUUID()}.${ext}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data?.token) {
      console.error("[resident-portfolio] upload slot failed", error?.name ?? "unknown");
      return { ok: false, reason: "server_error" };
    }
    slots.push({ path, token: data.token });
  }
  return { ok: true, slots };
}

/** Шаг 2 загрузки: дописывает реально загруженные файлы в photo_urls. */
export async function attachPortfolioPhotos(paths: string[]): Promise<PortfolioResult> {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PORTFOLIO_PHOTOS) {
    return { ok: false, reason: "invalid" };
  }
  const loaded = await loadOwner();
  if (!loaded.ok) return loaded;
  const { profileId } = loaded.owner;

  const unique = Array.from(new Set(paths));
  for (const path of unique) {
    const [folder, name, ...rest] = String(path).split("/");
    if (folder !== profileId || !name || rest.length || !PORTFOLIO_FILE_RE.test(name)) {
      return { ok: false, reason: "invalid" };
    }
  }

  // Берём только те файлы, которые действительно есть в бакете.
  const { data: listed, error: listError } = await getTelegramServiceClient()
    .storage.from(BUCKET)
    .list(profileId, { limit: 1000, search: "portfolio-" });
  if (listError) return { ok: false, reason: "server_error" };
  const existing = new Set((listed ?? []).map((o) => `${profileId}/${o.name}`));
  const uploaded = unique.filter((p) => existing.has(p));
  if (!uploaded.length) return { ok: false, reason: "not_found" };

  const result = await mutatePhotoUrls(loaded.owner, (current) => {
    const added = uploaded.filter((p) => !current.includes(p));
    if (current.length + added.length > MAX_PORTFOLIO_PHOTOS) return { ok: false, reason: "too_many" };
    return [...current, ...added];
  });
  if (!result.ok) return result;
  return done(result.photoUrls);
}

/**
 * Удаляет фото по значению из photo_urls (не по индексу на экране):
 * сначала из БД, затем физически из Storage, если файл лежит в папке
 * резидента и больше нигде в профиле не используется.
 */
export async function removePortfolioPhoto(entry: string): Promise<PortfolioResult> {
  if (typeof entry !== "string" || !entry.trim()) return { ok: false, reason: "invalid" };
  const loaded = await loadOwner();
  if (!loaded.ok) return loaded;

  const result = await mutatePhotoUrls(loaded.owner, (current) =>
    current.filter((e) => e !== entry)
  );
  if (!result.ok) return result;

  const owner = result.owner;
  const stillUsed = result.photoUrls.includes(entry) || owner.avatarUrl === entry;
  if (!stillUsed && ownsStoragePath(owner, entry)) {
    const { error } = await getTelegramServiceClient().storage.from(BUCKET).remove([entry]);
    // Запись в БД уже правильная; «сирота» в бакете не вернёт фото в анкету.
    if (error) console.error("[resident-portfolio] storage remove failed", error.name ?? "unknown");
  }
  return done(result.photoUrls);
}
