/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог туров — тексты блоков менеджеров, заметки, истории
 * app/(dashboard)/partner/castings/tours/_components/tourManagersCopy.ts
 *
 * RU / EN / ES / PT. Без серверных импортов.
 * ──────────────────────────────────────────────────────────────────── */

import type { Lang } from "@/app/context/LanguageContext";
import type { ManagersFailure } from "@/app/actions/tour-catalog-managers";

export type TourManagersCopy = {
  managersTitle: string;
  managersHint: string;
  managersNewHint: string;
  search: string;
  searchEmpty: string;
  systemBadge: string;
  add: string;
  added: string;
  pending: string;
  noManagers: string;
  active: string;
  revoked: string;
  backfill: string;
  inactiveAccount: string;
  assignedOn: (date: string, by: string | null) => string;
  revokedOn: (date: string, by: string | null) => string;
  revoke: string;
  revokeConfirm: string;
  revokeReason: string;
  transferTo: string;
  transferNone: string;
  revokeDone: (moved: number, kept: number) => string;
  showHistory: (n: number) => string;
  hideHistory: string;
  noteTitle: string;
  notePrivate: string;
  noteHint: string;
  notePlaceholder: string;
  noteSaved: (date: string) => string;
  historyTitle: string;
  historyEmpty: string;
  historyLoad: string;
  actions: Record<string, string>;
  roles: Record<string, string>;
  fields: Record<string, string>;
  empty: string;
  cascade: string;
  myTitle: string;
  mySubtitle: string;
  myEmpty: string;
  coManagers: string;
  castings: string;
  noCastings: string;
  mine: string;
  updated: (date: string) => string;
  editTerms: string;
  createCasting: string;
  open: string;
  statuses: Record<string, string>;
  managerLockedHint: string;
  errors: Record<ManagersFailure, string>;
};

const RU: TourManagersCopy = {
  managersTitle: "Ответственные менеджеры",
  managersHint: "Назначенные менеджеры видят тур в «Мои направления», правят его условия и создают кастинги. Отзыв не удаляет тур, кастинги и поездки.",
  managersNewHint: "Выбранные менеджеры будут назначены сразу после сохранения тура. Добавить и отозвать можно и позже.",
  search: "Поиск: имя, агентство, Telegram, e-mail",
  searchEmpty: "Никого не нашли среди действующих менеджеров.",
  systemBadge: "Организация",
  add: "Назначить",
  added: "Назначен",
  pending: "Будет назначен",
  noManagers: "Пока никто не назначен — тур ведёт только владелец.",
  active: "Активно",
  revoked: "Отозвано",
  backfill: "авто по кастингам",
  inactiveAccount: "аккаунт неактивен",
  assignedOn: (d, by) => `с ${d}${by ? ` · назначил ${by}` : ""}`,
  revokedOn: (d, by) => `отозвано ${d}${by ? ` · ${by}` : ""}`,
  revoke: "Отозвать",
  revokeConfirm: "Подтвердить отзыв",
  revokeReason: "Причина (видна только владельцу)",
  transferTo: "Открытые кастинги без поездки передать",
  transferNone: "Не передавать — останутся у менеджера (только свернуть)",
  revokeDone: (moved, kept) => `Назначение отозвано. Передано кастингов: ${moved}. Осталось у менеджера: ${kept}.`,
  showHistory: (n) => `История назначений (${n})`,
  hideHistory: "Скрыть историю",
  noteTitle: "Внутренняя заметка владельца",
  notePrivate: "Приватно · Только владелец",
  noteHint: "Контакты и договорённости: имя менеджера, Telegram, WhatsApp, агентство, кто предложил направление. Admin, менеджеры и резидентки эту заметку не видят — ограничение стоит в базе.",
  notePlaceholder: "Например: Анна, агентство Gulf Talents, TG @anna_gt, WA +971…, предложила направление в сентябре; комиссия по договорённости…",
  noteSaved: (d) => `сохранено ${d}`,
  historyTitle: "История изменений",
  historyEmpty: "Изменений пока нет.",
  historyLoad: "Показать историю",
  actions: {
    "tour_catalog.create": "Тур создан",
    "tour_catalog.update": "Изменены условия",
    "tour_catalog.delete": "Тур удалён",
    "tour_catalog.manager_assign": "Назначен менеджер",
    "tour_catalog.manager_revoke": "Назначение отозвано",
    "tour_catalog.manager_backfill": "Автоназначение по кастингам",
    "tour_catalog.casting_transfer": "Кастинг передан",
    "tour_catalog.owner_note": "Изменена заметка владельца",
  },
  roles: { owner: "owner", admin: "admin", manager: "менеджер", system: "система", service: "сервер" },
  fields: {
    title_i18n: "Название", description_i18n: "Описание", requirements_i18n: "Требования", conditions_i18n: "Базовые условия",
    project_type: "Тип", audience_segment: "Аудитория", source_lang: "Язык автора", fee_amount: "Гонорар", fee_currency: "Валюта",
    height_min: "Мин. рост", flight_paid_by: "Перелёт", hotel_paid_by: "Отель", languages: "Языки", is_active: "Активность",
    sort_order: "Порядок", map_hub_id: "Локация", slug: "Адрес", city: "Город", country_code: "Страна", region: "Регион",
    cover_url: "Обложка", destination_id: "Направление Passport",
  },
  empty: "пусто",
  cascade: "автоматически",
  myTitle: "Мои направления",
  mySubtitle: "Туры каталога, за которые вы отвечаете. Вы правите их базовые условия и создаёте кастинги, когда нужны модели. Изменения условий кастинга не меняют тур.",
  myEmpty: "Вам пока не назначено ни одного направления. Назначение выдаёт владелец VOYAGE.",
  coManagers: "Ответственные",
  castings: "Кастинги по туру",
  noCastings: "Кастингов ещё нет.",
  mine: "ваш",
  updated: (d) => `изменён ${d}`,
  editTerms: "Править условия",
  createCasting: "Создать кастинг",
  open: "Открыть",
  statuses: { open: "Открыт", shortlist: "Шорт-лист", closed: "Закрыт", cancelled: "Отменён", archived: "Архив" },
  managerLockedHint: "Локацию, адрес и порядок тура меняет только владелец.",
  errors: {
    forbidden: "Это действие доступно только владельцу.",
    invalid: "Проверьте данные.",
    not_found: "Не найдено — возможно, уже изменено.",
    not_eligible: "Этот аккаунт нельзя назначить: нужен действующий менеджер (одобрен, без блокировки).",
    already_assigned: "Этот менеджер уже назначен на тур.",
    not_active: "Назначение уже отозвано.",
    not_assigned: "Передать можно только VOYAGE Management или менеджеру, назначенному на этот тур.",
    has_tour: "По кастингу уже создана поездка — он остаётся у прежнего менеджера.",
    schema: "В базе нет назначений менеджеров. Примените миграцию 20261125090000_tour_catalog_managers.sql.",
    failed: "Не получилось. Попробуйте ещё раз.",
  },
};

