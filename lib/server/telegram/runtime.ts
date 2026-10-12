import "server-only";

import type { Bot } from "grammy";
import { createVoyageTelegramBot } from "./bot";

let instance: Bot | null = null;
let tokenUsed: string | null = null;

/** Reuses one grammY instance inside this Next.js worker. Serverless can create more than one worker. */
export function getVoyageTelegramBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  if (!instance || tokenUsed !== token) {
    instance = createVoyageTelegramBot(token);
    tokenUsed = token;
  }
  return instance;
}
