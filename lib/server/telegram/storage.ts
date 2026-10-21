import "server-only";

import { randomUUID } from "node:crypto";
import type { Api } from "grammy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const BUCKET = process.env.TELEGRAM_STORAGE_BUCKET?.trim() || "user-uploads";

/** Downloads a Telegram photo server-side and stores it in the private VOYAGE bucket. */
export async function uploadTelegramPhoto(api: Api, fileId: string, telegramId: string): Promise<string> {
  if (!/^\d{4,20}$/.test(telegramId)) throw new Error("Invalid Telegram ID.");

  const file = await api.getFile(fileId);
  if (!file.file_path) throw new Error("Telegram did not return a file path.");
  if (typeof file.file_size === "number" && file.file_size > MAX_PHOTO_BYTES) {
    throw new Error("Photo exceeds the 10 MB limit.");
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token is missing.");
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not download the Telegram photo.");

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PHOTO_BYTES) throw new Error("Photo exceeds the 10 MB limit.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("Photo is empty or exceeds the 10 MB limit.");
  }

  const objectPath = `${telegramId}/${randomUUID()}.jpg`;
  const { error } = await getTelegramServiceClient().storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("[telegram-webhook] photo upload failed", error.name ?? "unknown");
    throw new Error("Could not store the Telegram photo.");
  }
  return objectPath;
}
