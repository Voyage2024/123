/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Blacklist»
 * app/(dashboard)/partner/_lib/blacklist.ts
 *
 * Пока демо. При подключении — RPC под RLS, не прямой select:
 * менеджер не читает partner_blacklist напрямую. RPC отдаёт записи
 * со статусом confirmed и appeal (revoked — никогда), код записи,
 * причину, даты и число файлов-доказательств — без самих файлов.
 * Имя и id — только по правилу partner_can_reveal: бывшая участница
 * туров этого менеджера (владелец и админ видят всех).
 * ──────────────────────────────────────────────────────────────────── */

import { DAY, HOUR } from "./clock";
import type { BlacklistReason } from "./command";

export type BlacklistEntry = {
  id: string;
  code: string;
  residentId: string | null;
  name: string | null;
  reason: BlacklistReason;
  status: "confirmed" | "appeal";
  at: number;
  /** null — бессрочно */
  expiresAt: number | null;
  /** Сколько доказательств проверил ассистент клуба */
  evidence: number;
};

export type BlacklistData = {
  generatedAt: number;
  entries: BlacklistEntry[];
  /** Никого из тех, кого держит менеджер (состав, опцион), нет в списке */
  clean: boolean;
};

export function buildBlacklistMock(): BlacklistData {
  const t = Date.now();
  const year = 365 * DAY;
  const e = (
    id: string, code: string, reason: BlacklistReason, status: BlacklistEntry["status"], ago: number,
    evidence: number, opts: { residentId?: string; name?: string; forever?: boolean } = {},
  ): BlacklistEntry => ({
    id, code, reason, status, evidence,
    at: t - ago,
    expiresAt: opts.forever ? null : t - ago + year,
    residentId: opts.residentId ?? null,
    name: opts.name ?? null,
  });

  return {
    generatedAt: t,
    clean: true,
    entries: [
      // бывшие участницы ваших туров — имя и профиль открыты
      e("bl-1", "#R-204", "noShow", "confirmed", 3 * HOUR, 3, { residentId: "rs-0988", name: "Dasha O." }),
      e("bl-2", "#R-187", "fakePhotos", "appeal", 26 * HOUR, 4),
      e("bl-3", "#R-152", "fraud", "confirmed", 3 * DAY, 5, { forever: true }),
      e("bl-4", "#R-139", "noShow", "confirmed", 9 * DAY, 2),
      e("bl-5", "#R-121", "fakePhotos", "confirmed", 17 * DAY, 6, { residentId: "rs-0941", name: "Polina V." }),
      e("bl-6", "#R-118", "noShow", "appeal", 23 * DAY, 2),
      e("bl-7", "#R-097", "fraud", "confirmed", 41 * DAY, 7),
      e("bl-8", "#R-085", "noShow", "confirmed", 64 * DAY, 3),
      e("bl-9", "#R-061", "fakePhotos", "confirmed", 120 * DAY, 4),
    ],
  };
}
