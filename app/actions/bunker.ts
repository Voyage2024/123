"use server";

import { requireBunkerViewer } from "@/lib/bunker/access";
import { bunkerSupabase, clearBunkerToken, getBunkerToken, setBunkerToken } from "@/lib/bunker/session";

/* ──────────────────────────────────────────────────────────────────────
 * Server actions личного бункера: PIN-замок и Duress PIN.
 *
 * Сами PIN проверяет база (bcrypt, счётчик ошибок, паузы) —
 * см. supabase/migrations/20261022130000_bunker_pin_lock_duress.sql.
 * Здесь только передаём PIN в базу и кладём токен сессии в httpOnly-cookie.
 *
 * Ни один ответ не сообщает, какой PIN был введён — настоящий или Duress:
 * браузер этого не знает, режим знает только база.
 * ──────────────────────────────────────────────────────────────────── */

export type UnlockResult =
  | { status: "ok" }
  | { status: "invalid"; attemptsLeft: number }
  | { status: "locked"; retryAfter: number }
  | { status: "setup" }
  | { status: "error"; message: string };

type DbAnswer = { status?: string; token?: string; attempts_left?: number; retry_after?: number; message?: string } | null;

function toResult(answer: DbAnswer): UnlockResult {
  switch (answer?.status) {
    case "ok":
      return { status: "ok" };
    case "locked":
      return { status: "locked", retryAfter: Math.max(1, Number(answer.retry_after ?? 30)) };
    case "setup":
      return { status: "setup" };
    case "error":
      return { status: "error", message: answer.message ?? "Не получилось" };
    default:
      return answer?.retry_after
        ? { status: "locked", retryAfter: Number(answer.retry_after) }
        : { status: "invalid", attemptsLeft: Number(answer?.attempts_left ?? 0) };
  }
}

/** Открытие бункера (и при каждой загрузке приложения): старая сессия всегда закрывается. */
export async function bunkerPinStatus(): Promise<{ hasMaster: boolean }> {
  await requireBunkerViewer();
  await lockBunker();
  const supabase = await bunkerSupabase(null);
  const { data } = await supabase.rpc("bunker_pin_status");
  return { hasMaster: !!(data as { has_master?: boolean } | null)?.has_master };
}

export async function setupMasterPin(pin: string): Promise<UnlockResult> {
  await requireBunkerViewer();
  const supabase = await bunkerSupabase(null);
  const { data, error } = await supabase.rpc("bunker_setup_master", { p_pin: pin });
  if (error || typeof data !== "string") return { status: "error", message: error?.message ?? "Не получилось" };
  await setBunkerToken(data);
  return { status: "ok" };
}

export async function unlockBunker(pin: string): Promise<UnlockResult> {
  await requireBunkerViewer();
  await lockBunker();
  const supabase = await bunkerSupabase(null);
  const { data, error } = await supabase.rpc("bunker_unlock", { p_pin: pin });
  if (error) return { status: "error", message: "Сервер недоступен, попробуй ещё раз" };
  const answer = data as DbAnswer;
  if (answer?.status === "ok" && answer.token) await setBunkerToken(answer.token);
  return toResult(answer);
}

export async function lockBunker(): Promise<void> {
  const token = await getBunkerToken();
  if (token) {
    const supabase = await bunkerSupabase(token);
    await supabase.rpc("bunker_end_session");
  }
  await clearBunkerToken();
}

/** Для экрана настроек. В режиме Duress всегда «не задан». */
export async function bunkerSecurityStatus(): Promise<{ hasDuress: boolean }> {
  await requireBunkerViewer();
  const supabase = await bunkerSupabase(await getBunkerToken());
  const { data } = await supabase.rpc("bunker_security_status");
  return { hasDuress: !!(data as { has_duress?: boolean } | null)?.has_duress };
}

export type VaultRekey = {
  salt: string;
  iterations: number;
  check_ciphertext: string;
  check_iv: string;
  uses_pepper: boolean;
  items: Array<{ id: string; ciphertext: string; iv: string }>;
} | null;

export async function changeMasterPin(oldPin: string, newPin: string, vault: VaultRekey): Promise<UnlockResult> {
  await requireBunkerViewer();
  const supabase = await bunkerSupabase(await getBunkerToken());
  const { data, error } = await supabase.rpc("bunker_change_master", { p_old: oldPin, p_new: newPin, p_vault: vault });
  if (error) return { status: "error", message: "Не получилось, обнови страницу" };
  return toResult(data as DbAnswer);
}

export async function setDuressPin(masterPin: string, duressPin: string, seed: Record<string, unknown>): Promise<UnlockResult> {
  await requireBunkerViewer();
  const supabase = await bunkerSupabase(await getBunkerToken());
  const { data, error } = await supabase.rpc("bunker_set_duress", { p_master: masterPin, p_duress: duressPin, p_seed: seed });
  if (error) return { status: "error", message: "Не получилось, обнови страницу" };
  return toResult(data as DbAnswer);
}

export async function removeDuressPin(masterPin: string): Promise<UnlockResult> {
  await requireBunkerViewer();
  const supabase = await bunkerSupabase(await getBunkerToken());
  const { data, error } = await supabase.rpc("bunker_remove_duress", { p_master: masterPin });
  if (error) return { status: "error", message: "Не получилось, обнови страницу" };
  return toResult(data as DbAnswer);
}

/**
 * Pepper для ключа сейфа (BUNKER_VAULT_PEPPER). Отдаётся только владельцу.
 * Без переменной — null, сейф работает на одном PIN.
 */
export async function getVaultPepper(): Promise<{ pepper: string | null }> {
  await requireBunkerViewer();
  const pepper = process.env.BUNKER_VAULT_PEPPER?.trim();
  return { pepper: pepper && pepper.length >= 16 ? pepper : null };
}