const EN: TourManagersCopy = {
  managersTitle: "Responsible managers",
  managersHint: "Assigned managers see the tour in “My destinations”, edit its terms and create castings. Revoking never deletes the tour, castings or trips.",
  managersNewHint: "Selected managers are assigned right after the tour is saved. You can add or revoke later too.",
  search: "Search: name, agency, Telegram, e-mail",
  searchEmpty: "No active managers found.",
  systemBadge: "Organization",
  add: "Assign",
  added: "Assigned",
  pending: "Will be assigned",
  noManagers: "Nobody is assigned yet — only the owner runs this tour.",
  active: "Active",
  revoked: "Revoked",
  backfill: "auto from castings",
  inactiveAccount: "account inactive",
  assignedOn: (d, by) => `since ${d}${by ? ` · by ${by}` : ""}`,
  revokedOn: (d, by) => `revoked ${d}${by ? ` · ${by}` : ""}`,
  revoke: "Revoke",
  revokeConfirm: "Confirm revoke",
  revokeReason: "Reason (owner only)",
  transferTo: "Hand over open castings without a trip to",
  transferNone: "Don’t hand over — they stay with the manager (wind-down only)",
  revokeDone: (moved, kept) => `Assignment revoked. Castings handed over: ${moved}. Left with the manager: ${kept}.`,
  showHistory: (n) => `Assignment history (${n})`,
  hideHistory: "Hide history",
  noteTitle: "Owner’s internal note",
  notePrivate: "Private · Owner only",
  noteHint: "Contacts and arrangements: manager name, Telegram, WhatsApp, agency, who proposed the destination. Admins, managers and residents can’t see this note — the database enforces it.",
  notePlaceholder: "E.g.: Anna, Gulf Talents agency, TG @anna_gt, WA +971…, proposed the destination in September; commission as agreed…",
  noteSaved: (d) => `saved ${d}`,
  historyTitle: "Change history",
  historyEmpty: "No changes yet.",
  historyLoad: "Show history",
  actions: {
    "tour_catalog.create": "Tour created",
    "tour_catalog.update": "Terms changed",
    "tour_catalog.delete": "Tour deleted",
    "tour_catalog.manager_assign": "Manager assigned",
    "tour_catalog.manager_revoke": "Assignment revoked",
    "tour_catalog.manager_backfill": "Auto-assignment from castings",
    "tour_catalog.casting_transfer": "Casting handed over",
    "tour_catalog.owner_note": "Owner’s note changed",
  },
  roles: { owner: "owner", admin: "admin", manager: "manager", system: "system", service: "server" },
  fields: {
    title_i18n: "Name", description_i18n: "Description", requirements_i18n: "Requirements", conditions_i18n: "Base terms",
    project_type: "Type", audience_segment: "Audience", source_lang: "Author language", fee_amount: "Fee", fee_currency: "Currency",
    height_min: "Min. height", flight_paid_by: "Flight", hotel_paid_by: "Hotel", languages: "Languages", is_active: "Active",
    sort_order: "Order", map_hub_id: "Location", slug: "Slug", city: "City", country_code: "Country", region: "Region",
    cover_url: "Cover", destination_id: "Passport destination",
  },
  empty: "empty",
  cascade: "automatic",
  myTitle: "My destinations",
  mySubtitle: "Catalog tours you are responsible for. You edit their base terms and create castings whenever you need models. Changing a casting never changes the tour.",
  myEmpty: "No destinations are assigned to you yet. The VOYAGE owner assigns them.",
  coManagers: "Responsible",
  castings: "Castings for this tour",
  noCastings: "No castings yet.",
  mine: "yours",
  updated: (d) => `updated ${d}`,
  editTerms: "Edit terms",
  createCasting: "Create casting",
  open: "Open",
  statuses: { open: "Open", shortlist: "Shortlist", closed: "Closed", cancelled: "Cancelled", archived: "Archive" },
  managerLockedHint: "Only the owner changes the tour’s location, slug and order.",
  errors: {
    forbidden: "Only the owner can do this.",
    invalid: "Check the data.",
    not_found: "Not found — it may have changed already.",
    not_eligible: "This account can’t be assigned: an active manager is required (approved, not blocked).",
    already_assigned: "This manager is already assigned to the tour.",
    not_active: "The assignment is already revoked.",
    not_assigned: "You can hand over only to VOYAGE Management or a manager assigned to this tour.",
    has_tour: "A trip already exists for this casting — it stays with the previous manager.",
    schema: "The database has no manager assignments. Apply migration 20261125090000_tour_catalog_managers.sql.",
    failed: "Something went wrong. Try again.",
  },
};

