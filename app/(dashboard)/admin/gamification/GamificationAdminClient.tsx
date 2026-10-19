"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GAMIFICATION — клиентский интерфейс
 * app/(dashboard)/admin/gamification/GamificationAdminClient.tsx
 *
 * Четыре вкладки:
 *   1. Резиденты   — штампы, индекс, Circle и прогресс до следующего уровня
 *   2. Направления — 52 направления в 4 регионах, цензы и веса
 *   3. Комбо       — 9 легендарных кампаний: маршрут, требование, бонус
 *   4. Circle      — пороги Индекса для уровней 1–6
 *
 * Настройки направлений, комбо и Circle сохраняются автоматически (debounce ~0,7 с)
 * под сессией персонала. Выдача и аннулирование штампов/достижений идут через
 * Server Actions с точной проверкой ролей admin/owner и защищённые PostgreSQL RPC.
 * Индекс и Circle пересчитывает v_global_leaderboard.
 *
 * Каталог, названия, регионы и формула — из lib/gamification.ts, общего
 * со страницей резидента.
 * ──────────────────────────────────────────────────────────────────── */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Anchor,
  Award,
  Check,
  ChevronDown,
  Coins,
  Compass,
  Crown,
  Gem,
  Globe,
  Landmark,
  Loader2,
  MapPin,
  Minus,
  Moon,
  Mountain,
  Plus,
  Search,
  Sparkles,
  Stamp as StampIcon,
  Sun,
  Trash2,
  Trophy,
  Users,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  issueGameStamp,
  revokeGameStamp,
  issueResidentAchievement,
  revokeResidentAchievement,
} from "./actions";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  COMBO_LORE,
  PLACES,
  REGIONS,
  REGION_LABELS,
  TIERS,
  TIER_ORDER,
  comboNeed,
  nextCircle,
  normalizeLang,
  type CircleConfig,
  type CircleKey,
  type ComboConfig,
  type ComboIcon,
  type DestId,
  type DestinationConfig,
  type GameCircleRow,
  type GameComboRow,
  type GameDestinationRow,
  type Lang,
  type Tier,
} from "@/lib/gamification";
import { cormorant } from "@/app/components/profile/fonts";

export { cormorant };

/* ══════════════════════════════════════════════════════════════════
 * i18n
 * ══════════════════════════════════════════════════════════════════ */

const LOCALES: Record<Lang, string> = {
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
  pt: "pt-BR",
};

const en = {
  // страница
  eyebrow: "Voyage · Admin",
  title: "Gamification",
  subtitle:
    "Stamps, destination weights, legendary combos and Circle levels — one Influence Index for the whole club.",
  refresh: "Refresh",
  loading: "Loading residents, destinations and campaigns…",
  loadFailed: "Failed to load data",
  refreshFailed: "Failed to refresh data — showing the last loaded version",
  retry: "Retry",
  networkError: "Network error",
  migrationHint: "It looks like the gamification_v2 migration hasn't been applied in Supabase yet.",
  live: "Live",
  offline: "Offline",
  statResidents: "Residents",
  statStamps: "Stamps",
  statDestinations: "Active destinations",
  statCombos: "Active campaigns",
  // вкладки
  tabResidents: "Residents",
  tabDestinations: "Destinations",
  tabCombos: "Legendary combos",
  tabCircles: "Circle levels",
  // резиденты
  searchPlaceholder: "Search resident…",
  searchAria: "Search resident",
  of: "of",
  all: "All",
  emptyNoResidents: "No residents in the database yet (or RLS does not allow reading them).",
  emptyNotFound: "No residents found.",
  pickDestination: "Choose destination",
  filterDestinations: "Filter…",
  noDestinations: "No active destinations",
  stamp: "Stamp visit",
  customWeight: "Weight",
  customWeightAria: "Custom stamp weight in points (optional)",
  influence: "index",
  level: "Level",
  toNext: (n: string, title: string) => `${n} to ${title}`,
  topLevel: "Highest circle reached",
  visit: (n: number) => `visit #${n}`,
  factorBase: "base",
  errRls: "You don't have permission to stamp visits (RLS).",
  errGeneric: "Failed to stamp the visit.",
  errWeight: "Weight must be a whole number of points.",
  status: {
    pending: "Pending review",
    rejected: "Rejected",
    blocked: "Blocked",
  } as Record<string, string>,
  // направления
  autosaveHint: "Changes save automatically and apply to every resident instantly.",
  searchDestinations: "Search destination…",
  colDestination: "Destination",
  colTier: "Visa tier",
  colPoints: "Points",
  colMultiplier: "Multiplier",
  colValue: "Per stamp",
  colActive: "Active",
  outOfCatalog: "Outside the catalog",
  outOfCatalogHint: "Not in the club catalog: they don't count toward the Influence Index and residents don't see them. Add them to the shared catalog to bring them back.",
  // автосохранение
  saving: "Saving…",
  saved: "Saved",
  unsaved: "Unsaved",
  invalid: "Check the value",
  saveFailed: "Save failed",
  retrySave: "Retry",
  noPermission: "No permission to edit (RLS)",
  // комбо
  composition: "Route",
  addDestination: "Add destination",
  removeDestination: (name: string) => `Remove ${name}`,
  requirement: "Required to collect",
  requirementOf: (n: number, m: number) => `${n} of ${m}`,
  requirementAll: "all",
  requirementLess: "Require fewer",
  requirementMore: "Require more",
  bonus: "Bonus to index",
  campaignActive: "Campaign active",
  campaignTitle: "Campaign title",
  emptyRoute: "Add at least one destination",
  totalBonus: (n: string) => `Up to +${n} to the index across all active campaigns`,
  // уровни
  circlesHint:
    "A resident's Circle comes from her Influence Index: the highest threshold she has reached. Thresholds apply to everyone at once.",
  threshold: "From index",
  entryLevel: "Entry level",
  residentsAt: "residents",
  mustAscend: "Must be above the previous level and below the next one",
  circleTitle: "Circle name",
};

type AdminDict = typeof en;

const ru: AdminDict = {
  eyebrow: "Voyage · Admin",
  title: "Геймификация",
  subtitle:
    "Штампы, веса направлений, легендарные комбо и уровни Circle — единый Индекс влияния для всего клуба.",
  refresh: "Обновить",
  loading: "Загружаем резидентов, направления и кампании…",
  loadFailed: "Не удалось загрузить данные",
  refreshFailed: "Не удалось обновить данные — показана последняя версия",
  retry: "Повторить",
  networkError: "Сетевая ошибка",
  migrationHint: "Похоже, миграция gamification_v2 ещё не применена в Supabase.",
  live: "Онлайн",
  offline: "Нет связи",
  statResidents: "Резиденты",
  statStamps: "Штампы",
  statDestinations: "Активных направлений",
  statCombos: "Активных кампаний",
  tabResidents: "Резиденты",
  tabDestinations: "Направления",
  tabCombos: "Легендарные комбо",
  tabCircles: "Уровни Circle",
  searchPlaceholder: "Поиск резидента…",
  searchAria: "Поиск резидента",
  of: "из",
  all: "Все",
  emptyNoResidents: "В базе пока нет резидентов (или RLS не даёт их прочитать).",
  emptyNotFound: "Резиденты не найдены.",
  pickDestination: "Выбрать направление",
  filterDestinations: "Фильтр…",
  noDestinations: "Нет активных направлений",
  stamp: "Поставить штамп",
  customWeight: "Вес",
  customWeightAria: "Свой вес штампа в баллах (необязательно)",
  influence: "индекс",
  level: "Уровень",
  toNext: (n, title) => `${n} до ${title}`,
  topLevel: "Высший круг достигнут",
  visit: (n) => `${n}-й визит`,
  factorBase: "база",
  errRls: "Нет прав на проставление штампов (RLS).",
  errGeneric: "Не удалось поставить штамп.",
  errWeight: "Вес — целое число баллов.",
  status: {
    pending: "На модерации",
    rejected: "Отклонена",
    blocked: "Заблокирована",
  },
  autosaveHint: "Изменения сохраняются автоматически и сразу применяются ко всем резидентам.",
  searchDestinations: "Поиск направления…",
  colDestination: "Направление",
  colTier: "Визовый ценз",
  colPoints: "Баллы",
  colMultiplier: "Множитель",
  colValue: "За штамп",
  colActive: "Активно",
  outOfCatalog: "Вне каталога",
  outOfCatalogHint: "Нет в каталоге клуба: не входят в Индекс влияния и не видны резидентам. Чтобы вернуть — добавьте в общий каталог.",
  saving: "Сохраняем…",
  saved: "Сохранено",
  unsaved: "Не сохранено",
  invalid: "Проверьте значение",
  saveFailed: "Ошибка сохранения",
  retrySave: "Повторить",
  noPermission: "Нет прав на изменение (RLS)",
  composition: "Маршрут",
  addDestination: "Добавить направление",
  removeDestination: (name) => `Убрать ${name}`,
  requirement: "Нужно собрать",
  requirementOf: (n, m) => `${n} из ${m}`,
  requirementAll: "все",
  requirementLess: "Уменьшить требование",
  requirementMore: "Увеличить требование",
  bonus: "Бонус к индексу",
  campaignActive: "Кампания активна",
  campaignTitle: "Название кампании",
  emptyRoute: "Добавьте хотя бы одно направление",
  totalBonus: (n) => `До +${n} к индексу за все активные кампании`,
  circlesHint:
    "Circle резидента определяется её Индексом влияния — по самому высокому достигнутому порогу. Пороги применяются ко всем сразу.",
  threshold: "От индекса",
  entryLevel: "Стартовый уровень",
  residentsAt: "резидентов",
  mustAscend: "Порог должен быть выше предыдущего уровня и ниже следующего",
  circleTitle: "Название уровня",
};

