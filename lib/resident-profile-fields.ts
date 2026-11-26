/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Поля анкеты резидентки: город, «о себе», гражданство, дата рождения
 *
 * Единые правила для анкеты (клиент) и серверных действий
 * app/actions/resident-profile-fields.ts и app/actions/admin-resident-identity.ts.
 * Файл без серверных импортов.
 *
 * Колонки (без изменений схемы): profiles.location text, profiles.about text,
 * profiles.citizenship text, profiles.birth_date date.
 *
 * Гражданство и дата рождения — идентификационные данные. После
 * отправки документов на KYC резидентка меняет их только через запрос
 * команде клуба (isIdentityLocked).
 * ──────────────────────────────────────────────────────────────────── */

export type ProfileTextField = "location" | "about";
export type IdentityField = "citizenship" | "birth_date";
export const IDENTITY_FIELDS: readonly IdentityField[] = ["citizenship", "birth_date"];

export const LOCATION_MAX = 200;      // как в club_admin_update_profile
export const CITIZENSHIP_MAX = 100;
export const ABOUT_MAX = 4000;
export const BIRTH_YEAR_MIN = 1900;

type Normalized<T> = { ok: true; value: T | null } | { ok: false };

// Управляющие символы, кроме переноса строки и табуляции
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Город: одна строка, пробелы схлопываются, пусто = очистить. */
export function normalizeLocation(value: unknown): Normalized<string> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string" || CONTROL.test(value)) return { ok: false };
  const v = value.replace(/\s+/g, " ").trim();
  if (!v) return { ok: true, value: null };
  if (v.length > LOCATION_MAX || /[<>]/.test(v)) return { ok: false };
  return { ok: true, value: v };
}

/** «О себе»: многострочный текст до 4000 символов, переносы сохраняются. */
export function normalizeAbout(value: unknown): Normalized<string> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string" || CONTROL.test(value)) return { ok: false };
  const v = value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!v) return { ok: true, value: null };
  if (v.length > ABOUT_MAX) return { ok: false };
  return { ok: true, value: v };
}

/** Гражданство: буквы любого алфавита, пробел, дефис, точка, запятая, скобки, слэш. */
export function normalizeCitizenship(value: unknown): Normalized<string> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string" || CONTROL.test(value)) return { ok: false };
  const v = value.replace(/\s+/g, " ").trim();
  if (!v) return { ok: true, value: null };
  if (v.length > CITIZENSHIP_MAX || !/^[\p{L}\p{M}][\p{L}\p{M} .,'’()\/-]*$/u.test(v)) return { ok: false };
  return { ok: true, value: v };
}

/** Дата рождения: YYYY-MM-DD, реальная дата, не раньше 1900 и не в будущем. */
export function normalizeBirthDate(value: unknown, today: Date = new Date()): Normalized<string> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const v = value.trim();
  if (!v) return { ok: true, value: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return { ok: false };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return { ok: false };
  if (y < BIRTH_YEAR_MIN) return { ok: false };
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (date.getTime() > todayUtc) return { ok: false };
  return { ok: true, value: v };
}

/** Дата из БД ("2000-05-01" или timestamp) → "2000-05-01" */
export function formatBirthDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

/**
 * Идентификационные данные «под KYC» (резидентка сама не меняет), если
 * kyc_level ≥ 1 или есть заявка KYC в статусе pending или approved —
 * то есть с момента отправки документов на проверку. Только отклонённые
 * заявки блокировку не включают. Источник истины — функция БД
 * public.voyage_identity_locked (миграция 20261128090000); здесь — та же
 * логика для подсказок в интерфейсе.
 */
export function isIdentityLocked(kycLevel: unknown, lockingSubmissions = 0): boolean {
  const level = Number(kycLevel ?? 0);
  return (Number.isFinite(level) && level >= 1) || lockingSubmissions > 0;
}

/** Комментарий резидентки к запросу: без управляющих символов, до 1000 знаков. */
export function sanitizeRequestComment(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1000);
}

/** Заголовок заявки консьержу. По нему же ищется уже открытая заявка. */
export const IDENTITY_REQUEST_PREFIX = "[Данные KYC]";
export const IDENTITY_REQUEST_TITLE = `${IDENTITY_REQUEST_PREFIX} Изменение гражданства / даты рождения`;
export const isIdentityRequestTitle = (title: unknown) =>
  typeof title === "string" && title.trim().startsWith(IDENTITY_REQUEST_PREFIX);

type Lang4 = "EN" | "RU" | "ES" | "PT";

