import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────
 * Подписанные ссылки на фото из ПРИВАТНОГО бакета Supabase Storage.
 *
 * Бакет user-uploads приватный (политика «Read access for authenticated»),
 * поэтому public-URL не работает — нужны временные signed URL.
 *
 * ВАЖНО: используем существующий клиент из @/lib/supabase, а НЕ создаём
 * новый из anon-ключа. Только у него есть сессия залогиненного админа →
 * запрос идёт как authenticated и проходит политику. Свежий анонимный
 * клиент был бы ролью anon и получил бы 403.
 * ──────────────────────────────────────────────────────────────────── */

// ┌─ НАСТРОЙ ПОД СВОЙ ПРОЕКТ ──────────────────────────────────────────┐
const STORAGE_BUCKET = "user-uploads"; // имя приватного бакета
const SIGNED_URL_TTL = 3600; // срок жизни ссылки в секундах (1 час)
// └────────────────────────────────────────────────────────────────────┘

/**
 * Одна ссылка. Абсолютный URL отдаём как есть, относительный путь
 * подписываем. При ошибке — пустая строка (img просто не покажет фото).
 */
export async function resolvePhotoUrl(
  path: string | null | undefined,
): Promise<string> {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const clean = path.replace(/^\/+/, "");
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(clean, SIGNED_URL_TTL);

  if (error || !data) {
    console.error("[photoUrl] createSignedUrl:", error?.message, "→", clean);
    return "";
  }
  return data.signedUrl;
}

/**
 * Пакетно: массив путей → массив готовых ссылок ТОЙ ЖЕ длины и порядка
 * (пустые/битые позиции = ""). Все относительные пути подписываются одним
 * запросом через createSignedUrls — так эффективнее, чем по одному.
 */
export async function resolvePhotoUrls(
  paths: (string | null | undefined)[],
): Promise<string[]> {
  const list = paths ?? [];
  const results: string[] = new Array(list.length).fill("");

  const relIndexes: number[] = [];
  const relPaths: string[] = [];

  list.forEach((p, i) => {
    if (!p) return; // остаётся ""
    if (/^https?:\/\//i.test(p)) {
      results[i] = p; // уже абсолютный
    } else {
      relIndexes.push(i);
      relPaths.push(p.replace(/^\/+/, ""));
    }
  });

  if (relPaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(relPaths, SIGNED_URL_TTL);

    if (error) {
      console.error("[photoUrl] createSignedUrls:", error.message);
    } else if (data) {
      data.forEach((d, k) => {
        if (d.error) {
          console.error("[photoUrl] signed:", d.error, "→", d.path);
        }
        results[relIndexes[k]] = d.signedUrl ?? "";
      });
    }
  }

  return results;
}
