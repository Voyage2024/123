/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · типы проектов кастинга
 * lib/project-types.ts
 *
 * Один источник правды для partner_castings.project_type и
 * partner_tours.project_type: клиент, сервер и Telegram-бот берут
 * ключи, названия и подсказки отсюда.
 *
 *   tour  — 1–2 недели, поездка с проживанием (~$2,000 – $5,000+)
 *   event — от нескольких часов до 1 дня (~$1,500 – $3,000+)
 *
 * Старые значения shoot / show / campaign миграция
 * 20261024090000_casting_project_types.sql переводит в tour;
 * toProjectKey делает то же для данных, пришедших до миграции.
 * ──────────────────────────────────────────────────────────────────── */

export const PROJECTS = ["tour", "event"] as const;
export type ProjectKey = (typeof PROJECTS)[number];

/** Значения до 2026-10-24 → новый ключ */
export const LEGACY_PROJECTS = { shoot: "tour", show: "tour", campaign: "tour" } as const satisfies Record<string, ProjectKey>;
export type LegacyProjectKey = keyof typeof LEGACY_PROJECTS;

export const isProjectKey = (v: unknown): v is ProjectKey =>
  typeof v === "string" && (PROJECTS as readonly string[]).includes(v);

/** Значение из базы или RPC → ProjectKey; неизвестное — null */
export function toProjectKey(v: unknown): ProjectKey | null {
  if (isProjectKey(v)) return v;
  if (typeof v === "string" && Object.prototype.hasOwnProperty.call(LEGACY_PROJECTS, v)) {
    return LEGACY_PROJECTS[v as LegacyProjectKey];
  }
  return null;
}

export type ProjectLang = "RU" | "EN" | "ES" | "PT";
export type ProjectCopy = { label: string; hint: string };

export const PROJECT_COPY: Record<ProjectLang, Record<ProjectKey, ProjectCopy>> = {
  RU: {
    tour: { label: "Тур", hint: "1–2 недели, поездка с проживанием" },
    event: { label: "Ивент", hint: "1 день / несколько часов" },
  },
  EN: {
    tour: { label: "Tour", hint: "1–2 weeks, trip with accommodation" },
    event: { label: "Event", hint: "1 day / a few hours" },
  },
  ES: {
    tour: { label: "Tour", hint: "1–2 semanas, viaje con alojamiento" },
    event: { label: "Evento", hint: "1 día / unas pocas horas" },
  },
  PT: {
    tour: { label: "Tour", hint: "1–2 semanas, viagem com alojamento" },
    event: { label: "Evento", hint: "1 dia / algumas horas" },
  },
};

const copyFor = (lang: string): Record<ProjectKey, ProjectCopy> =>
  PROJECT_COPY[(lang in PROJECT_COPY ? lang : "EN") as ProjectLang];

/** Названия типов для словарей экранов: { tour, event } */
export function projectLabels(lang: string, opts: { lower?: boolean } = {}): Record<ProjectKey, string> {
  const c = copyFor(lang);
  const cut = (s: string) => (opts.lower ? s.toLocaleLowerCase(lang.toLowerCase()) : s);
  return { tour: cut(c.tour.label), event: cut(c.event.label) };
}

export function projectHint(key: ProjectKey, lang: string): string {
  return copyFor(lang)[key].hint;
}

/** Подпись для сырого значения из базы: старые ключи переводятся, неизвестное показывается как есть */
export function projectLabel(raw: unknown, lang: string, opts: { lower?: boolean } = {}): string {
  const key = toProjectKey(raw);
  if (key) return projectLabels(lang, opts)[key];
  return typeof raw === "string" && raw ? raw.replaceAll("_", " ") : "—";
}