export const PROFILE_FIELDS_COPY: Record<Lang4, {
  invalid: string; saveError: string; locked: string; lockedHint: string; requestChange: string;
  requestTitle: string; newValue: string; comment: string; commentPh: string; send: string; cancel: string;
  sent: string; alreadyRequested: string; requestError: string; nothingToChange: string;
}> = {
  RU: {
    invalid: `Проверьте значение: город до ${LOCATION_MAX} символов, гражданство буквами, дата рождения не в будущем, «о себе» до ${ABOUT_MAX} символов.`,
    saveError: "Не удалось сохранить. Попробуйте ещё раз.",
    locked: "Данные на верификации",
    lockedHint: "Гражданство и дата рождения сверяются с вашими документами. Изменить их можно через команду клуба.",
    requestChange: "Запросить изменение",
    requestTitle: "Запрос на изменение данных",
    newValue: "Новое значение",
    comment: "Комментарий для команды клуба",
    commentPh: "Например: в анкете ошибка, в паспорте 01.05.2000",
    send: "Отправить запрос",
    cancel: "Отмена",
    sent: "Запрос отправлен. Команда клуба сверит данные с документом и свяжется с вами в разделе «Консьерж».",
    alreadyRequested: "Запрос уже отправлен и ждёт ответа команды клуба (раздел «Консьерж»).",
    requestError: "Не удалось отправить запрос. Попробуйте ещё раз или напишите в «Консьерж».",
    nothingToChange: "Укажите новое значение, отличное от текущего.",
  },
  EN: {
    invalid: `Please check the value: city up to ${LOCATION_MAX} characters, citizenship in letters, date of birth not in the future, "About" up to ${ABOUT_MAX} characters.`,
    saveError: "Could not save. Please try again.",
    locked: "Under verification",
    lockedHint: "Citizenship and date of birth are checked against your documents. The club team can change them for you.",
    requestChange: "Request a change",
    requestTitle: "Change request",
    newValue: "New value",
    comment: "Comment for the club team",
    commentPh: "E.g. typo in the profile, passport says 01.05.2000",
    send: "Send request",
    cancel: "Cancel",
    sent: "Request sent. The club team will check it against your document and reply in Concierge.",
    alreadyRequested: "A request is already open and waiting for the club team (see Concierge).",
    requestError: "Could not send the request. Try again or write to Concierge.",
    nothingToChange: "Enter a new value that differs from the current one.",
  },
  ES: {
    invalid: `Revisa el valor: ciudad hasta ${LOCATION_MAX} caracteres, nacionalidad con letras, fecha de nacimiento no futura, «Sobre mí» hasta ${ABOUT_MAX} caracteres.`,
    saveError: "No se pudo guardar. Inténtalo de nuevo.",
    locked: "En verificación",
    lockedHint: "La nacionalidad y la fecha de nacimiento se cotejan con tus documentos. El equipo del club puede cambiarlas.",
    requestChange: "Solicitar cambio",
    requestTitle: "Solicitud de cambio",
    newValue: "Nuevo valor",
    comment: "Comentario para el equipo del club",
    commentPh: "Ej.: error en el perfil, en el pasaporte 01.05.2000",
    send: "Enviar solicitud",
    cancel: "Cancelar",
    sent: "Solicitud enviada. El equipo del club la cotejará con tu documento y responderá en Concierge.",
    alreadyRequested: "Ya hay una solicitud abierta esperando al equipo del club (Concierge).",
    requestError: "No se pudo enviar la solicitud. Inténtalo de nuevo o escribe a Concierge.",
    nothingToChange: "Indica un valor nuevo distinto del actual.",
  },
  PT: {
    invalid: `Verifique o valor: cidade até ${LOCATION_MAX} caracteres, nacionalidade com letras, data de nascimento não futura, «Sobre mim» até ${ABOUT_MAX} caracteres.`,
    saveError: "Não foi possível salvar. Tente novamente.",
    locked: "Em verificação",
    lockedHint: "A nacionalidade e a data de nascimento são conferidas com os seus documentos. A equipe do clube pode alterá-las.",
    requestChange: "Solicitar alteração",
    requestTitle: "Pedido de alteração",
    newValue: "Novo valor",
    comment: "Comentário para a equipe do clube",
    commentPh: "Ex.: erro no perfil, no passaporte 01.05.2000",
    send: "Enviar pedido",
    cancel: "Cancelar",
    sent: "Pedido enviado. A equipe do clube vai conferir com o documento e responder no Concierge.",
    alreadyRequested: "Já existe um pedido aberto aguardando a equipe do clube (Concierge).",
    requestError: "Não foi possível enviar o pedido. Tente novamente ou escreva ao Concierge.",
    nothingToChange: "Informe um novo valor diferente do atual.",
  },
};
