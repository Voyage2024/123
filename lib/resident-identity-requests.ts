/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Запросы резиденток на изменение гражданства / даты рождения
 *
 * Чистые функции без серверных импортов (тесты, карточка, Server Actions):
 *  - parseIdentityRequestBody — разбирает сообщение резидентки, которое
 *    создаёт requestResidentIdentityChange (resident-profile-fields v2):
 *        Гражданство: <было> → <стало>
 *        Дата рождения: <было> → <стало>
 *        (пустая строка)
 *        Комментарий: <текст | —>
 *    «—» означает пустое значение. Значения после «→» проверяются теми же
 *    правилами, что и при сохранении; неразборчивый текст → null.
 *  - planIdentityApproval — актуален ли запрос относительно текущих данных
 *    профиля и какие поля нужно применить.
 *  - тексты уведомлений резидентке (RU/EN/ES/PT) — без самих значений.
 * ──────────────────────────────────────────────────────────────────── */

import {
  formatBirthDate,
  normalizeBirthDate,
  normalizeCitizenship,
  type IdentityField,
} from "@/lib/resident-profile-fields";

export type IdentityChange = { from: string | null; to: string | null };
export type IdentityProposal = {
  citizenship?: IdentityChange;
  birth_date?: IdentityChange;
  comment: string | null;
};

const EMPTY = "—";
const LINE: Record<IdentityField, RegExp> = {
  citizenship: /^Гражданство: (.*) → (.*)$/,
  birth_date: /^Дата рождения: (.*) → (.*)$/,
};

const valueOf = (raw: string) => {
  const v = raw.trim();
  return v === EMPTY || v === "" ? null : v;
};

export function parseIdentityRequestBody(body: unknown): IdentityProposal | null {
  if (typeof body !== "string" || body.length > 4000) return null;
  const text = body.replace(/\r\n?/g, "\n");
  const blank = text.indexOf("\n\n");
  const head = (blank >= 0 ? text.slice(0, blank) : text).split("\n");
  const tail = blank >= 0 ? text.slice(blank + 2) : "";

  const proposal: IdentityProposal = { comment: null };
  for (const line of head) {
    let matched = false;
    for (const field of ["citizenship", "birth_date"] as const) {
      const m = LINE[field].exec(line);
      if (!m) continue;
      if (proposal[field]) return null; // одно поле дважды — не наш формат
      const from = valueOf(m[1]);
      const toRaw = valueOf(m[2]);
      const norm = field === "citizenship" ? normalizeCitizenship(toRaw) : normalizeBirthDate(toRaw);
      if (!norm.ok) return null;
      proposal[field] = { from: field === "birth_date" ? formatBirthDate(from) ?? from : from, to: norm.value };
      matched = true;
    }
    if (!matched) return null;
  }
  if (!proposal.citizenship && !proposal.birth_date) return null;
  const c = /^Комментарий: ([\s\S]*)$/.exec(tail.trim());
  proposal.comment = c ? valueOf(c[1]) : null;
  return proposal;
}

export type IdentityPlan =
  | { kind: "apply"; patch: { citizenship?: string | null; birth_date?: string | null } }
  | { kind: "already_applied" }
  | { kind: "stale"; fields: IdentityField[] };

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a?.trim() || null) === (b?.trim() || null);

/**
 * Для каждого поля запроса: текущее = «стало» → уже применено; текущее =
 * «было» → применить; иначе данные изменились после подачи → запрос
 * неактуален (stale), ничего не меняем.
 */
export function planIdentityApproval(
  proposal: IdentityProposal,
  current: { citizenship: string | null; birth_date: string | null },
): IdentityPlan {
  const patch: { citizenship?: string | null; birth_date?: string | null } = {};
  const stale: IdentityField[] = [];
  for (const field of ["citizenship", "birth_date"] as const) {
    const change = proposal[field];
    if (!change) continue;
    const cur = field === "birth_date" ? formatBirthDate(current.birth_date) : current.citizenship;
    if (same(cur, change.to)) continue;
    if (same(cur, change.from)) patch[field] = change.to;
    else stale.push(field);
  }
  if (stale.length) return { kind: "stale", fields: stale };
  if (Object.keys(patch).length === 0) return { kind: "already_applied" };
  return { kind: "apply", patch };
}