const es: AdminDict = {
  eyebrow: "Voyage · Admin",
  title: "Gamificación",
  subtitle:
    "Sellos, pesos de destinos, combos legendarios y niveles Circle: un único Índice de influencia para todo el club.",
  refresh: "Actualizar",
  loading: "Cargando residentes, destinos y campañas…",
  loadFailed: "No se pudieron cargar los datos",
  refreshFailed: "No se pudieron actualizar los datos — se muestra la última versión",
  retry: "Reintentar",
  networkError: "Error de red",
  migrationHint: "Parece que la migración gamification_v2 aún no se ha aplicado en Supabase.",
  live: "En vivo",
  offline: "Sin conexión",
  statResidents: "Residentes",
  statStamps: "Sellos",
  statDestinations: "Destinos activos",
  statCombos: "Campañas activas",
  tabResidents: "Residentes",
  tabDestinations: "Destinos",
  tabCombos: "Combos legendarios",
  tabCircles: "Niveles Circle",
  searchPlaceholder: "Buscar residente…",
  searchAria: "Buscar residente",
  of: "de",
  all: "Todas",
  emptyNoResidents: "Aún no hay residentes en la base (o RLS no permite leerlos).",
  emptyNotFound: "No se encontraron residentes.",
  pickDestination: "Elegir destino",
  filterDestinations: "Filtrar…",
  noDestinations: "No hay destinos activos",
  stamp: "Poner sello",
  customWeight: "Peso",
  customWeightAria: "Peso propio del sello en puntos (opcional)",
  influence: "índice",
  level: "Nivel",
  toNext: (n, title) => `${n} para ${title}`,
  topLevel: "Círculo máximo alcanzado",
  visit: (n) => `visita n.º ${n}`,
  factorBase: "base",
  errRls: "No tienes permiso para poner sellos (RLS).",
  errGeneric: "No se pudo poner el sello.",
  errWeight: "El peso debe ser un número entero de puntos.",
  status: {
    pending: "En revisión",
    rejected: "Rechazada",
    blocked: "Bloqueada",
  },
  autosaveHint: "Los cambios se guardan automáticamente y se aplican al instante a todas las residentes.",
  searchDestinations: "Buscar destino…",
  colDestination: "Destino",
  colTier: "Nivel de visado",
  colPoints: "Puntos",
  colMultiplier: "Multiplicador",
  colValue: "Por sello",
  colActive: "Activo",
  outOfCatalog: "Fuera del catálogo",
  outOfCatalogHint: "No están en el catálogo del club: no cuentan en el Índice de influencia y las residentes no los ven. Para recuperarlos, añádalos al catálogo común.",
  saving: "Guardando…",
  saved: "Guardado",
  unsaved: "Sin guardar",
  invalid: "Revise el valor",
  saveFailed: "Error al guardar",
  retrySave: "Reintentar",
  noPermission: "Sin permiso para editar (RLS)",
  composition: "Ruta",
  addDestination: "Añadir destino",
  removeDestination: (name) => `Quitar ${name}`,
  requirement: "Hay que reunir",
  requirementOf: (n, m) => `${n} de ${m}`,
  requirementAll: "todos",
  requirementLess: "Exigir menos",
  requirementMore: "Exigir más",
  bonus: "Bono al índice",
  campaignActive: "Campaña activa",
  campaignTitle: "Nombre de la campaña",
  emptyRoute: "Añada al menos un destino",
  totalBonus: (n) => `Hasta +${n} al índice con todas las campañas activas`,
  circlesHint:
    "El Circle de cada residente se deriva de su Índice de influencia: el umbral más alto alcanzado. Los umbrales se aplican a todas a la vez.",
  threshold: "Desde índice",
  entryLevel: "Nivel inicial",
  residentsAt: "residentes",
  mustAscend: "Debe ser mayor que el nivel anterior y menor que el siguiente",
  circleTitle: "Nombre del nivel",
};

const pt: AdminDict = {
  eyebrow: "Voyage · Admin",
  title: "Gamificação",
  subtitle:
    "Carimbos, pesos dos destinos, combos lendários e níveis Circle — um único Índice de influência para todo o clube.",
  refresh: "Atualizar",
  loading: "Carregando residentes, destinos e campanhas…",
  loadFailed: "Não foi possível carregar os dados",
  refreshFailed: "Não foi possível atualizar os dados — exibindo a última versão",
  retry: "Tentar novamente",
  networkError: "Erro de rede",
  migrationHint: "Parece que a migração gamification_v2 ainda não foi aplicada no Supabase.",
  live: "Ao vivo",
  offline: "Sem conexão",
  statResidents: "Residentes",
  statStamps: "Carimbos",
  statDestinations: "Destinos ativos",
  statCombos: "Campanhas ativas",
  tabResidents: "Residentes",
  tabDestinations: "Destinos",
  tabCombos: "Combos lendários",
  tabCircles: "Níveis Circle",
  searchPlaceholder: "Buscar residente…",
  searchAria: "Buscar residente",
  of: "de",
  all: "Todas",
  emptyNoResidents: "Ainda não há residentes no banco (ou o RLS não permite lê-los).",
  emptyNotFound: "Nenhuma residente encontrada.",
  pickDestination: "Escolher destino",
  filterDestinations: "Filtrar…",
  noDestinations: "Nenhum destino ativo",
  stamp: "Carimbar visita",
  customWeight: "Peso",
  customWeightAria: "Peso próprio do carimbo em pontos (opcional)",
  influence: "índice",
  level: "Nível",
  toNext: (n, title) => `${n} para ${title}`,
  topLevel: "Círculo máximo alcançado",
  visit: (n) => `visita n.º ${n}`,
  factorBase: "base",
  errRls: "Você não tem permissão para carimbar visitas (RLS).",
  errGeneric: "Não foi possível carimbar a visita.",
  errWeight: "O peso deve ser um número inteiro de pontos.",
  status: {
    pending: "Em análise",
    rejected: "Rejeitada",
    blocked: "Bloqueada",
  },
  autosaveHint: "As alterações são salvas automaticamente e valem na hora para todas as residentes.",
  searchDestinations: "Buscar destino…",
  colDestination: "Destino",
  colTier: "Nível de visto",
  colPoints: "Pontos",
  colMultiplier: "Multiplicador",
  colValue: "Por carimbo",
  colActive: "Ativo",
  outOfCatalog: "Fora do catálogo",
  outOfCatalogHint: "Fora do catálogo do clube: não contam no Índice de influência e as residentes não os veem. Para recuperá-los, adicione-os ao catálogo comum.",
  saving: "Salvando…",
  saved: "Salvo",
  unsaved: "Não salvo",
  invalid: "Verifique o valor",
  saveFailed: "Falha ao salvar",
  retrySave: "Tentar de novo",
  noPermission: "Sem permissão para editar (RLS)",
  composition: "Rota",
  addDestination: "Adicionar destino",
  removeDestination: (name) => `Remover ${name}`,
  requirement: "É preciso reunir",
  requirementOf: (n, m) => `${n} de ${m}`,
  requirementAll: "todos",
  requirementLess: "Exigir menos",
  requirementMore: "Exigir mais",
  bonus: "Bônus ao índice",
  campaignActive: "Campanha ativa",
  campaignTitle: "Nome da campanha",
  emptyRoute: "Adicione pelo menos um destino",
  totalBonus: (n) => `Até +${n} ao índice com todas as campanhas ativas`,
  circlesHint:
    "O Circle de cada residente vem do seu Índice de influência: o limiar mais alto alcançado. Os limiares valem para todas ao mesmo tempo.",
  threshold: "A partir do índice",
  entryLevel: "Nível inicial",
  residentsAt: "residentes",
  mustAscend: "Deve ser maior que o nível anterior e menor que o seguinte",
  circleTitle: "Nome do nível",
};

const T: Record<Lang, AdminDict> = { en, ru, es, pt };

/** Словарь + форматтер чисел для текущего языка. Экспортируется для page.tsx. */
export function useAdminI18n() {
  const { lang: rawLang } = useLanguage();
  const lang = normalizeLang(rawLang);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 2 }), [lang]);
  return { lang, locale: LOCALES[lang], t: T[lang], nf };
}

/* ══════════════════════════════════════════════════════════════════
 * Типы
 * ══════════════════════════════════════════════════════════════════ */

export type AdminGameStamp = {
  id: string;
  profile_id: string;
  destination_id: string;
  visited_at: string;
  visit_number: number | null;
  points: number | null;
  multiplier: number | null;
  stamped_at: string;
};

export type AdminAchievement = {
  id: string;
  profile_id: string;
  achievement_key: string;
  title: string;
  points_awarded: number | string;
  earned_at: string;
};

export type AdminResident = {
  profileId: string;
  /** Уже разрешённое имя: full_name → имя+фамилия → ник → почта */
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  /** Статус аппрува профиля. Бейдж показывается, если не 'approved'. */
  approval: string | null;
  influence: number;
  level: number;
  circleKey: CircleKey;
  stampsCount: number;
  destinationsCount: number;
  combosCompleted: number;
  position: number | null;
  stamps: AdminGameStamp[];
  achievements: AdminAchievement[];
};

/** Направление из БД, которого нет в общем каталоге */
export type ExtraDestination = {
  id: string;
  name: string;
  tier: Tier;
  points: number;
  multiplier: number;
  active: boolean;
};

export type SavedRow =
  | { table: "game_destinations"; row: GameDestinationRow }
  | { table: "game_combos"; row: GameComboRow }
  | { table: "game_circles"; row: GameCircleRow };

export type AdminTab = "residents" | "destinations" | "combos" | "circles";

/* ══════════════════════════════════════════════════════════════════
 * Оформление
 * ══════════════════════════════════════════════════════════════════ */

const TIER_DOT: Record<Tier, string> = {
  free: "bg-zinc-500",
  evisa: "bg-amber-200/60",
  hard: "bg-slate-200/70",
};

const CIRCLE_STYLE: Record<
  CircleKey,
  { badge: string; text: string; ring: string; bar: string; dot: string }