const ES: TourManagersCopy = {
  ...EN,
  managersTitle: "Managers responsables",
  managersHint: "Los managers asignados ven el tour en «Mis destinos», editan sus condiciones y crean castings. Revocar nunca borra el tour, los castings ni los viajes.",
  managersNewHint: "Los managers elegidos se asignan justo después de guardar el tour. También puedes añadir o revocar más tarde.",
  search: "Buscar: nombre, agencia, Telegram, e-mail",
  searchEmpty: "No hay managers activos con ese dato.",
  systemBadge: "Organización",
  add: "Asignar",
  added: "Asignado",
  pending: "Se asignará",
  noManagers: "Aún no hay nadie asignado: solo el owner lleva este tour.",
  active: "Activa",
  revoked: "Revocada",
  backfill: "auto por castings",
  inactiveAccount: "cuenta inactiva",
  assignedOn: (d, by) => `desde ${d}${by ? ` · por ${by}` : ""}`,
  revokedOn: (d, by) => `revocada ${d}${by ? ` · ${by}` : ""}`,
  revoke: "Revocar",
  revokeConfirm: "Confirmar",
  revokeReason: "Motivo (solo el owner)",
  transferTo: "Pasar castings abiertos sin viaje a",
  transferNone: "No pasar: quedan con el manager (solo cerrar)",
  revokeDone: (moved, kept) => `Asignación revocada. Castings transferidos: ${moved}. Quedan con el manager: ${kept}.`,
  showHistory: (n) => `Historial de asignaciones (${n})`,
  hideHistory: "Ocultar historial",
  noteTitle: "Nota interna del owner",
  notePrivate: "Privado · Solo el owner",
  noteHint: "Contactos y acuerdos: nombre del manager, Telegram, WhatsApp, agencia, quién propuso el destino. Admins, managers y residentes no ven esta nota: lo garantiza la base de datos.",
  notePlaceholder: "Ej.: Anna, agencia Gulf Talents, TG @anna_gt, WA +971…, propuso el destino en septiembre; comisión según acuerdo…",
  noteSaved: (d) => `guardado ${d}`,
  historyTitle: "Historial de cambios",
  historyEmpty: "Aún no hay cambios.",
  historyLoad: "Ver historial",
  actions: {
    "tour_catalog.create": "Tour creado",
    "tour_catalog.update": "Condiciones cambiadas",
    "tour_catalog.delete": "Tour eliminado",
    "tour_catalog.manager_assign": "Manager asignado",
    "tour_catalog.manager_revoke": "Asignación revocada",
    "tour_catalog.manager_backfill": "Asignación automática por castings",
    "tour_catalog.casting_transfer": "Casting transferido",
    "tour_catalog.owner_note": "Nota del owner cambiada",
  },
  roles: { owner: "owner", admin: "admin", manager: "manager", system: "sistema", service: "servidor" },
  fields: {
    ...EN.fields,
    title_i18n: "Nombre", description_i18n: "Descripción", requirements_i18n: "Requisitos", conditions_i18n: "Condiciones base",
    project_type: "Tipo", audience_segment: "Audiencia", source_lang: "Idioma del autor", fee_amount: "Honorario", fee_currency: "Moneda",
    height_min: "Altura mín.", flight_paid_by: "Vuelo", hotel_paid_by: "Hotel", languages: "Idiomas", is_active: "Activo",
    sort_order: "Orden", map_hub_id: "Ubicación", city: "Ciudad", country_code: "País", region: "Región",
  },
  empty: "vacío",
  cascade: "automático",
  myTitle: "Mis destinos",
  mySubtitle: "Tours del catálogo de los que eres responsable. Editas sus condiciones base y creas castings cuando necesitas modelos. Cambiar un casting no cambia el tour.",
  myEmpty: "Aún no tienes destinos asignados. Los asigna el owner de VOYAGE.",
  coManagers: "Responsables",
  castings: "Castings del tour",
  noCastings: "Aún no hay castings.",
  mine: "tuyo",
  updated: (d) => `cambiado ${d}`,
  editTerms: "Editar condiciones",
  createCasting: "Crear casting",
  open: "Abrir",
  statuses: { open: "Abierto", shortlist: "Shortlist", closed: "Cerrado", cancelled: "Cancelado", archived: "Archivo" },
  managerLockedHint: "Solo el owner cambia la ubicación, la dirección y el orden del tour.",
  errors: {
    forbidden: "Solo el owner puede hacerlo.",
    invalid: "Revisa los datos.",
    not_found: "No encontrado: quizá ya cambió.",
    not_eligible: "No se puede asignar esta cuenta: hace falta un manager activo (aprobado, sin bloqueo).",
    already_assigned: "Este manager ya está asignado al tour.",
    not_active: "La asignación ya está revocada.",
    not_assigned: "Solo se puede transferir a VOYAGE Management o a un manager asignado a este tour.",
    has_tour: "Este casting ya tiene un viaje: queda con el manager anterior.",
    schema: "La base no tiene asignaciones de managers. Aplica la migración 20261125090000_tour_catalog_managers.sql.",
    failed: "No se pudo. Inténtalo de nuevo.",
  },
};

