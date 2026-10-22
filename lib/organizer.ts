/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · организатор тура / ивента
 *
 * Системный профиль «VOYAGE Management» заводит миграция
 * 20261022090000_voyage_management_organizer.sql с фиксированным id.
 * Туры и ивенты owner/admin по умолчанию публикуются от его имени.
 * ──────────────────────────────────────────────────────────────────── */

export const VOYAGE_MANAGEMENT_ID = "00000000-0000-4000-8000-000000c1ab00";
export const VOYAGE_MANAGEMENT_NAME = "VOYAGE Management";

export type OrganizerBadge = "official_club" | "verified" | null;

export type Publisher = {
  id: string;
  name: string;
  role: string;
  badge: OrganizerBadge;
  isSystem: boolean;
};

export type OrganizerLang = "en" | "ru" | "es" | "pt";

export function organizerLang(value: string | null | undefined): OrganizerLang {
  const v = (value ?? "").toLowerCase();
  return v === "en" || v === "es" || v === "pt" ? v : "ru";
}

export const ORGANIZER_TEXT: Record<OrganizerLang, {
  label: string;
  hint: string;
  official: string;
  verified: string;
  partner: string;
  loading: string;
  loadError: string;
  publishedBy: string;
}> = {
  ru: {
    label: "Опубликовать от имени",
    hint: "По умолчанию — от клуба. Партнёр увидит запись в своём кабинете и будет вести отклики.",
    official: "Official Club",
    verified: "Verified",
    partner: "Партнёр",
    loading: "Загружаем организаторов…",
    loadError: "Не удалось загрузить список партнёров — запись уйдёт от имени клуба.",
    publishedBy: "Организатор",
  },
  en: {
    label: "Publish on behalf of",
    hint: "Defaults to the club. A partner will see the entry in their workspace and handle responses.",
    official: "Official Club",
    verified: "Verified",
    partner: "Partner",
    loading: "Loading organizers…",
    loadError: "Could not load partners — the entry will be published by the club.",
    publishedBy: "Organizer",
  },
  es: {
    label: "Publicar en nombre de",
    hint: "Por defecto, el club. El socio verá la entrada en su panel y gestionará las respuestas.",
    official: "Official Club",
    verified: "Verified",
    partner: "Socio",
    loading: "Cargando organizadores…",
    loadError: "No se pudo cargar la lista de socios: se publicará en nombre del club.",
    publishedBy: "Organizador",
  },
  pt: {
    label: "Publicar em nome de",
    hint: "Por padrão, o clube. O parceiro verá o registro no painel e cuidará das respostas.",
    official: "Official Club",
    verified: "Verified",
    partner: "Parceiro",
    loading: "Carregando organizadores…",
    loadError: "Não foi possível carregar os parceiros — o registro será publicado pelo clube.",
    publishedBy: "Organizador",
  },
};

export function parsePublishers(rows: unknown): Publisher[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") return [];
    const badge = r.badge === "official_club" || r.badge === "verified" ? r.badge : null;
    return [{
      id: r.id,
      name: typeof r.display_name === "string" && r.display_name.trim() ? r.display_name : VOYAGE_MANAGEMENT_NAME,
      role: typeof r.role === "string" ? r.role : "manager",
      badge,
      isSystem: r.is_system === true,
    }];
  });
}