> = {
  voyager: {
    badge: "border-zinc-700/80 bg-zinc-800/50 text-zinc-400",
    text: "text-zinc-400",
    ring: "ring-zinc-700/70",
    bar: "bg-zinc-500",
    dot: "bg-zinc-500",
  },
  resident: {
    badge: "border-zinc-600/70 bg-zinc-800/60 text-zinc-200",
    text: "text-zinc-200",
    ring: "ring-zinc-500/60",
    bar: "bg-zinc-300",
    dot: "bg-zinc-300",
  },
  preferred: {
    badge: "border-amber-200/20 bg-amber-200/[0.04] text-amber-200/70",
    text: "text-amber-200/70",
    ring: "ring-amber-200/25",
    bar: "bg-amber-200/50",
    dot: "bg-amber-200/60",
  },
  inner: {
    badge: "border-amber-200/35 bg-amber-200/[0.07] text-amber-200",
    text: "text-amber-200",
    ring: "ring-amber-200/45",
    bar: "bg-amber-200/80",
    dot: "bg-amber-200",
  },
  private: {
    badge: "border-slate-200/30 bg-slate-200/[0.06] text-slate-100",
    text: "text-slate-100",
    ring: "ring-slate-200/45",
    bar: "bg-slate-200/80",
    dot: "bg-slate-200",
  },
  black: {
    badge: "border-amber-100/50 bg-black text-amber-100 shadow-[0_0_18px_-6px_rgba(253,230,138,0.45)]",
    text: "text-amber-100",
    ring: "ring-amber-100/70",
    bar: "bg-amber-100",
    dot: "bg-amber-100",
  },
};

const COMBO_ICON: Record<ComboIcon, LucideIcon> = {
  moon: Moon,
  mountain: Mountain,
  compass: Compass,
  anchor: Anchor,
  sun: Sun,
  gem: Gem,
  crown: Crown,
  landmark: Landmark,
  waves: Waves,
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

const DEST_COLUMNS = "id, name, region, visa_tier, points, multiplier, active, sort_order";
const COMBO_COLUMNS = "id, title, destination_ids, required_count, bonus, active, sort_order";
const CIRCLE_COLUMNS = "level, key, title, min_influence";

/*
 * Раскладка строки направления. Перестраивается по ширине САМОГО СПИСКА
 * (container queries), а не окна: у админки есть сайдбар, поэтому
 * брейкпоинты по окну (lg:, xl:) включали «табличный» режим, когда места
 * на самом деле не хватало, — и название уезжало под переключатель ценза.
 *
 *   узко   (< 40rem): название · под ним ценз на всю ширину ·
 *                     ниже баллы | множитель | итог | тумблер
 *   средне (≥ 40rem): название · под ним все контролы в одну линию
 *   широко (≥ 53rem): название слева, контролы справа — одна строка
 *
 * Колонки контролов фиксированы и одинаковы у заголовка и строк, поэтому
 * подписи всегда стоят ровно над своими полями.
 */
const DEST_LAYOUT_CSS = `
.gam-dests { container-type: inline-size; }
.gam-dest-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem 1.25rem; align-items: center; }
.gam-dest-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto; gap: 0.5rem 0.75rem; align-items: center; }
.gam-dest-tier { grid-column: 1 / -1; }
.gam-dest-head { display: none; }
@container (min-width: 40rem) {
  .gam-dest-controls { grid-template-columns: 17.5rem 5rem 4.5rem 4.75rem 2.25rem; }
  .gam-dest-tier { grid-column: auto; }
  .gam-dest-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem 1.25rem; align-items: end; }
  .gam-dest-head-name { display: none; }
}
@container (min-width: 53rem) {
  .gam-dest-row, .gam-dest-head { grid-template-columns: minmax(12rem, 1fr) auto; }
  .gam-dest-head-name { display: block; }
}
`;

const TOAST_MS = 4500;

/* ══════════════════════════════════════════════════════════════════
 * Хелперы
 * ══════════════════════════════════════════════════════════════════ */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

function parseIntInput(s: string): number | null {
  if (!/^\d+$/.test(s.trim())) return null;
  return Number(s.trim());
}

function parseDecimalInput(s: string): number | null {
  const v = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(v) && !/^\.\d{1,2}$/.test(v)) return null;
  return Number(v);
}

function visitFactorLabel(n: number, t: AdminDict) {
  if (n <= 1) return t.factorBase;
  return n === 2 ? "×1.5" : "×2";
}

function nameOf(lang: Lang, id: DestId) {
  return PLACES[lang][id][0];
}

/** Ошибка сохранения: invalid — не отправляли, rls — нет прав, generic — прочее */
class SaveRejected extends Error {
  constructor(
    public kind: "invalid" | "rls" | "generic",
    message?: string,
  ) {
    super(message);
  }
}

function rejectFrom(error: { code?: string; message?: string }) {
  return new SaveRejected(error.code === "42501" ? "rls" : "generic", error.message);
}

/* ══════════════════════════════════════════════════════════════════
 * Автосохранение
 * ══════════════════════════════════════════════════════════════════ */

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "invalid";
type SaveError = { kind: "invalid" | "rls" | "generic"; message?: string } | null;

/**
 * Черновик строки + отложенное сохранение.
 * Пока есть несохранённые правки, обновления извне (realtime, другой
 * админ) черновик не трогают; после сохранения черновик снова следует
 * за источником.
 */
function useAutosave<T extends Record<string, unknown>>(
  source: T,
  persist: (value: T) => Promise<void>,
  delay = 700,
) {
  const [draft, setDraft] = useState<T>(source);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<SaveError>(null);

  const latest = useRef(source);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef(persist);

  useEffect(() => {
    persistRef.current = persist;
  });

  useEffect(() => {
    if (dirty.current) return;
    latest.current = source;
    setDraft(source);
  }, [source]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const value = latest.current;
    setState("saving");
    setError(null);
    try {
      await persistRef.current(value);
      if (latest.current !== value) return; // пока сохраняли, пришли новые правки
      dirty.current = false;
      setState("saved");
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1800);
    } catch (e) {
      if (latest.current !== value) return;
      if (e instanceof SaveRejected) {
        setState(e.kind === "invalid" ? "invalid" : "error");
        setError({ kind: e.kind, message: e.message || undefined });
      } else {
        setState("error");
        setError({ kind: "generic", message: e instanceof Error ? e.message : undefined });
      }
    }
  }, []);

  const update = useCallback(
    (patch: Partial<T>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      dirty.current = true;
      setDraft(next);
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  // переключили вкладку посреди правки — отложенное сохранение не теряется
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persistRef.current(latest.current).catch(() => {});
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );

  return { draft, update, state, error, retry: flush };
}

/* ══════════════════════════════════════════════════════════════════
 * Мелкие элементы
 * ══════════════════════════════════════════════════════════════════ */

function Avatar({ src, name, ring }: { src: string | null; name: string; ring: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-900 ring-2 ring-offset-2 ring-offset-zinc-950 ${ring}`}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-sm font-medium tracking-wide text-zinc-400">{initials(name)}</span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40 ${
        checked ? "border-amber-200/40 bg-amber-200/20" : "border-zinc-700 bg-zinc-800/80"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform duration-200 ${
          checked ? "translate-x-[17px] bg-amber-200" : "translate-x-[2px] bg-zinc-500"
        }`}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  label,
  decimal = false,
  prefix,
  invalid = false,
  placeholder,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  decimal?: boolean;
  prefix?: ReactNode;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`relative flex items-center ${className}`}>
      <span className="sr-only">{label}</span>
      {prefix && (
        <span className="pointer-events-none absolute left-2.5 flex items-center text-xs text-zinc-600">{prefix}</span>
      )}
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) =>
          onChange(decimal ? e.target.value.replace(",", ".").replace(/[^\d.]/g, "") : e.target.value.replace(/\D/g, ""))
        }
        className={`w-full rounded-lg border bg-zinc-950/70 py-1.5 ${prefix ? "pl-7" : "pl-2.5"} pr-2.5 text-right font-mono text-sm tabular-nums text-zinc-100 placeholder:text-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/25 disabled:cursor-not-allowed disabled:text-zinc-500 ${
          invalid ? "border-red-500/50" : "border-zinc-800 hover:border-zinc-700 focus:border-amber-200/40"
        }`}
      />
    </label>
  );
}

function SaveBadge({
  state,
  error,
  onRetry,
}: {
  state: SaveState;
  error: SaveError;
  onRetry: () => void;
}) {
  const { t } = useAdminI18n();
  const base = "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]";

  if (state === "idle") return <span className="inline-block h-4" aria-hidden />;
  if (state === "dirty")
    return (
      <span className={`${base} text-amber-200/60`}>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-200/70" />
        {t.unsaved}
      </span>
    );
  if (state === "saving")
    return (
      <span role="status" className={`${base} text-zinc-500`}>
        <Loader2 size={12} strokeWidth={2} className="animate-spin" />
        {t.saving}
      </span>
    );
  if (state === "saved")
    return (
      <span role="status" className={`${base} text-emerald-300/80`}>
        <Check size={12} strokeWidth={2.2} />
        {t.saved}
      </span>
    );
  if (state === "invalid")
    return (
      <span role="alert" title={error?.message} className={`${base} text-amber-300`}>
        <AlertTriangle size={12} strokeWidth={2} />
        {t.invalid}
      </span>
    );
  return (
    <button
      type="button"
      onClick={onRetry}
      title={error?.message}
      className={`${base} rounded-md text-red-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40`}
    >
      <AlertTriangle size={12} strokeWidth={2} />
      {error?.kind === "rls" ? t.noPermission : `${t.saveFailed} · ${t.retrySave}`}
    </button>
  );
}

