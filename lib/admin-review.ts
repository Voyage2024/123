/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · очередь проверки в админке — общие типы (клиент + сервер)
 * lib/admin-review.ts
 *
 * «Требуют проверки» — это ровно три вещи:
 *   KYC 1 — паспорт загружен, заявка kyc_submissions.status = 'pending',
 *           а profiles.kyc_level ещё < 1;
 *   KYC 2 — то же самое для видео (level 2);
 *   KYC 3 — открытая заявка консьержу с заголовком «[KYC 3] …»
 *           (status open / in_progress), а kyc_level ещё < 3.
 * Консьерж в меню — все обращения со статусом open (ещё никто не взял).
 * ──────────────────────────────────────────────────────────────────── */

/** Тот же префикс, что ставит KycConciergeLevel (KYC3_REQUEST_PREFIX). */
export const KYC3_REQUEST_PREFIX = "[KYC 3]";

export const isKyc3RequestTitle = (title: unknown) =>
  typeof title === "string" && title.trim().startsWith(KYC3_REQUEST_PREFIX);

export type ReviewFlags = {
  /** ISO-время загрузки паспорта, который ждёт проверки */
  kyc1: string | null;
  /** ISO-время загрузки видео, которое ждёт проверки */
  kyc2: string | null;
  /** id открытой заявки на личную встречу с консьержем */
  kyc3: string | null;
};

export type ReviewQueue = {
  /** profileId → что ждёт проверки (в карте только те, у кого что-то есть) */
  byProfile: Record<string, ReviewFlags>;
  /** сколько резиденток ждут хоть какой-то проверки KYC */
  verification: number;
  /** сколько обращений к консьержу ещё в статусе open */
  conciergeOpen: number;
};

export type ReviewCounts = Pick<ReviewQueue, "verification" | "conciergeOpen">;

export const hasPendingReview = (f: ReviewFlags | null | undefined): f is ReviewFlags =>
  !!f && !!(f.kyc1 || f.kyc2 || f.kyc3);

/** Событие окна: что-то подтвердили/отклонили — сайдбар перечитывает счётчики. */
export const REVIEW_QUEUE_EVENT = "voyage:review-queue-changed";

export function announceReviewQueueChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REVIEW_QUEUE_EVENT));
}

type Lang4 = "EN" | "RU" | "ES" | "PT";

export const REVIEW_COPY: Record<Lang4, {
  kyc1: string; kyc2: string; kyc3: string; needsReview: string; bannerTitle: string; bannerHint: string; openConcierge: string;
}> = {
  RU: {
    kyc1: "Ожидает KYC 1", kyc2: "Ожидает KYC 2", kyc3: "Запрос KYC 3", needsReview: "Требуют проверки",
    bannerTitle: "Ждёт проверки", bannerHint: "Откройте файл ниже, проверьте и подтвердите уровень или отклоните заявку.",
    openConcierge: "Открыть заявку консьержу",
  },
  EN: {
    kyc1: "Awaiting KYC 1", kyc2: "Awaiting KYC 2", kyc3: "KYC 3 request", needsReview: "Needs review",
    bannerTitle: "Awaiting review", bannerHint: "Open the file below, check it and approve the level or reject the submission.",
    openConcierge: "Open concierge request",
  },
  ES: {
    kyc1: "Espera KYC 1", kyc2: "Espera KYC 2", kyc3: "Solicitud KYC 3", needsReview: "Por revisar",
    bannerTitle: "Pendiente de revisión", bannerHint: "Abre el archivo de abajo, revísalo y aprueba el nivel o rechaza la solicitud.",
    openConcierge: "Abrir solicitud al conserje",
  },
  PT: {
    kyc1: "Aguarda KYC 1", kyc2: "Aguarda KYC 2", kyc3: "Pedido KYC 3", needsReview: "Para revisar",
    bannerTitle: "Aguardando revisão", bannerHint: "Abra o arquivo abaixo, confira e aprove o nível ou rejeite o envio.",
    openConcierge: "Abrir pedido ao concierge",
  },
};

export function reviewCopy(lang: unknown) {
  const key = String(lang ?? "").toUpperCase();
  return REVIEW_COPY[(["EN", "RU", "ES", "PT"].includes(key) ? key : "EN") as Lang4];
}