export const IDENTITY_FIELD_LABEL_RU: Record<IdentityField, string> = {
  citizenship: "Гражданство",
  birth_date: "Дата рождения",
};

type Lang4 = "EN" | "RU" | "ES" | "PT";
const FIELD_NAMES: Record<Lang4, Record<IdentityField, string>> = {
  RU: { citizenship: "гражданство", birth_date: "дата рождения" },
  EN: { citizenship: "citizenship", birth_date: "date of birth" },
  ES: { citizenship: "nacionalidad", birth_date: "fecha de nacimiento" },
  PT: { citizenship: "nacionalidade", birth_date: "data de nascimento" },
};

export const asLang4 = (value: unknown): Lang4 =>
  value === "EN" || value === "ES" || value === "PT" ? value : "RU";

/** Уведомление резидентке об одобрении. Значений в тексте нет — только какие поля. */
export function approvedNotice(lang: Lang4, fields: IdentityField[]): string {
  const names = fields.map((f) => FIELD_NAMES[lang][f]).join(", ");
  return {
    RU: `Ваш запрос одобрен. Обновлено в профиле: ${names}. Новые данные видны в личном кабинете.`,
    EN: `Your request has been approved. Updated in your profile: ${names}. You can see the new details in your dashboard.`,
    ES: `Tu solicitud ha sido aprobada. Actualizado en tu perfil: ${names}. Puedes ver los nuevos datos en tu panel.`,
    PT: `Sua solicitação foi aprovada. Atualizado no seu perfil: ${names}. Os novos dados estão no seu painel.`,
  }[lang];
}

/** Запрос закрыт без изменения профиля: owner/admin уже исправил данные вручную. Без самих значений. */
export function completedNotice(lang: Lang4, fields: IdentityField[]): string {
  const names = fields.map((f) => FIELD_NAMES[lang][f]).join(", ");
  return {
    RU: `Ваш запрос обработан. Данные в профиле уже исправлены командой клуба: ${names}. Актуальные данные видны в личном кабинете.`,
    EN: `Your request has been processed. The club team has already corrected your profile: ${names}. You can see the current details in your dashboard.`,
    ES: `Tu solicitud ha sido procesada. El equipo del club ya corrigió tu perfil: ${names}. Puedes ver los datos actuales en tu panel.`,
    PT: `Sua solicitação foi processada. A equipe do clube já corrigiu seu perfil: ${names}. Os dados atuais estão no seu painel.`,
  }[lang];
}

/** Уведомление резидентке об отказе — с причиной, которую указал owner/admin. */
export function rejectedNotice(lang: Lang4, reason: string): string {
  return {
    RU: `Ваш запрос на изменение данных отклонён. Профиль не изменён.\nПричина: ${reason}`,
    EN: `Your request to change your details was declined. Your profile has not been changed.\nReason: ${reason}`,
    ES: `Tu solicitud de cambio de datos fue rechazada. Tu perfil no ha cambiado.\nMotivo: ${reason}`,
    PT: `Sua solicitação de alteração de dados foi recusada. Seu perfil não foi alterado.\nMotivo: ${reason}`,
  }[lang];
}

/** Статус заявки консьержу → подпись в карточке. impossible = «Отклонён». */
export const IDENTITY_REQUEST_STATUS_RU: Record<string, string> = {
  open: "Новый",
  in_progress: "В работе",
  done: "Выполнен",
  impossible: "Отклонён",
};

/** Причина для журнала: ссылка на запрос + слова owner/admin (≤ 500 символов, как требует БД). */
export const REQUEST_REASON_TAG = (requestId: string) => `[запрос ${requestId}]`;
export function auditReasonForRequest(requestId: string, reason: string): string {
  return `${REQUEST_REASON_TAG(requestId)} Одобрен запрос резидентки: ${reason}`.slice(0, 500);
}
