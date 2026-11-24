"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · анкеты откликнувшихся для ответственного за кастинг
 * app/actions/casting-candidates.ts
 *
 *   getCastingCandidateProfile  анкета одной кандидатки (RPC
 *                               partner_manager_candidate_profile) + фото
 *   getCastingCandidateThumbs   миниатюры для доски откликов
 *
 * Кто что видит, решает ТОЛЬКО база: RPC вызываются от имени пользователя
 * (его сессия), право — voyage_casting_profile_access (миграция
 * 20261127090000). Сервисный ключ здесь нужен лишь для подписи ссылок на
 * фото в приватном бакете user-uploads, и подписываются только пути,
 * которые эта RPC уже вернула этому пользователю. Путь от клиента не
 * принимается никогда.
 * ──────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { parseCandidateProfile, type CandidateProfile } from "@/lib/casting-candidate";

type Failure = "forbidden" | "not_found" | "withdrawn" | "invalid" | "schema" | "failed";
export type CandidateProfileResult = { ok: true; profile: CandidateProfile } | { ok: false; reason: Failure };
export type CandidateThumbsResult = { ok: true; thumbs: Record<string, string> } | { ok: false; reason: Failure };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = "user-uploads";
const SIGNED_TTL = 60 * 60;
const isUrl = (v: string) => /^https?:\/\//i.test(v);

function failureOf(error: { code?: string; message?: string }): Failure {
  const msg = error.message ?? "";
  if (msg.includes("candidate_withdrawn")) return "withdrawn";
  if (error.code === "42501" || msg.includes("voyage:forbidden")) return "forbidden";
  if (error.code === "P0002") return "not_found";
  if (error.code === "42883" || error.code === "PGRST202") return "schema";
  if (error.code === "22023" || error.code === "22P02") return "invalid";
  console.error("[casting-candidates]", error.code, msg);
  return "failed";
}

/** Подписать пути из приватного бакета; прямые https-ссылки — как есть */
async function sign(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const storagePaths: string[] = [];
  for (const p of paths) {
    if (isUrl(p)) out.set(p, p);
    else if (p && !p.includes("..")) storagePaths.push(p.replace(/^\/+/, ""));
  }
  if (storagePaths.length === 0) return out;
  try {
    const { data } = await getTelegramServiceClient().storage.from(BUCKET).createSignedUrls(storagePaths, SIGNED_TTL);
    for (const item of data ?? []) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  } catch (error) {
    console.error("[casting-candidates] sign", error);
  }
  return out;
}

export async function getCastingCandidateProfile(castingId: string, residentId: string): Promise<CandidateProfileResult> {
  if (!UUID_RE.test(String(castingId)) || !UUID_RE.test(String(residentId))) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_manager_candidate_profile", {
    p_casting: castingId,
    p_resident: residentId,
  });
  if (error) return { ok: false, reason: failureOf(error) };
  const raw = parseCandidateProfile(data);
  if (!raw) return { ok: false, reason: "failed" };

  const signed = await sign([...raw.photoPaths, ...raw.snapPaths.map((s) => s.path)]);
  const { photoPaths, snapPaths, ...rest } = raw;
  return {
    ok: true,
    profile: {
      ...rest,
      photos: photoPaths.map((p) => signed.get(p.replace(/^\/+/, "")) ?? signed.get(p)).filter((s): s is string => !!s).map((src) => ({ src })),
      snaps: snapPaths
        .map((s) => ({ src: signed.get(s.path) ?? "", capturedAt: s.capturedAt }))
        .filter((s) => s.src),
    },
  };
}

type BoardRow = { resident_id?: unknown; photo_urls?: unknown; avatar_url?: unknown; profile_available?: unknown };

/** Миниатюры доски: первая фотография каждой кандидатки, которую RPC отдала этому пользователю */
export async function getCastingCandidateThumbs(castingId: string): Promise<CandidateThumbsResult> {
  if (!UUID_RE.test(String(castingId))) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("partner_manager_get_responses", { p_casting_id: castingId });
  if (error) return { ok: false, reason: failureOf(error) };

  const firstByResident = new Map<string, string>();
  for (const row of (Array.isArray(data) ? data : []) as BoardRow[]) {
    if (row.profile_available === false || typeof row.resident_id !== "string") continue;
    const photos = Array.isArray(row.photo_urls) ? row.photo_urls.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
    const first = photos[0] ?? (typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url : null);
    if (first) firstByResident.set(row.resident_id, first.trim());
  }
  const signed = await sign(Array.from(firstByResident.values()));
  const thumbs: Record<string, string> = {};
  for (const [id, path] of firstByResident) {
    const url = signed.get(path.replace(/^\/+/, "")) ?? signed.get(path);
    if (url) thumbs[id] = url;
  }
  return { ok: true, thumbs };
}
