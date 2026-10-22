/* ──────────────────────────────────────────────────────────────────────
 * Сейф бункера — шифрование в браузере (Web Crypto API).
 *
 *   ключ   = PBKDF2-SHA256(PIN [+ pepper], соль 16 байт, 600 000 итераций) → AES-256-GCM
 *   запись = AES-256-GCM(JSON секрета, случайный iv 12 байт, AAD = "voyage-bunker:v1:<категория>")
 *
 * В базу уходят только base64(ciphertext) и base64(iv). PIN и ключ
 * никогда не покидают вкладку: ключ создаётся как non-extractable CryptoKey
 * и живёт в памяти до блокировки.
 *
 * PIN проверяется расшифровкой контрольной строки (check_ciphertext):
 * неверный PIN → GCM не сходится по тегу → ошибка.
 *
 * Pepper (BUNKER_VAULT_PEPPER, серверная env) — необязательная добавка:
 * без неё короткий PIN из утёкшего дампа базы перебирается офлайн,
 * с ней одного дампа мало. См. README.
 * ──────────────────────────────────────────────────────────────────── */

import type { VaultCategory, VaultSecret } from "@/lib/bunker/types";

export const VAULT_KDF_ITERATIONS = 600_000;
const CHECK_PLAINTEXT = "voyage-bunker:vault-check:v1";
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin);
}

export function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export async function deriveVaultKey(pin: string, saltB64: string, iterations: number, pepper: string | null) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(pepper ? `${pin}\u0000${pepper}` : pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptString(key: CryptoKey, plaintext: string, aad: string) {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad), tagLength: 128 },
    key,
    enc.encode(plaintext),
  );
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

async function decryptString(key: CryptoKey, ciphertextB64: string, ivB64: string, aad: string) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivB64), additionalData: enc.encode(aad), tagLength: 128 },
    key,
    fromBase64(ciphertextB64),
  );
  return dec.decode(plain);
}

const aadFor = (category: VaultCategory) => `voyage-bunker:v1:${category}`;

export async function encryptSecret(key: CryptoKey, category: VaultCategory, secret: VaultSecret) {
  return encryptString(key, JSON.stringify(secret), aadFor(category));
}

export async function decryptSecret(key: CryptoKey, category: VaultCategory, ciphertext: string, iv: string) {
  return JSON.parse(await decryptString(key, ciphertext, iv, aadFor(category))) as VaultSecret;
}

/** Новый ключ + контрольная запись для первого PIN или смены PIN. */
export async function createVaultKeyMaterial(pin: string, pepper: string | null) {
  const salt = toBase64(randomBytes(16));
  const key = await deriveVaultKey(pin, salt, VAULT_KDF_ITERATIONS, pepper);
  const check = await encryptString(key, CHECK_PLAINTEXT, "voyage-bunker:check");
  return {
    key,
    row: {
      kdf: "PBKDF2-SHA256" as const,
      iterations: VAULT_KDF_ITERATIONS,
      salt,
      check_ciphertext: check.ciphertext,
      check_iv: check.iv,
      uses_pepper: !!pepper,
    },
  };
}

/** null — PIN неверный. */
export async function unlockVault(
  pin: string,
  keys: { salt: string; iterations: number; check_ciphertext: string; check_iv: string },
  pepper: string | null,
): Promise<CryptoKey | null> {
  const key = await deriveVaultKey(pin, keys.salt, keys.iterations, pepper);
  try {
    const plain = await decryptString(key, keys.check_ciphertext, keys.check_iv, "voyage-bunker:check");
    return plain === CHECK_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

/** Генератор паролей без модульного перекоса. */
export function generatePassword(length = 20, symbols = true) {
  const alphabet = `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789${symbols ? "!@#$%^&*-_=+?" : ""}`;
  const out: string[] = [];
  const limit = 256 - (256 % alphabet.length);
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && out.length < length) out.push(alphabet[byte % alphabet.length]);
    }
  }
  return out.join("");
}
