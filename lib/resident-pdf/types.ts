/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Данные для PDF карточки резидентки (/admin/database/[id])
 *
 * Два уровня:
 *  - PresentationPdfData — буклет для клиента (owner + admin).
 *    Сервер физически не кладёт сюда контакты, email, телефон, Telegram,
 *    паспорт, точную дату рождения и полную фамилию.
 *  - DossierPdfData — полное досье (только owner, каждый вызов в audit_logs).
 *
 * Файл без серверных импортов: типы нужны и server action, и клиенту.
 * ──────────────────────────────────────────────────────────────────── */

export type PdfBadge = {
  /** Voyager … Black Circle */
  circleTitle: string;
  circleLevel: number;
  /** 0…3 */
  kycLevel: number;
  /** KYC 3 — личная верификация, VIP-знак */
  vip: boolean;
  segment: "working" | "elite";
};

export type PresentationPdfData = {
  kind: "presentation";
  generatedAt: string;
  profileId: string;
  /** № участницы клуба, например 0042 */
  memberNo: string;
  /** Имя + инициал фамилии: «Анна К.» */
  displayName: string;
  age: number | null;
  location: string | null;
  citizenship: string | null;
  height: string | null;
  weight: string | null;
  measurements: string | null;
  clothingSize: string | null;
  shoeSize: string | null;
  badge: PdfBadge;
  /** «О себе» с вырезанными контактами (email, телефоны, @ники, ссылки) */
  about: string | null;
  /** Подписанные ссылки (5 минут): первая — обложка */
  photos: string[];
};

export type DossierContact = { label: string; value: string; source: string };

export type DossierKycFile = {
  id: string;
  level: number;
  status: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  fileName: string;
  /** Подписанная ссылка (5 минут) — только для картинок и PDF уровня 1/2, видео не встраиваются */
  url: string | null;
  kind: "image" | "pdf" | "video" | "other";
};

export type DossierKycRequest = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  feedback: string | null;
};

export type DossierPdfData = {
  kind: "dossier";
  generatedAt: string;
  /** id записи в audit_logs — печатается в колонтитуле */
  auditId: string;
  viewer: { email: string | null; profileId: string };
  profileId: string;
  memberNo: string;
  fullName: string;
  identity: { label: string; value: string }[];
  contacts: DossierContact[];
  physical: { label: string; value: string }[];
  club: { label: string; value: string }[];
  badge: PdfBadge;
  about: string | null;
  photos: string[];
  kycFiles: DossierKycFile[];
  kycRequests: DossierKycRequest[];
};

export type PdfActionError =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "not_resident"
  | "audit_failed"
  | "server_error";

export type PdfActionResult<T> = { ok: true; data: T } | { ok: false; reason: PdfActionError };
