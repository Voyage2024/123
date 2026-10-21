import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

/* ──────────────────────────────────────────────────────────────────────
 * /sitemap.xml — публичные страницы для поисковиков: главная, регионы
 * и все опубликованные гайды (обновляется раз в час и после правок
 * в /admin/guides). Нужен NEXT_PUBLIC_SITE_URL, например https://voyage.club
 * ──────────────────────────────────────────────────────────────────── */

export const revalidate = 3600;

const STATIC_PATHS = [
  "/",
  "/destinations/europe",
  "/destinations/americas",
  "/destinations/asia-pacific",
  "/destinations/middle-east",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return [];

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return entries;

  // Анонимный клиент без cookies: RLS отдаёт только опубликованные гайды
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from("guides")
    .select("slug,updated_at")
    .eq("is_published", true)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[sitemap] guides load failed:", error.message);
    return entries;
  }

  for (const guide of data ?? []) {
    entries.push({
      url: `${base}/guides/${guide.slug}`,
      lastModified: guide.updated_at,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }
  return entries;
}
