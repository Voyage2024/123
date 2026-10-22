"use server";

import { requireBunkerViewer } from "@/lib/bunker/access";

/* ──────────────────────────────────────────────────────────────────────
 * Server actions личного бункера.
 *
 * Данные бункера читаются и пишутся напрямую из браузера через Supabase
 * (RLS: только свои строки и только при допуске). Здесь — то, что
 * требует серверного секрета.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Pepper для ключа сейфа. Отдаётся только владельцу бункера.
 * Если BUNKER_VAULT_PEPPER не задан — null, сейф работает на одном PIN.
 */
export async function getVaultPepper(): Promise<{ pepper: string | null }> {
  await requireBunkerViewer();
  const pepper = process.env.BUNKER_VAULT_PEPPER?.trim();
  return { pepper: pepper && pepper.length >= 16 ? pepper : null };
}
