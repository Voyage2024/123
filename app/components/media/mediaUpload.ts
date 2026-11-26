"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity — загрузка видео из браузера
 * app/components/media/mediaUpload.ts
 *
 * Слот → загрузка файла прямо в Storage по одноразовому токену →
 * проверка и запись на сервере. Браузер не может писать в бакет без
 * слота: политик для authenticated на resident-media нет.
 * ──────────────────────────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase";
import { attachMedia, createMediaUploadSlot, discardMediaUpload, type MyMediaResult } from "@/app/actions/resident-media";
import { MEDIA_BUCKET, baseMime, type MediaKind, type MediaSource } from "@/lib/resident-media";

export type CapturedVideo = {
  blob: Blob;
  mime: string;
  durationMs: number;
  width: number | null;
  height: number | null;
  poster: Blob | null;
  source: MediaSource;
};

/** Кадр из видео → JPEG ≤ ~600 КБ (для обложки и мгновенного превью). */
export async function posterFromVideo(video: HTMLVideoElement, maxSide = 540): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
}

/** Длительность, размеры и обложка выбранного файла (метаданные читаются локально). */
export function probeVideoFile(file: Blob): Promise<{ durationMs: number; width: number | null; height: number | null; poster: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    let done = false;
    const finish = async (ok: boolean) => {
      if (done) return;
      done = true;
      const duration = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : 0;
      const poster = ok ? await posterFromVideo(v) : null;
      URL.revokeObjectURL(url);
      resolve({ durationMs: duration, width: v.videoWidth || null, height: v.videoHeight || null, poster });
    };
    v.onloadeddata = () => {
      // Кадр чуть позже начала — первый часто чёрный.
      try {
        v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
      } catch {
        void finish(true);
      }
    };
    v.onseeked = () => void finish(true);
    v.onerror = () => void finish(false);
    setTimeout(() => void finish(false), 8000);
    v.src = url;
  });
}

export async function uploadCapturedVideo(
  kind: MediaKind,
  video: CapturedVideo,
  topic: string | null,
): Promise<MyMediaResult> {
  const mime = baseMime(video.mime) ?? "video/mp4";
  const slot = await createMediaUploadSlot({ kind, mime, sizeBytes: video.blob.size, withPoster: !!video.poster });
  if (!slot.ok) return slot;
  const { path, token, posterPath, posterToken } = slot.slot;
  const bucket = supabase.storage.from(MEDIA_BUCKET);

  const up = await bucket.uploadToSignedUrl(path, token, video.blob, { contentType: mime, upsert: false });
  if (up.error) {
    await discardMediaUpload([path, posterPath ?? ""].filter(Boolean));
    return { ok: false, reason: /exceed|too large|413/i.test(up.error.message) ? "too_large" : "failed" };
  }
  let poster: string | null = null;
  if (video.poster && posterPath && posterToken) {
    const pr = await bucket.uploadToSignedUrl(posterPath, posterToken, video.poster, { contentType: "image/jpeg", upsert: false });
    poster = pr.error ? null : posterPath;
  }
  return attachMedia({
    kind,
    source: kind === "moment" ? "in_app_camera" : video.source,
    topic,
    path,
    posterPath: poster,
    durationMs: video.durationMs,
    width: video.width,
    height: video.height,
  });
}