function CircleBadge({ circle }: { circle: CircleConfig }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${CIRCLE_STYLE[circle.key].badge}`}
    >
      <span className="font-mono tracking-normal opacity-70">{ROMAN[circle.level - 1]}</span>
      {circle.title}
    </span>
  );
}

function SectionCaption({ children }: { children: ReactNode }) {
  return <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{children}</p>;
}

/* ══════════════════════════════════════════════════════════════════
 * Выбор направления (по 4 регионам)
 * ══════════════════════════════════════════════════════════════════ */

function DestinationPicker({
  destinations,
  value,
  onChange,
  exclude,
  disabled,
  onOpenChange,
  variant = "select",
  align = "right",
}: {
  destinations: DestinationConfig[];
  value?: DestinationConfig | null;
  onChange: (d: DestinationConfig) => void;
  exclude?: ReadonlySet<string>;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "select" | "chip";
  align?: "left" | "right";
}) {
  const { t, lang } = useAdminI18n();
  const [open, setOpenState] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (!next) setFilter("");
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return REGIONS.map((region) => ({
      region,
      items: destinations.filter(
        (d) =>
          d.region === region &&
          !exclude?.has(d.id) &&
          (!q || d.id.includes(q) || PLACES[lang][d.id].join(" ").toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [destinations, exclude, filter, lang]);

  return (
    <div ref={rootRef} className="relative">
      {variant === "select" ? (
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-60"
        >
          <span className="flex min-w-0 items-center gap-2">
            {value ? (
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[value.tier]}`} />
            ) : (
              <MapPin size={14} strokeWidth={1.5} className="shrink-0 text-zinc-500" />
            )}
            <span className={`truncate ${value ? "" : "text-zinc-500"}`}>
              {value ? nameOf(lang, value.id) : t.pickDestination}
            </span>
          </span>
          <ChevronDown
            size={15}
            strokeWidth={1.5}
            className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-500 transition-colors hover:border-amber-200/40 hover:text-amber-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30"
        >
          <Plus size={12} strokeWidth={1.8} />
          {t.addDestination}
        </button>
      )}

      {open && (
        <div
          className={`absolute z-50 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/70 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="relative border-b border-zinc-900 p-2">
            <Search
              size={13}
              strokeWidth={1.6}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
            />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.filterDestinations}
              aria-label={t.filterDestinations}
              className="w-full rounded-md bg-zinc-900/70 py-1.5 pl-7 pr-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/30"
            />
          </div>
          <div role="listbox" className="max-h-80 overflow-auto overscroll-contain p-1.5">
            {groups.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">{t.noDestinations}</p>
            )}
            {groups.map(({ region, items }) => (
              <div key={region} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-2 text-[9px] uppercase tracking-[0.25em] text-amber-200/50">
                  {REGION_LABELS[lang][region]}
                </p>
                {items.map((d) => {
                  const active = value?.id === d.id;
                  const [name, sub] = PLACES[lang][d.id];
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(d);
                        setOpen(false);
                        btnRef.current?.focus();
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors focus:outline-none focus-visible:bg-white/[0.06] ${
                        active ? "bg-amber-200/10 text-amber-200" : "text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[d.tier]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{name}</span>
                        <span className="block truncate text-[10px] text-zinc-600">{sub}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
                        {d.points}
                      </span>
                      {active && <Check size={13} strokeWidth={2} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 1 · Резиденты
 * ══════════════════════════════════════════════════════════════════ */

// Toast stores data rather than translated text so language changes stay live.
type Toast =
  | { kind: "ok"; destination: DestId; visit: number; value: number }
  | { kind: "message"; message: string; success?: boolean }
  | { kind: "err"; reason: "rls" | "generic" | "weight"; message?: string }
  | null;

const MANAGEMENT_COPY: Record<Lang, {
  manage: string; achievements: string; achievementStatus: string; earned: string; notEarned: string;
  prepareAward: string; issueAchievement: string; key: string; title: string; points: string;
  saveAchievement: string; stamps: string; noStamps: string; removeStamp: string; revokeAchievement: string;
  confirmRemoveStamp: string; confirmRemoveAchievement: string; stampRemoved: string; achievementIssued: string;
  achievementRemoved: string; dateUnknown: string; visit: string; close: string; validation: string;
  permissionError: string; duplicateError: string; notFoundError: string; genericError: string;
}> = {
  en: { manage: "Stamps & achievements", achievements: "Achievement status", achievementStatus: "Status", earned: "Awarded", notEarned: "Not awarded", prepareAward: "Prepare award", issueAchievement: "Issue achievement", key: "Achievement key", title: "Title", points: "Points", saveAchievement: "Award", stamps: "Passport stamps", noStamps: "No destination stamps yet.", removeStamp: "Revoke stamp", revokeAchievement: "Revoke achievement", confirmRemoveStamp: "Revoke this passport stamp? The score ledger will receive a compensating adjustment.", confirmRemoveAchievement: "Revoke this achievement? The score ledger will receive a compensating adjustment.", stampRemoved: "Stamp revoked.", achievementIssued: "Achievement awarded.", achievementRemoved: "Achievement revoked.", dateUnknown: "Date unavailable", visit: "Visit", close: "Close", validation: "Enter a key, a title and a whole number of points from 0 to 1,000,000.", permissionError: "Only admin and owner can perform this action.", duplicateError: "An achievement with this key already exists.", notFoundError: "The resident or record could not be found.", genericError: "The action failed. Check the data and try again." },
  ru: { manage: "Штампы и достижения", achievements: "Статусы достижений", achievementStatus: "Статус", earned: "Выдано", notEarned: "Не выдано", prepareAward: "Подготовить выдачу", issueAchievement: "Выдать достижение", key: "Ключ достижения", title: "Название", points: "Баллы", saveAchievement: "Выдать", stamps: "Штампы паспорта", noStamps: "Штампов направлений пока нет.", removeStamp: "Забрать штамп", revokeAchievement: "Аннулировать достижение", confirmRemoveStamp: "Забрать этот штамп? В журнал баллов будет добавлена компенсирующая корректировка.", confirmRemoveAchievement: "Аннулировать это достижение? В журнал баллов будет добавлена компенсирующая корректировка.", stampRemoved: "Штамп аннулирован.", achievementIssued: "Достижение выдано.", achievementRemoved: "Достижение аннулировано.", dateUnknown: "Дата недоступна", visit: "Визит", close: "Свернуть", validation: "Укажите ключ, название и целое число баллов от 0 до 1 000 000.", permissionError: "Действие доступно только ролям admin и owner.", duplicateError: "Достижение с таким ключом уже существует.", notFoundError: "Резидент или запись не найдены.", genericError: "Не удалось выполнить действие. Проверьте данные и повторите попытку." },
  es: { manage: "Sellos y logros", achievements: "Estado de los logros", achievementStatus: "Estado", earned: "Otorgado", notEarned: "No otorgado", prepareAward: "Preparar concesión", issueAchievement: "Otorgar logro", key: "Clave del logro", title: "Título", points: "Puntos", saveAchievement: "Otorgar", stamps: "Sellos del pasaporte", noStamps: "Todavía no hay sellos de destinos.", removeStamp: "Retirar sello", revokeAchievement: "Retirar logro", confirmRemoveStamp: "¿Retirar este sello? Se añadirá un ajuste compensatorio al registro de puntos.", confirmRemoveAchievement: "¿Retirar este logro? Se añadirá un ajuste compensatorio al registro de puntos.", stampRemoved: "Sello retirado.", achievementIssued: "Logro otorgado.", achievementRemoved: "Logro retirado.", dateUnknown: "Fecha no disponible", visit: "Visita", close: "Cerrar", validation: "Introduzca una clave, un título y puntos enteros entre 0 y 1.000.000.", permissionError: "Solo admin y owner pueden realizar esta acción.", duplicateError: "Ya existe un logro con esta clave.", notFoundError: "No se encontró el residente o el registro.", genericError: "No se pudo completar la acción. Compruebe los datos e inténtelo de nuevo." },
  pt: { manage: "Carimbos e conquistas", achievements: "Status das conquistas", achievementStatus: "Status", earned: "Concedida", notEarned: "Não concedida", prepareAward: "Preparar concessão", issueAchievement: "Conceder conquista", key: "Chave da conquista", title: "Título", points: "Pontos", saveAchievement: "Conceder", stamps: "Carimbos do passaporte", noStamps: "Ainda não há carimbos de destinos.", removeStamp: "Revogar carimbo", revokeAchievement: "Revogar conquista", confirmRemoveStamp: "Revogar este carimbo? Será adicionado um ajuste compensatório ao registro de pontos.", confirmRemoveAchievement: "Revogar esta conquista? Será adicionado um ajuste compensatório ao registro de pontos.", stampRemoved: "Carimbo revogado.", achievementIssued: "Conquista concedida.", achievementRemoved: "Conquista revogada.", dateUnknown: "Data indisponível", visit: "Visita", close: "Fechar", validation: "Informe uma chave, um título e pontos inteiros entre 0 e 1.000.000.", permissionError: "Somente admin e owner podem executar esta ação.", duplicateError: "Já existe uma conquista com esta chave.", notFoundError: "O residente ou o registro não foi encontrado.", genericError: "Não foi possível concluir a ação. Confira os dados e tente novamente." },
};

type ManagementCopy = (typeof MANAGEMENT_COPY)[Lang];

function localizeGamificationError(raw: string, copy: ManagementCopy, fallback: string): string {
  if (/admin_only|permission|owner|admin|роль|прав|42501/i.test(raw)) return copy.permissionError;
  if (/achievement_already_exists|already exists|существует|23505/i.test(raw)) return copy.duplicateError;
  if (/not_found|not found|не найд|P0002/i.test(raw)) return copy.notFoundError;
  if (/invalid_|destination_required|invalid|некоррект|проверьте|укажите|22023/i.test(raw)) return copy.validation;
  return fallback || copy.genericError;
}

const BASIC_ACHIEVEMENTS: Record<Lang, Array<{ key: string; title: string; description: string }>> = {
  en: [
    { key: "first_completed_activity", title: "First completed activity", description: "Complete a club tour or event." },
    { key: "first_country_stamp", title: "First passport stamp", description: "Receive your first country stamp." },
    { key: "five_countries", title: "Five countries", description: "Collect passport stamps from five countries." },
  ],
  ru: [
    { key: "first_completed_activity", title: "Первая завершённая активность", description: "Завершите тур или мероприятие клуба." },
    { key: "first_country_stamp", title: "Первый штамп паспорта", description: "Получите первый штамп страны." },
    { key: "five_countries", title: "Пять стран", description: "Соберите штампы пяти стран." },
  ],
  es: [
    { key: "first_completed_activity", title: "Primera actividad completada", description: "Complete un tour o evento del club." },
    { key: "first_country_stamp", title: "Primer sello del pasaporte", description: "Reciba su primer sello de país." },
    { key: "five_countries", title: "Cinco países", description: "Reúna sellos de cinco países." },
  ],
  pt: [
    { key: "first_completed_activity", title: "Primeira atividade concluída", description: "Conclua um tour ou evento do clube." },
    { key: "first_country_stamp", title: "Primeiro carimbo do passaporte", description: "Receba seu primeiro carimbo de país." },
    { key: "five_countries", title: "Cinco países", description: "Reúna carimbos de cinco países." },
  ],
};

const ResidentRow = memo(function ResidentRow({
  resident,
  circles,
  destinations,
  onStamped,
}: {
  resident: AdminResident;
  circles: CircleConfig[];
  destinations: DestinationConfig[];
  onStamped?: (profileId: string) => void;
}) {
  const { t, nf, lang } = useAdminI18n();
  const copy = MANAGEMENT_COPY[lang];
  const [selected, setSelected] = useState<DestinationConfig | null>(null);
  const [weight, setWeight] = useState("");
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [achievementKey, setAchievementKey] = useState("");
  const [achievementTitle, setAchievementTitle] = useState("");
  const [achievementPoints, setAchievementPoints] = useState("0");

  const inFlight = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const current = selected ? (destinations.find((d) => d.id === selected.id) ?? null) : null;
  const presets = BASIC_ACHIEVEMENTS[lang];
  const presetKeys = new Set(presets.map((item) => item.key));
  const earnedByKey = new Map(resident.achievements.map((item) => [item.achievement_key, item]));
  const extraAchievements = resident.achievements.filter((item) => !presetKeys.has(item.achievement_key));

  const showToast = useCallback((next: NonNullable<Toast>) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  async function onStamp() {
    if (!current || inFlight.current) return;
    const custom = weight.trim() === "" ? null : parseIntInput(weight);
    if (weight.trim() !== "" && custom === null) { showToast({ kind: "err", reason: "weight" }); return; }
    inFlight.current = true;
    setPending(true);
    setToast(null);
    const destination = current;
    try {
      const result = await issueGameStamp({ profileId: resident.profileId, destinationId: destination.id, points: custom });
      if (!result.ok) throw new Error(result.error);
      const visit = Number(result.data?.visit_number ?? 1);
      const points = Number(result.data?.points_awarded ?? 0);
      showToast({ kind: "ok", destination: destination.id, visit, value: Math.max(0, points) });
      setSelected(null);
      setWeight("");
      onStamped?.(resident.profileId);
    } catch (error) {
      showToast({ kind: "err", reason: "generic", message: localizeGamificationError(error instanceof Error ? error.message : "", copy, t.errGeneric) });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function onRevokeStamp(stamp: AdminGameStamp) {
const destinationName = (destinations.find((item) => item.id === stamp.destination_id) as any)?.name ?? (destinations.find((item) => item.id === stamp.destination_id) as any)?.title ?? (destinations.find((item) => item.id === stamp.destination_id) as any)?.label ?? stamp.destination_id;    if (!window.confirm(`${copy.confirmRemoveStamp}\n\n${destinationName}`)) return;
    setPending(true);
    setToast(null);
    try {
      const result = await revokeGameStamp(stamp.id);
      if (!result.ok) {
        showToast({ kind: "err", reason: "generic", message: localizeGamificationError(result.error, copy, t.errGeneric) });
      } else {
        showToast({ kind: "message", message: copy.stampRemoved, success: true });
        onStamped?.(resident.profileId);
      }
    } catch (error) {
      showToast({ kind: "err", reason: "generic", message: localizeGamificationError(error instanceof Error ? error.message : "", copy, t.errGeneric) });
    } finally {
      setPending(false);
    }
  }

  async function onIssueAchievement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const points = Number(achievementPoints);
    if (!achievementKey.trim() || !achievementTitle.trim() || !Number.isInteger(points) || points < 0 || points > 1_000_000) {
      showToast({ kind: "err", reason: "generic", message: copy.validation });
      return;
    }
    setPending(true);
    try {
      const result = await issueResidentAchievement({ profileId: resident.profileId, achievementKey: achievementKey.trim(), title: achievementTitle.trim(), points });
      if (!result.ok) {
        showToast({ kind: "err", reason: "generic", message: localizeGamificationError(result.error, copy, t.errGeneric) });
      } else {
        showToast({ kind: "message", message: copy.achievementIssued, success: true });
        setAchievementKey("");
        setAchievementTitle("");
        setAchievementPoints("0");
        onStamped?.(resident.profileId);
      }
    } catch (error) {
      showToast({ kind: "err", reason: "generic", message: localizeGamificationError(error instanceof Error ? error.message : "", copy, t.errGeneric) });
    } finally {
      setPending(false);
    }
  }

  async function onRevokeAchievement(achievement: AdminAchievement) {
    if (!window.confirm(`${copy.confirmRemoveAchievement}\n\n${achievement.title}`)) return;
    setPending(true);
    try {
      const result = await revokeResidentAchievement(achievement.id);
      if (!result.ok) {
        showToast({ kind: "err", reason: "generic", message: localizeGamificationError(result.error, copy, t.errGeneric) });
      } else {
        showToast({ kind: "message", message: copy.achievementRemoved, success: true });
        onStamped?.(resident.profileId);
      }
    } catch (error) {
      showToast({ kind: "err", reason: "generic", message: localizeGamificationError(error instanceof Error ? error.message : "", copy, t.errGeneric) });
    } finally {
      setPending(false);
    }
  }

  const circle = circles.find((c) => c.key === resident.circleKey) ?? circles[0];
  const next = nextCircle(resident.influence, circles);
  const span = next ? next.min - circle.min : 0;
  const progress = next && span > 0 ? Math.min(1, Math.max(0, (resident.influence - circle.min) / span)) : 1;
  const approvalLabel = resident.approval && resident.approval !== "approved" ? (t.status[resident.approval] ?? resident.approval) : null;
  const toastText = toast?.kind === "ok"
    ? `${nameOf(lang, toast.destination)}: ${t.visit(toast.visit)} · ${visitFactorLabel(toast.visit, t)} · +${nf.format(toast.value)}`
    : toast?.kind === "message" ? toast.message
      : toast?.kind === "err" ? toast.reason === "rls" ? t.errRls : toast.reason === "weight" ? t.errWeight : toast.message || t.errGeneric
        : "";

  return (
    <li className={`relative rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700/80 sm:p-5 ${menuOpen ? "z-20" : ""}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar key={resident.avatarUrl ?? "none"} src={resident.avatarUrl} name={resident.fullName} ring={CIRCLE_STYLE[circle.key].ring} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              {resident.position !== null && <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">#{resident.position}</span>}
              <p className={`${cormorant.className} truncate text-xl font-medium text-zinc-100`} title={resident.email ?? undefined}>{resident.fullName}</p>
              {approvalLabel && <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">{approvalLabel}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <CircleBadge circle={circle} />
              <span className="font-mono tabular-nums text-amber-200">{nf.format(resident.influence)}<span className="ml-1 font-sans text-zinc-600">{t.influence}</span></span>
              <span className="flex items-center gap-3 text-zinc-500">
                <span className="inline-flex items-center gap-1" title={t.statStamps}><StampIcon size={12} strokeWidth={1.6} />{nf.format(resident.stampsCount)}</span>
                <span className="inline-flex items-center gap-1" title={t.tabDestinations}><MapPin size={12} strokeWidth={1.6} />{nf.format(resident.destinationsCount)}</span>
                <span className="inline-flex items-center gap-1" title={t.tabCombos}><Trophy size={12} strokeWidth={1.6} />{nf.format(resident.combosCompleted)}</span>
                <span className="inline-flex items-center gap-1" title={copy.achievements}><Award size={12} strokeWidth={1.6} />{nf.format(resident.achievements.length)}</span>
              </span>
            </div>
            <div className="mt-2.5 max-w-sm">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-zinc-800"><div className={`h-full transition-[width] duration-700 ${CIRCLE_STYLE[circle.key].bar}`} style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <p className="mt-1 text-[10px] text-zinc-600">{next ? t.toNext(nf.format(next.min - resident.influence), next.title) : t.topLevel}</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <DestinationPicker destinations={destinations} value={current} onChange={setSelected} disabled={pending} onOpenChange={setMenuOpen} />
          <NumberInput value={weight} onChange={setWeight} label={t.customWeightAria} placeholder={current ? String(current.points) : t.customWeight} prefix={<Coins size={12} strokeWidth={1.6} />} disabled={pending} className="sm:w-24" />
          <button type="button" disabled={!current || pending} onClick={onStamp} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200/40 bg-amber-200/10 px-4 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-200/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <StampIcon size={15} strokeWidth={1.75} />}{t.stamp}
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-800/70 pt-3">
        <button type="button" onClick={() => setManagementOpen((open) => !open)} aria-expanded={managementOpen} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/45 px-3 py-2 text-xs text-zinc-400 transition hover:border-amber-200/25 hover:text-amber-100">
          <Award size={13} className="text-amber-200/70" />{copy.manage}<span className="font-mono text-[10px] text-zinc-600">{resident.stamps.length} / {resident.achievements.length}</span><ChevronDown size={13} className={`transition-transform ${managementOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {managementOpen && <div className="mt-4 space-y-5 rounded-2xl border border-zinc-800/70 bg-zinc-950/35 p-3 sm:p-4">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{copy.stamps}</h3><span className="font-mono text-[10px] text-zinc-600">{resident.stamps.length}</span></div>
          {resident.stamps.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-xs text-zinc-600">{copy.noStamps}</p> : <div className="grid gap-2 sm:grid-cols-2">
            {resident.stamps.map((stamp) => {
              const name = (destinations.find((item) => item.id === stamp.destination_id) as any)?.name ?? (destinations.find((item) => item.id === stamp.destination_id) as any)?.title ?? (destinations.find((item) => item.id === stamp.destination_id) as any)?.label ?? stamp.destination_id;
              const date = stamp.stamped_at ? new Date(stamp.stamped_at).toLocaleDateString(LOCALES[lang]) : copy.dateUnknown;
              return <div key={stamp.id} className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200/15 bg-amber-200/[0.04] text-amber-200/70"><StampIcon size={15}/></span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs text-zinc-200" title={name}>{name}</p><p className="mt-1 text-[10px] text-zinc-600">{date} · {copy.visit} #{stamp.visit_number ?? 1}</p></div>
                <button type="button" disabled={pending} onClick={() => void onRevokeStamp(stamp)} title={copy.removeStamp} aria-label={`${copy.removeStamp}: ${name}`} className="rounded-lg border border-rose-400/15 p-2 text-rose-200/70 transition hover:bg-rose-400/[0.08] hover:text-rose-100 disabled:opacity-40"><Trash2 size={13}/></button>
              </div>;
            })}
          </div>}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{copy.achievements}</h3><span className="font-mono text-[10px] text-zinc-600">{resident.achievements.length}</span></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset) => {
              const earned = earnedByKey.get(preset.key);
              return <article key={preset.key} className={`rounded-xl border p-3 ${earned ? "border-amber-200/20 bg-amber-200/[0.035]" : "border-zinc-800 bg-zinc-900/25"}`}>
                <div className="flex items-start justify-between gap-2"><h4 className={`${cormorant.className} text-lg leading-tight ${earned ? "text-amber-100" : "text-zinc-300"}`}>{earned?.title ?? preset.title}</h4><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-wider ${earned ? "border-emerald-400/20 text-emerald-200" : "border-zinc-700 text-zinc-500"}`}>{earned ? copy.earned : copy.notEarned}</span></div>
                <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{preset.description}</p>
                {earned ? <div className="mt-3 flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-amber-200/80">+{nf.format(Number(earned.points_awarded) || 0)}</span><button type="button" disabled={pending} onClick={() => void onRevokeAchievement(earned)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-[10px] text-rose-200/80 transition hover:bg-rose-400/[0.06] disabled:opacity-40"><Trash2 size={11}/>{copy.revokeAchievement}</button></div> : <button type="button" disabled={pending} onClick={() => { setAchievementKey(preset.key); setAchievementTitle(preset.title); setManagementOpen(true); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-200/15 px-2.5 py-1.5 text-[10px] text-amber-100/80 transition hover:bg-amber-200/[0.05] disabled:opacity-40"><Plus size={11}/>{copy.prepareAward}</button>}
              </article>;
            })}
            {extraAchievements.map((achievement) => <article key={achievement.id} className="rounded-xl border border-amber-200/20 bg-amber-200/[0.035] p-3"><div className="flex items-start justify-between gap-2"><h4 className={`${cormorant.className} text-lg leading-tight text-amber-100`}>{achievement.title}</h4><span className="shrink-0 rounded-full border border-emerald-400/20 px-2 py-0.5 text-[8px] uppercase tracking-wider text-emerald-200">{copy.earned}</span></div><p className="mt-2 break-all font-mono text-[9px] text-zinc-600">{achievement.achievement_key}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-amber-200/80">+{nf.format(Number(achievement.points_awarded) || 0)}</span><button type="button" disabled={pending} onClick={() => void onRevokeAchievement(achievement)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-[10px] text-rose-200/80 transition hover:bg-rose-400/[0.06] disabled:opacity-40"><Trash2 size={11}/>{copy.revokeAchievement}</button></div></article>)}
          </div>

          <form onSubmit={onIssueAchievement} className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 sm:p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{copy.issueAchievement}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_110px_auto] sm:items-end">
              <label className="block"><span className="mb-1.5 block text-[10px] text-zinc-500">{copy.key}</span><input value={achievementKey} onChange={(event) => setAchievementKey(event.target.value)} maxLength={100} placeholder="custom_achievement" disabled={pending} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-amber-200/30 disabled:opacity-50"/></label>
              <label className="block"><span className="mb-1.5 block text-[10px] text-zinc-500">{copy.title}</span><input value={achievementTitle} onChange={(event) => setAchievementTitle(event.target.value)} maxLength={160} placeholder="Achievement title" disabled={pending} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-amber-200/30 disabled:opacity-50"/></label>
              <label className="block"><span className="mb-1.5 block text-[10px] text-zinc-500">{copy.points}</span><input type="number" min={0} max={1000000} step={1} value={achievementPoints} onChange={(event) => setAchievementPoints(event.target.value)} disabled={pending} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-amber-200/30 disabled:opacity-50"/></label>
              <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200/30 bg-amber-200/10 px-4 py-2.5 text-xs text-amber-100 transition hover:bg-amber-200/[0.16] disabled:opacity-40">{pending ? <Loader2 size={13} className="animate-spin"/> : <Plus size={13} />}{copy.saveAchievement}</button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{copy.validation}</p>
          </form>
        </section>
      </div>}

      <div aria-live="polite">
        {toast && <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${toast.kind === "ok" || (toast.kind === "message" && toast.success) ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300" : "border-red-500/30 bg-red-950/30 text-red-300"}`}>
          {toast.kind === "ok" || (toast.kind === "message" && toast.success) ? <Check size={14} strokeWidth={2}/> : <X size={14} strokeWidth={2}/>}<span>{toastText}</span>
        </div>}
      </div>
    </li>
  );
});

