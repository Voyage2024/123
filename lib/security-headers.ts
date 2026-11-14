/* ──────────────────────────────────────────────────────────────────────
 * Заголовки безопасности для всего сайта.
 *
 * Подключение — в next.config.ts (см. README_SECURITY_HARDENING_RU.md):
 *
 *   import { securityHeaders } from "./lib/security-headers";
 *   const nextConfig = {
 *     async headers() {
 *       return [{ source: "/:path*", headers: securityHeaders }];
 *     },
 *   };
 *
 * CSP включена в режиме Report-Only: браузер ничего не блокирует, только
 * пишет нарушения в консоль. Когда неделю в консоли прода чисто, поставьте
 * VOYAGE_CSP_ENFORCE=1 в Vercel — заголовок станет Content-Security-Policy.
 * ──────────────────────────────────────────────────────────────────── */

type Header = { key: string; value: string };

function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [url.origin, `wss://${url.host}`];
  } catch {
    return [];
  }
}

const isProd = process.env.NODE_ENV === "production";
const supabase = supabaseOrigins();

const csp = [
  "default-src 'self'",
  // Next.js встраивает inline-скрипты гидрации; 'unsafe-eval' нужен только dev-серверу.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Картинки гайдов могут быть с любого https-хоста (sanitize-html пропускает https).
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${supabase.join(" ")} https://challenges.cloudflare.com`.trim(),
  "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

export const securityHeaders: Header[] = [
  { key: process.env.VOYAGE_CSP_ENFORCE === "1" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: csp },
  // 2 года + поддомены. Включайте preload только когда все поддомены на HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Камера и микрофон нужны только для видео KYC (своя страница сайта).
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];