const PT: TourManagersCopy = {
  ...EN,
  managersTitle: "Managers responsáveis",
  managersHint: "Managers atribuídos veem o tour em «Meus destinos», editam as condições e criam castings. Revogar nunca apaga o tour, os castings ou as viagens.",
  managersNewHint: "Os managers escolhidos são atribuídos logo após salvar o tour. Dá para adicionar ou revogar depois também.",
  search: "Buscar: nome, agência, Telegram, e-mail",
  searchEmpty: "Nenhum manager ativo encontrado.",
  systemBadge: "Organização",
  add: "Atribuir",
  added: "Atribuído",
  pending: "Será atribuído",
  noManagers: "Ninguém atribuído ainda — só o owner conduz este tour.",
  active: "Ativa",
  revoked: "Revogada",
  backfill: "auto pelos castings",
  inactiveAccount: "conta inativa",
  assignedOn: (d, by) => `desde ${d}${by ? ` · por ${by}` : ""}`,
  revokedOn: (d, by) => `revogada ${d}${by ? ` · ${by}` : ""}`,
  revoke: "Revogar",
  revokeConfirm: "Confirmar",
  revokeReason: "Motivo (só o owner)",
  transferTo: "Passar castings abertos sem viagem para",
  transferNone: "Não passar — ficam com o manager (só encerrar)",
  revokeDone: (moved, kept) => `Atribuição revogada. Castings transferidos: ${moved}. Ficaram com o manager: ${kept}.`,
  showHistory: (n) => `Histórico de atribuições (${n})`,
  hideHistory: "Ocultar histórico",
  noteTitle: "Nota interna do owner",
  notePrivate: "Privado · Só o owner",
  noteHint: "Contatos e acordos: nome do manager, Telegram, WhatsApp, agência, quem propôs o destino. Admins, managers e residentes não veem esta nota — o banco de dados garante isso.",
  notePlaceholder: "Ex.: Anna, agência Gulf Talents, TG @anna_gt, WA +971…, propôs o destino em setembro; comissão conforme acordo…",
  noteSaved: (d) => `salvo ${d}`,
  historyTitle: "Histórico de alterações",
  historyEmpty: "Ainda sem alterações.",
  historyLoad: "Ver histórico",
  actions: {
    "tour_catalog.create": "Tour criado",
    "tour_catalog.update": "Condições alteradas",
    "tour_catalog.delete": "Tour excluído",
    "tour_catalog.manager_assign": "Manager atribuído",
    "tour_catalog.manager_revoke": "Atribuição revogada",
    "tour_catalog.manager_backfill": "Atribuição automática pelos castings",
    "tour_catalog.casting_transfer": "Casting transferido",
    "tour_catalog.owner_note": "Nota do owner alterada",
  },
  roles: { owner: "owner", admin: "admin", manager: "manager", system: "sistema", service: "servidor" },
  fields: {
    ...EN.fields,
    title_i18n: "Nome", description_i18n: "Descrição", requirements_i18n: "Requisitos", conditions_i18n: "Condições base",
    project_type: "Tipo", audience_segment: "Público", source_lang: "Idioma do autor", fee_amount: "Cachê", fee_currency: "Moeda",
    height_min: "Altura mín.", flight_paid_by: "Passagem", hotel_paid_by: "Hotel", languages: "Idiomas", is_active: "Ativo",
    sort_order: "Ordem", map_hub_id: "Local", city: "Cidade", country_code: "País", region: "Região",
  },
  empty: "vazio",
  cascade: "automático",
  myTitle: "Meus destinos",
  mySubtitle: "Tours do catálogo pelos quais você responde. Você edita as condições base e cria castings quando precisa de modelos. Mudar um casting não muda o tour.",
  myEmpty: "Ainda não há destinos atribuídos a você. Quem atribui é o owner da VOYAGE.",
  coManagers: "Responsáveis",
  castings: "Castings do tour",
  noCastings: "Ainda não há castings.",
  mine: "seu",
  updated: (d) => `alterado ${d}`,
  editTerms: "Editar condições",
  createCasting: "Criar casting",
  open: "Abrir",
  statuses: { open: "Aberto", shortlist: "Shortlist", closed: "Fechado", cancelled: "Cancelado", archived: "Arquivo" },
  managerLockedHint: "Só o owner muda o local, o endereço e a ordem do tour.",
  errors: {
    forbidden: "Só o owner pode fazer isso.",
    invalid: "Confira os dados.",
    not_found: "Não encontrado — talvez já tenha mudado.",
    not_eligible: "Esta conta não pode ser atribuída: é preciso um manager ativo (aprovado, sem bloqueio).",
    already_assigned: "Este manager já está atribuído ao tour.",
    not_active: "A atribuição já foi revogada.",
    not_assigned: "Só dá para transferir para a VOYAGE Management ou para um manager atribuído a este tour.",
    has_tour: "Este casting já tem viagem — fica com o manager anterior.",
    schema: "O banco não tem atribuições de managers. Aplique a migração 20261125090000_tour_catalog_managers.sql.",
    failed: "Não deu certo. Tente de novo.",
  },
};

export const TOUR_MANAGERS_COPY: Record<Lang, TourManagersCopy> = { RU, EN, ES, PT };

/** Дата в языке интерфейса: 25 нояб. 2026 */
export function formatDay(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const locale = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-BR" }[lang] ?? "en-GB";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const locale = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-BR" }[lang] ?? "en-GB";
  return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