function ResidentsPanel({
  residents,
  circles,
  destinations,
  onStamped,
}: {
  residents: AdminResident[];
  circles: CircleConfig[];
  destinations: DestinationConfig[];
  onStamped?: (profileId: string) => void;
}) {
  const { t, nf } = useAdminI18n();
  const [query, setQuery] = useState("");
  const [circleFilter, setCircleFilter] = useState<CircleKey | "all">("all");

  const activeDestinations = useMemo(() => destinations.filter((d) => d.active), [destinations]);

  const counts = useMemo(() => {
    const m = new Map<CircleKey, number>();
    for (const r of residents) m.set(r.circleKey, (m.get(r.circleKey) ?? 0) + 1);
    return m;
  }, [residents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return residents.filter(
      (r) =>
        (circleFilter === "all" || r.circleKey === circleFilter) &&
        (!q || r.fullName.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q)),
    );
  }, [query, residents, circleFilter]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xs">
          <Search
            size={15}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", ...circles.map((c) => c.key)] as const).map((key) => {
            const active = circleFilter === key;
            const circle = key === "all" ? null : circles.find((c) => c.key === key);
            const count = key === "all" ? residents.length : (counts.get(key) ?? 0);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setCircleFilter(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30 ${
                  active
                    ? "border-amber-200/40 bg-amber-200/10 text-amber-200"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {circle && <span className={`h-1.5 w-1.5 rounded-full ${CIRCLE_STYLE[circle.key].dot}`} />}
                {circle ? circle.title : t.all}
                <span className="font-mono text-[10px] opacity-60">{nf.format(count)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mb-3 text-right text-xs tabular-nums text-zinc-600">
        {nf.format(filtered.length)} {t.of} {nf.format(residents.length)}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center text-sm text-zinc-500">
          {residents.length === 0 ? t.emptyNoResidents : t.emptyNotFound}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <ResidentRow
              key={r.profileId}
              resident={r}
              circles={circles}
              destinations={activeDestinations}
              onStamped={onStamped}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2 · Направления
 * ══════════════════════════════════════════════════════════════════ */

type DestDraft = { tier: Tier; points: string; multiplier: string; active: boolean };

/** Три равные кнопки на всю ширину своей колонки; подписи не переносятся */
function TierSwitch({ value, onChange }: { value: Tier; onChange: (tier: Tier) => void }) {
  return (
    <div
      role="radiogroup"
      className="grid w-full grid-cols-3 gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-0.5"
    >
      {TIER_ORDER.map((tier) => {
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            role="radio"
            aria-checked={active}
            title={TIERS[tier].label}
            onClick={() => onChange(tier)}
            className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1.5 text-[10px] uppercase tracking-[0.08em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/40 ${
              active ? "bg-zinc-800 text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" : "text-zinc-600 hover:text-zinc-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[tier]}`} />
            <span className="truncate">{TIERS[tier].short}</span>
          </button>
        );
      })}
    </div>
  );
}

const DestinationEditor = memo(function DestinationEditor({
  id,
  name,
  sub,
  code,
  tier,
  points,
  multiplier,
  active,
  onSaved,
}: {
  id: string;
  name: string;
  sub: string;
  code?: string;
  tier: Tier;
  points: number;
  multiplier: number;
  active: boolean;
  onSaved: (saved: SavedRow) => void;
}) {
  const { t, nf } = useAdminI18n();

  const source = useMemo<DestDraft>(
    () => ({ tier, points: String(points), multiplier: String(multiplier), active }),
    [tier, points, multiplier, active],
  );

  const persist = useCallback(
    async (d: DestDraft) => {
      const p = parseIntInput(d.points);
      const m = parseDecimalInput(d.multiplier);
      if (p === null || p > 1_000_000 || m === null || m <= 0 || m > 100) throw new SaveRejected("invalid");

      const { data, error } = await supabase
        .from("game_destinations")
        .update({ visa_tier: d.tier, points: p, multiplier: m, active: d.active })
        .eq("id", id)
        .select(DEST_COLUMNS)
        .maybeSingle();
      if (error) throw rejectFrom(error);
      if (!data) throw new SaveRejected("rls"); // RLS молча отфильтровала update
      onSaved({ table: "game_destinations", row: data as GameDestinationRow });
    },
    [id, onSaved],
  );

  const { draft, update, state, error, retry } = useAutosave(source, persist);

  const p = parseIntInput(draft.points);
  const m = parseDecimalInput(draft.multiplier);
  const value = p !== null && m !== null ? `${nf.format(p)} × ${nf.format(m)}` : null;

  return (
    <li
      className={`gam-dest-row rounded-xl border px-4 py-3 transition-colors ${
        draft.active ? "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80" : "border-zinc-900 bg-zinc-950/60"
      }`}
    >
      {/* название + подпись; статус сохранения — справа в строке подписи */}
      <div className="min-w-0">
        <div className={`flex min-w-0 items-center gap-2 ${draft.active ? "" : "opacity-50"}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[draft.tier]}`} />
          <p
            title={name}
            className={`${cormorant.className} min-w-0 truncate text-lg font-medium leading-tight text-zinc-100`}
          >
            {name}
          </p>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-3 pl-3.5">
          <p className={`min-w-0 truncate text-[11px] text-zinc-500 ${draft.active ? "" : "opacity-50"}`}>
            {sub}
            {code && <span className="ml-2 font-mono text-[10px] text-zinc-600">{code}</span>}
          </p>
          <span className="ml-auto shrink-0">
            <SaveBadge state={state} error={error} onRetry={retry} />
          </span>
        </div>
      </div>

      {/* контролы: ценз · баллы · множитель · итог · активность */}
      <div className="gam-dest-controls">
        <div className="gam-dest-tier min-w-0">
          <TierSwitch value={draft.tier} onChange={(next) => update({ tier: next })} />
        </div>

        <NumberInput
          value={draft.points}
          onChange={(v) => update({ points: v })}
          label={`${t.colPoints} · ${name}`}
          invalid={p === null}
          className="w-full min-w-0"
        />

        <NumberInput
          value={draft.multiplier}
          onChange={(v) => update({ multiplier: v })}
          label={`${t.colMultiplier} · ${name}`}
          decimal
          prefix="×"
          invalid={m === null || m <= 0}
          className="w-full min-w-0"
        />

        <p className="whitespace-nowrap text-right font-mono text-sm tabular-nums text-amber-200">
          {value === null ? "—" : `= ${value}`}
        </p>

        <div className="flex justify-center">
          <Toggle checked={draft.active} onChange={(next) => update({ active: next })} label={`${t.colActive} · ${name}`} />
        </div>
      </div>
    </li>
  );
});

function DestinationsPanel({
  destinations,
  extras,
  onSaved,
}: {
  destinations: DestinationConfig[];
  extras: ExtraDestination[];
  onSaved: (saved: SavedRow) => void;
}) {
  const { t, lang, nf } = useAdminI18n();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = (id: string, names: readonly string[]) =>
    !q || id.includes(q) || names.join(" ").toLowerCase().includes(q);

  // те же классы колонок, что у строк, — подписи стоят ровно над полями
  const header = (
    <div
      aria-hidden
      className="gam-dest-head mb-2 border border-transparent px-4 text-[9px] uppercase tracking-[0.2em] text-zinc-600"
    >
      <span className="gam-dest-head-name">{t.colDestination}</span>
      <div className="gam-dest-controls">
        <span className="pl-1">{t.colTier}</span>
        <span className="truncate text-right">{t.colPoints}</span>
        <span className="truncate text-right">{t.colMultiplier}</span>
        <span className="truncate text-right">{t.colValue}</span>
        <span />

      </div>
    </div>
  );

  const visibleExtras = extras.filter((x) => matches(x.id, [x.name]));

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search
            size={15}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchDestinations}
            aria-label={t.searchDestinations}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30"
          />
        </div>
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Sparkles size={13} strokeWidth={1.6} className="text-amber-200/60" />
          {t.autosaveHint}
        </p>
      </div>

      <style>{DEST_LAYOUT_CSS}</style>

      <div className="gam-dests space-y-10">
        {REGIONS.map((region, i) => {
          const all = destinations.filter((d) => d.region === region);
          const items = all.filter((d) => matches(d.id, PLACES[lang][d.id]));
          if (items.length === 0) return null;
          return (
            <section key={region}>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-xs text-amber-200/50">{i + 1}</span>
                <h3 className={`${cormorant.className} text-2xl italic text-zinc-200`}>{REGION_LABELS[lang][region]}</h3>
                <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
                <span className="font-mono text-[11px] tabular-nums text-zinc-600">
                  {nf.format(all.filter((d) => d.active).length)} / {nf.format(all.length)}
                </span>
              </div>
              {header}
              <ul className="space-y-2">
                {items.map((d) => (
                  <DestinationEditor
                    key={d.id}
                    id={d.id}
                    name={PLACES[lang][d.id][0]}
                    sub={PLACES[lang][d.id][1]}
                    code={d.code}
                    tier={d.tier}
                    points={d.points}
                    multiplier={d.multiplier}
                    active={d.active}
                    onSaved={onSaved}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {visibleExtras.length > 0 && (
          <section>
            <div className="mb-1 flex items-baseline gap-3">
              <AlertTriangle size={14} strokeWidth={1.6} className="translate-y-[2px] text-amber-300/70" />
              <h3 className={`${cormorant.className} text-2xl italic text-zinc-300`}>{t.outOfCatalog}</h3>
              <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
            </div>
            <p className="mb-3 text-xs text-zinc-500">{t.outOfCatalogHint}</p>
            <ul className="space-y-2">
              {visibleExtras.map((x) => (
                <DestinationEditor
                  key={x.id}
                  id={x.id}
                  name={x.name || x.id}
                  sub={x.id}
                  tier={x.tier}
                  points={x.points}
                  multiplier={x.multiplier}
                  active={x.active}
                  onSaved={onSaved}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3 · Легендарные комбо
 * ══════════════════════════════════════════════════════════════════ */

type ComboDraft = {
  title: string;
  ids: DestId[];
  required: number | null;
  bonus: string;
  active: boolean;
};

const ComboEditor = memo(function ComboEditor({
  combo,
  destinations,
  onSaved,
}: {
  combo: ComboConfig;
  destinations: DestinationConfig[];
  onSaved: (saved: SavedRow) => void;
}) {
  const { t, lang } = useAdminI18n();
  const Icon = COMBO_ICON[combo.icon];
  const byId = useMemo(() => new Map(destinations.map((d) => [d.id, d])), [destinations]);

  const source = useMemo<ComboDraft>(
    () => ({
      title: combo.title,
      ids: combo.ids,
      required: combo.required,
      bonus: String(combo.bonus),
      active: combo.active,
    }),
    [combo.title, combo.ids, combo.required, combo.bonus, combo.active],
  );

  const persist = useCallback(
    async (d: ComboDraft) => {
      const title = d.title.trim();
      const bonus = parseIntInput(d.bonus);
      if (!title || title.length > 80 || d.ids.length === 0 || bonus === null || bonus > 1_000_000) {
        throw new SaveRejected("invalid");
      }
      const required = d.required !== null && d.required >= 1 && d.required < d.ids.length ? d.required : null;

      const { data, error } = await supabase
        .from("game_combos")
        .update({ title, destination_ids: d.ids, required_count: required, bonus, active: d.active })
        .eq("id", combo.id)
        .select(COMBO_COLUMNS)
        .maybeSingle();
      if (error) throw rejectFrom(error);
      if (!data) throw new SaveRejected("rls");
      onSaved({ table: "game_combos", row: data as GameComboRow });
    },
    [combo.id, onSaved],
  );

  const { draft, update, state, error, retry } = useAutosave(source, persist);

  const len = draft.ids.length;
  const need = comboNeed(draft);
  const selected = useMemo(() => new Set<string>(draft.ids), [draft.ids]);
  const bonus = parseIntInput(draft.bonus);

  const removeId = (id: DestId) => {
    const ids = draft.ids.filter((x) => x !== id);
    update({ ids, required: draft.required !== null && draft.required >= ids.length ? null : draft.required });
  };

  const setNeed = (n: number) => update({ required: n >= len ? null : Math.max(1, n) });

  return (
    <article
      className={`flex flex-col rounded-2xl border p-5 transition-colors ${
        draft.active
          ? "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80"
          : "border-zinc-900 bg-zinc-950/60"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 ${
            draft.active ? "ring-amber-200/30" : "ring-zinc-800"
          }`}
          style={{
            background: draft.active
              ? "radial-gradient(circle at 32% 28%, #3a3424 0%, #1c1810 60%, #0d0b07 100%)"
              : "radial-gradient(circle at 32% 28%, #232323 0%, #131313 60%, #0a0a0a 100%)",
          }}
        >
          <Icon size={19} strokeWidth={1.2} className={draft.active ? "text-amber-200" : "text-zinc-600"} />
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            aria-label={t.campaignTitle}
            maxLength={80}
            className={`${cormorant.className} w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-medium text-zinc-100 transition-colors hover:border-zinc-800 focus:border-amber-200/30 focus:outline-none ${
              draft.title.trim() ? "" : "border-red-500/50"
            }`}
          />
          <p className="mt-1 px-1 text-xs italic leading-relaxed text-zinc-500">{COMBO_LORE[lang][combo.id]}</p>
        </div>

        <Toggle checked={draft.active} onChange={(next) => update({ active: next })} label={t.campaignActive} />
      </div>

      <div className="mt-5 pb-5">
        <SectionCaption>{t.composition}</SectionCaption>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {draft.ids.map((id) => {
            const d = byId.get(id);
            return (
              <span
                key={id}
                className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 text-[11px] ${
                  d?.active === false
                    ? "border-zinc-800 text-zinc-600 line-through"
                    : "border-zinc-700/80 bg-zinc-950/60 text-zinc-300"
                }`}
              >
                {d && <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[d.tier]}`} />}
                {nameOf(lang, id)}
                <button
                  type="button"
                  onClick={() => removeId(id)}
                  aria-label={t.removeDestination(nameOf(lang, id))}
                  className="rounded-full p-0.5 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/40"
                >
                  <X size={11} strokeWidth={2} />
                </button>
              </span>
            );
          })}
          <DestinationPicker
            destinations={destinations.filter((d) => d.active)}
            exclude={selected}
            onChange={(d) => update({ ids: [...draft.ids, d.id] })}
            variant="chip"
            align="left"
          />
        </div>
        {len === 0 && <p className="mt-2 text-[11px] text-amber-300">{t.emptyRoute}</p>}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-4 border-t border-zinc-800/70 pt-4">
        <div>
          <SectionCaption>{t.requirement}</SectionCaption>
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              aria-label={t.requirementLess}
              disabled={need <= 1}
              onClick={() => setNeed(need - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-30"
            >
              <Minus size={12} strokeWidth={2} />
            </button>
            <span className="min-w-[4rem] whitespace-nowrap text-center font-mono text-sm tabular-nums text-zinc-200">
              {t.requirementOf(need, len)}
            </span>
            <button
              type="button"
              aria-label={t.requirementMore}
              disabled={need >= len}
              onClick={() => setNeed(need + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-30"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </div>
          {len > 0 && need === len && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-600">{t.requirementAll}</p>
          )}
        </div>

        <div>
          <SectionCaption>{t.bonus}</SectionCaption>
          <NumberInput
            value={draft.bonus}
            onChange={(v) => update({ bonus: v })}
            label={`${t.bonus} · ${draft.title}`}
            prefix="+"
            invalid={bonus === null}
            className="mt-2 w-full"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <SaveBadge state={state} error={error} onRetry={retry} />
      </div>
    </article>
  );
});

function CombosPanel({
  combos,
  destinations,
  onSaved,
}: {
  combos: ComboConfig[];
  destinations: DestinationConfig[];
  onSaved: (saved: SavedRow) => void;
}) {
  const { t, nf } = useAdminI18n();
  const total = combos.filter((c) => c.active).reduce((s, c) => s + c.bonus, 0);

  return (
    <>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Trophy size={15} strokeWidth={1.5} className="text-amber-200/70" />
          {t.totalBonus(nf.format(total))}
        </p>
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Sparkles size={13} strokeWidth={1.6} className="text-amber-200/60" />
          {t.autosaveHint}
        </p>
      </div>
      {/* столько колонок, сколько помещается по ширине списка (карточка ≥ 21rem) */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 21rem), 1fr))" }}
      >
        {combos.map((c) => (
          <ComboEditor key={c.id} combo={c} destinations={destinations} onSaved={onSaved} />
        ))}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 4 · Уровни Circle
 * ══════════════════════════════════════════════════════════════════ */

type CircleDraft = { title: string; min: string };

const CircleEditor = memo(function CircleEditor({
  circle,
  prevMin,
  nextMin,
  count,
  total,
  onSaved,
}: {
  circle: CircleConfig;
  prevMin: number | null;
  nextMin: number | null;
  count: number;
  total: number;
  onSaved: (saved: SavedRow) => void;
}) {
  const { t, nf } = useAdminI18n();
  const entry = circle.level === 1;

  const source = useMemo<CircleDraft>(
    () => ({ title: circle.title, min: String(circle.min) }),
    [circle.title, circle.min],
  );

  const persist = useCallback(
    async (d: CircleDraft) => {
      const title = d.title.trim();
      const min = entry ? 0 : parseIntInput(d.min);
      if (!title || title.length > 40 || min === null) throw new SaveRejected("invalid");
      if (!entry && ((prevMin !== null && min <= prevMin) || (nextMin !== null && min >= nextMin))) {
        throw new SaveRejected("invalid", t.mustAscend);
      }
      const { data, error } = await supabase
        .from("game_circles")
        .update({ title, min_influence: min })
        .eq("level", circle.level)
        .select(CIRCLE_COLUMNS)
        .maybeSingle();
      if (error) throw rejectFrom(error);
      if (!data) throw new SaveRejected("rls");
      onSaved({ table: "game_circles", row: data as GameCircleRow });
    },
    [circle.level, entry, prevMin, nextMin, onSaved, t.mustAscend],
  );

  const { draft, update, state, error, retry } = useAutosave(source, persist);
  const share = total > 0 ? count / total : 0;
  const style = CIRCLE_STYLE[circle.key];

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_9rem_11rem_8rem] sm:px-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 ring-1 ${style.ring}`}
      >
        <span className={`${cormorant.className} text-lg font-semibold ${style.text}`}>
          {ROMAN[circle.level - 1]}
        </span>
      </div>

      <div className="min-w-0">
        <input
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          aria-label={`${t.circleTitle} · ${t.level} ${circle.level}`}
          maxLength={40}
          className={`${cormorant.className} w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-medium text-zinc-100 transition-colors hover:border-zinc-800 focus:border-amber-200/30 focus:outline-none`}
        />
        <p className="px-1 text-[10px] uppercase tracking-[0.25em] text-zinc-600">
          {t.level} {circle.level}
          {entry && ` · ${t.entryLevel}`}
        </p>
      </div>

      <div className="col-span-2 sm:col-span-1">
        <SectionCaption>{t.threshold}</SectionCaption>
        <NumberInput
          value={entry ? "0" : draft.min}
          onChange={(v) => update({ min: v })}
          label={`${t.threshold} · ${circle.title}`}
          disabled={entry}
          invalid={state === "invalid"}
          prefix="≥"
          className="mt-1.5 w-full"
        />
      </div>

      <div className="col-span-2 sm:col-span-1">
        <div className="flex items-baseline justify-between text-[10px] text-zinc-500">
          <span className="uppercase tracking-[0.2em]">{t.residentsAt}</span>
          <span className="font-mono tabular-nums text-zinc-300">{nf.format(count)}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${style.bar}`}
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1 sm:text-right">
        <SaveBadge state={state} error={error} onRetry={retry} />
        {state === "invalid" && error?.message && (
          <p className="mt-1 text-[10px] leading-snug text-amber-300/80">{error.message}</p>
        )}
      </div>
    </li>
  );
});

function CirclesPanel({
  circles,
  residents,
  onSaved,
}: {
  circles: CircleConfig[];
  residents: AdminResident[];
  onSaved: (saved: SavedRow) => void;
}) {
  const { t } = useAdminI18n();
  const counts = useMemo(() => {
    const m = new Map<CircleKey, number>();
    for (const r of residents) m.set(r.circleKey, (m.get(r.circleKey) ?? 0) + 1);
    return m;
  }, [residents]);

  return (
    <>
      <p className="mb-6 flex max-w-3xl items-start gap-2 text-sm leading-relaxed text-zinc-400">
        <Crown size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-amber-200/70" />
        {t.circlesHint}
      </p>
      <ol className="space-y-3">
        {circles.map((c, i) => (
          <CircleEditor
            key={c.level}
            circle={c}
            prevMin={i > 0 ? circles[i - 1].min : null}
            nextMin={i < circles.length - 1 ? circles[i + 1].min : null}
            count={counts.get(c.key) ?? 0}
            total={residents.length}
            onSaved={onSaved}
          />
        ))}
      </ol>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Корневой компонент
 * ══════════════════════════════════════════════════════════════════ */

export default function GamificationAdminClient({
  residents,
  destinations,
  extras,
  combos,
  circles,
  onSaved,
  onStamped,
  defaultTab = "residents",
}: {
  residents: AdminResident[];
  destinations: DestinationConfig[];
  extras: ExtraDestination[];
  combos: ComboConfig[];
  circles: CircleConfig[];
  onSaved: (saved: SavedRow) => void;
  onStamped?: (profileId: string) => void;
  defaultTab?: AdminTab;
}) {
  const { t, nf } = useAdminI18n();
  const [tab, setTab] = useState<AdminTab>(defaultTab);

  const tabs: Array<{ id: AdminTab; label: string; Icon: LucideIcon; count: number }> = [
    { id: "residents", label: t.tabResidents, Icon: Users, count: residents.length },
    { id: "destinations", label: t.tabDestinations, Icon: Globe, count: destinations.filter((d) => d.active).length },
    { id: "combos", label: t.tabCombos, Icon: Trophy, count: combos.filter((c) => c.active).length },
    { id: "circles", label: t.tabCircles, Icon: Crown, count: circles.length },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label={t.title}
        className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1"
      >
        {tabs.map(({ id, label, Icon, count }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`gam-tab-${id}`}
              aria-selected={active}
              aria-controls={`gam-panel-${id}`}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30 ${
                active
                  ? "bg-zinc-900 text-amber-200 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.14)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={15} strokeWidth={1.6} />
              {label}
              <span className={`font-mono text-[10px] ${active ? "text-amber-200/60" : "text-zinc-600"}`}>
                {nf.format(count)}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`gam-panel-${tab}`} aria-labelledby={`gam-tab-${tab}`}>
        {tab === "residents" && (
          <ResidentsPanel
            residents={residents}
            circles={circles}
            destinations={destinations}
            onStamped={onStamped}
          />
        )}
        {tab === "destinations" && (
          <DestinationsPanel destinations={destinations} extras={extras} onSaved={onSaved} />
        )}
        {tab === "combos" && <CombosPanel combos={combos} destinations={destinations} onSaved={onSaved} />}
        {tab === "circles" && <CirclesPanel circles={circles} residents={residents} onSaved={onSaved} />}
      </div>
    </>
  );
}
