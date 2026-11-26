import "server-only";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток — серверные помощники (этап 2)
 * lib/server/resident-catalog.ts
 *
 * Подпись ссылок на фото (user-uploads) и обложки видео (resident-media)
 * на 10 минут. Подписываются ТОЛЬКО пути, которые RPC каталога вернула
 * текущему пользователю, и только из папки той резидентки, чья это
 * строка. Путь от клиента сюда не попадает никогда.
 * ──────────────────────────────────────────────────────────────────── */

import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { MEDIA_BUCKET, MEDIA_SIGNED_TTL } from "@/lib/resident-media";
import { isMediaPathOf } from "@/lib/server/resident-media";
import type { CatalogCard, CatalogItem } from "@/lib/resident-catalog";

const PHOTO_BUCKET = "user-uploads";
const isUrl = (v: string) => /^https:\/\//i.test(v);

function photoPathOf(residentId: string, path: string | null): string | null {
  if (!path) return null;
  if (isUrl(path)) return path;
  const clean = path.replace(/^\/+/, "");
  if (clean.includes("..") || clean.split("/")[0] !== residentId) return null;
  return clean;
}

async function signAll(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter((p) => p && !isUrl(p))));
  if (!unique.length) return out;
  try {
    const { data, error } = await getTelegramServiceClient().storage.from(bucket).createSignedUrls(unique, MEDIA_SIGNED_TTL);
    if (error) console.error("[resident-catalog] sign", bucket, error.name ?? "unknown");
    for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl);
  } catch (error) {
    console.error("[resident-catalog] sign", bucket, error);
  }
  return out;
}

/** Обложка и первое фото строк сетки → подписанные ссылки */
export async function signItems<T extends CatalogItem>(items: T[]): Promise<T[]> {
  const photos: string[] = [];
  const posters: string[] = [];
  for (const it of items) {
    const p = photoPathOf(it.id, it.photo);
    if (p) photos.push(p);
    if (isMediaPathOf(it.id, it.poster)) posters.push(it.poster);
  }
  const [sp, sv] = await Promise.all([signAll(PHOTO_BUCKET, photos), signAll(MEDIA_BUCKET, posters)]);
  return items.map((it) => {
    const p = photoPathOf(it.id, it.photo);
    return {
      ...it,
      photo: p ? (isUrl(p) ? p : sp.get(p) ?? null) : null,
      poster: isMediaPathOf(it.id, it.poster) ? sv.get(it.poster) ?? null : null,
    };
  });
}

export async function signCard(card: CatalogCard): Promise<CatalogCard> {
  const [base] = await signItems([card]);
  const paths = card.photos.map((p) => photoPathOf(card.id, p)).filter((p): p is string => !!p);
  const signed = await signAll(PHOTO_BUCKET, paths);
  return {
    ...base,
    photos: paths.map((p) => (isUrl(p) ? p : signed.get(p) ?? "")).filter(Boolean),
  };
}
