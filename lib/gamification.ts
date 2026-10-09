/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · GAMIFICATION — единый источник правды
 * lib/gamification.ts
 *
 * Используется и страницей резидента, и админкой:
 *   • каталог из 54 направлений в 4 регионах и их названия на 4 языках;
 *   • визовые цензы и веса по умолчанию;
 *   • 9 легендарных комбо по умолчанию;
 *   • уровни Circle (1–6) и пороги по умолчанию;
 *   • формула Индекса глобального влияния.
 *
 * Канонический расчёт Индекса живёт в БД: game_base_influence (штампы +
 * комбо + баллы туров) и v_global_leaderboard (+ дивиденды патронажа) —
 * миграции 20261008_gamification_v2, 20261009_club_invites и
 * 20261014_tour_points_influence. computeStanding() ниже — точное зеркало
 * штампов и комбо для мгновенного отклика интерфейса; баллы туров
 * (tour_points) и патронаж (patronage_points) приходят из вью.
 * Меняешь формулу в одном месте — меняй и в другом.
 *
 *   вес штампа = round(points × multiplier × фактор визита)
 *     points / multiplier — свои у штампа, иначе у направления
 *     фактор визита: 1-й ×1 · 2-й ×1.5 · 3-й и далее ×2
 *   Индекс     = Σ веса штампов (только активные направления)
 *              + Σ бонусы собранных комбо
 *              + баллы туров × множитель (только во вью, game_scoring_rules)
 *              + дивиденды патронажа (только во вью, см. lib/patronage.ts)
 *   Circle     = самый высокий уровень, чей порог ≤ Индекса
 * ──────────────────────────────────────────────────────────────────── */

/* ── Языки ───────────────────────────────────────────────────────── */

export const LANGS = ["en", "ru", "es", "pt"] as const;
export type Lang = (typeof LANGS)[number];

/** "ru", "RU", "ru-RU" → "ru"; всё прочее → "en" */
export function normalizeLang(raw: unknown): Lang {
  const code = typeof raw === "string" ? raw.slice(0, 2).toLowerCase() : "";
  return (LANGS as readonly string[]).includes(code) ? (code as Lang) : "en";
}

/* ── Визовые цензы ───────────────────────────────────────────────── */

export type Tier = "free" | "evisa" | "hard";
export const TIER_ORDER: Tier[] = ["free", "evisa", "hard"];

/** Бренд-названия (одинаковы во всех языках) и веса по умолчанию */
export const TIERS: Record<Tier, { label: string; short: string; points: number; multiplier: number }> = {
  free: { label: "Visa-Free · ETA", short: "Visa-free", points: 100, multiplier: 1 },
  evisa: { label: "E-Visa · On Arrival", short: "E-visa", points: 250, multiplier: 1 },
  hard: { label: "Consular Clearance", short: "Consular", points: 600, multiplier: 2 },
};

export const isTier = (v: unknown): v is Tier => typeof v === "string" && v in TIERS;

/* ── Регионы ─────────────────────────────────────────────────────── */

export type RegionId = "mideast" | "asia" | "europe" | "namerica";
export const REGIONS: RegionId[] = ["mideast", "asia", "europe", "namerica"];

export const REGION_LABELS: Record<Lang, Record<RegionId, string>> = {
  en: {
    mideast: "Middle East, Caucasus & Cyprus",
    asia: "Asia & Oceania",
    europe: "Europe",
    namerica: "North America",
  },
  ru: {
    mideast: "Ближний Восток, Кавказ и Кипр",
    asia: "Азия и Океания",
    europe: "Европа",
    namerica: "Северная Америка",
  },
  es: {
    mideast: "Oriente Medio, Cáucaso y Chipre",
    asia: "Asia y Oceanía",
    europe: "Europa",
    namerica: "Norteamérica",
  },
  pt: {
    mideast: "Oriente Médio, Cáucaso e Chipre",
    asia: "Ásia e Oceania",
    europe: "Europa",
    namerica: "América do Norte",
  },
};

/* ── Каталог направлений: порядок здесь = порядок везде ──────────── */

export const CATALOG = [
  // 1 · Ближний Восток, Кавказ и Кипр
  { id: "saudi", region: "mideast", tier: "evisa", code: "RUH · K.S.A." },
  { id: "bahrain", region: "mideast", tier: "evisa", code: "BAH · BAHRAIN" },
  { id: "dubai", region: "mideast", tier: "free", code: "DXB · U.A.E." },
  { id: "lebanon", region: "mideast", tier: "evisa", code: "BEY · LEBANON" },
  { id: "jordan", region: "mideast", tier: "evisa", code: "AMM · JORDAN" },
  { id: "israel", region: "mideast", tier: "free", code: "TLV · ISRAEL" },
  { id: "egypt", region: "mideast", tier: "evisa", code: "CAI · EGYPT" },
  { id: "turkey", region: "mideast", tier: "free", code: "IST · TÜRKİYE" },
  { id: "georgia", region: "mideast", tier: "free", code: "TBS · GEORGIA" },
  { id: "armenia", region: "mideast", tier: "free", code: "EVN · ARMENIA" },
  { id: "cyprus_greek", region: "mideast", tier: "hard", code: "LCA · CYPRUS" },
  { id: "cyprus_turkish", region: "mideast", tier: "free", code: "ECN · CYPRUS" },
  // 2 · Азия и Океания
  { id: "south_korea", region: "asia", tier: "free", code: "ICN · KOREA" },
  { id: "china", region: "asia", tier: "evisa", code: "PVG · CHINA" },
  { id: "cambodia", region: "asia", tier: "evisa", code: "SAI · E-VISA" },
  { id: "malaysia", region: "asia", tier: "free", code: "KUL · MALAYSIA" },
  { id: "vietnam", region: "asia", tier: "evisa", code: "DAD · E-VISA" },
  { id: "macau", region: "asia", tier: "free", code: "MFM · MACAU" },
  { id: "phuket", region: "asia", tier: "free", code: "HKT · THAILAND" },
  { id: "pattaya", region: "asia", tier: "free", code: "UTP · THAILAND" },
  { id: "bangkok", region: "asia", tier: "free", code: "BKK · THAILAND" },
  { id: "bali", region: "asia", tier: "evisa", code: "DPS · INDONESIA" },
  { id: "australia", region: "asia", tier: "hard", code: "SYD · AUSTRALIA" },
  // 3 · Европа
  { id: "paris", region: "europe", tier: "hard", code: "CDG · SCHENGEN" },
  { id: "nice", region: "europe", tier: "hard", code: "NCE · SCHENGEN" },
  { id: "monaco", region: "europe", tier: "hard", code: "MCM · MONACO" },
  { id: "london", region: "europe", tier: "hard", code: "LHR · U.K." },
  { id: "latvia", region: "europe", tier: "hard", code: "RIX · SCHENGEN" },
  { id: "lithuania", region: "europe", tier: "hard", code: "VNO · SCHENGEN" },
  { id: "estonia", region: "europe", tier: "hard", code: "TLL · SCHENGEN" },
  { id: "germany", region: "europe", tier: "hard", code: "BER · SCHENGEN" },
  { id: "italy", region: "europe", tier: "hard", code: "FCO · SCHENGEN" },
  { id: "switzerland", region: "europe", tier: "hard", code: "ZRH · SCHENGEN" },
  { id: "spain", region: "europe", tier: "hard", code: "BCN · SCHENGEN" },
  { id: "greece", region: "europe", tier: "hard", code: "ATH · SCHENGEN" },
  { id: "belgium", region: "europe", tier: "hard", code: "BRU · SCHENGEN" },
  { id: "norway", region: "europe", tier: "hard", code: "OSL · SCHENGEN" },
  { id: "sweden", region: "europe", tier: "hard", code: "ARN · SCHENGEN" },
  { id: "denmark", region: "europe", tier: "hard", code: "CPH · SCHENGEN" },
  { id: "czechia", region: "europe", tier: "hard", code: "PRG · SCHENGEN" },
  { id: "albania", region: "europe", tier: "free", code: "TIA · ALBANIA" },
  { id: "bosnia", region: "europe", tier: "free", code: "SJJ · B&H" },
  { id: "serbia", region: "europe", tier: "free", code: "BEG · SERBIA" },
  { id: "montenegro", region: "europe", tier: "free", code: "TIV · MONTENEGRO" },
  // 4 · Северная Америка
  { id: "toronto", region: "namerica", tier: "hard", code: "YYZ · CANADA" },
  { id: "vancouver", region: "namerica", tier: "hard", code: "YVR · CANADA" },
  { id: "seattle", region: "namerica", tier: "hard", code: "SEA · U.S.A." },
  { id: "portland", region: "namerica", tier: "hard", code: "PDX · U.S.A." },
  { id: "philadelphia", region: "namerica", tier: "hard", code: "PHL · U.S.A." },
  { id: "washington", region: "namerica", tier: "hard", code: "IAD · U.S.A." },
  { id: "los_angeles", region: "namerica", tier: "hard", code: "LAX · U.S.A." },
  { id: "la_coast", region: "namerica", tier: "hard", code: "LAX · PACIFIC" },
  { id: "san_diego", region: "namerica", tier: "hard", code: "SAN · U.S.A." },
  { id: "san_francisco", region: "namerica", tier: "hard", code: "SFO · U.S.A." },
] as const satisfies ReadonlyArray<{ id: string; region: RegionId; tier: Tier; code: string }>;

export type DestId = (typeof CATALOG)[number]["id"];

const DEST_IDS = new Set<string>(CATALOG.map((d) => d.id));
export const isDestId = (id: unknown): id is DestId => typeof id === "string" && DEST_IDS.has(id);

/* ── Названия: [имя на карточке и штампе, подпись] ──────────────── */

export const PLACES: Record<Lang, Record<DestId, readonly [string, string]>> = {
  en: {
    saudi: ["Saudi Arabia", "Riyadh"],
    bahrain: ["Bahrain", "Manama"],
    dubai: ["Dubai", "UAE"],
    lebanon: ["Lebanon", "Beirut"],
    jordan: ["Jordan", "Amman · Petra"],
    israel: ["Israel", "Tel Aviv"],
    egypt: ["Egypt", "Cairo"],
    turkey: ["Türkiye", "Istanbul"],
    georgia: ["Georgia", "Tbilisi"],
    armenia: ["Armenia", "Yerevan"],
    cyprus_greek: ["Cyprus", "Greek side"],
    cyprus_turkish: ["Cyprus", "Turkish side"],
    south_korea: ["South Korea", "Seoul"],
    china: ["China", "Shanghai · Beijing"],
    cambodia: ["Cambodia", "Siem Reap"],
    malaysia: ["Malaysia", "Kuala Lumpur"],
    vietnam: ["Vietnam", "Da Nang · Hoi An"],
    macau: ["Macau", "Cotai"],
    phuket: ["Phuket", "Thailand"],
    pattaya: ["Pattaya", "Thailand"],
    bangkok: ["Bangkok", "Thailand"],
    bali: ["Bali", "Indonesia"],
    australia: ["Australia", "Sydney"],
    paris: ["Paris", "France · Schengen"],
    nice: ["Nice", "Côte d'Azur · Schengen"],
    monaco: ["Monaco", "Principality"],
    london: ["London", "United Kingdom"],
    latvia: ["Riga", "Latvia · Schengen"],
    lithuania: ["Vilnius", "Lithuania · Schengen"],
    estonia: ["Tallinn", "Estonia · Schengen"],
    germany: ["Berlin", "Germany · Schengen"],
    italy: ["Italy", "Rome · Schengen"],
    switzerland: ["Switzerland", "Zurich · Schengen"],
    spain: ["Spain", "Barcelona · Schengen"],
    greece: ["Athens", "Greece · Schengen"],
    belgium: ["Brussels", "Belgium · Schengen"],
    norway: ["Oslo", "Norway · Schengen"],
    sweden: ["Stockholm", "Sweden · Schengen"],
    denmark: ["Copenhagen", "Denmark · Schengen"],
    czechia: ["Prague", "Czechia · Schengen"],
    albania: ["Albania", "Tirana"],
    bosnia: ["Sarajevo", "Bosnia and Herzegovina"],
    serbia: ["Belgrade", "Serbia"],
    montenegro: ["Budva", "Montenegro"],
    toronto: ["Toronto", "Canada"],
    vancouver: ["Vancouver", "Canada"],
    seattle: ["Seattle", "USA"],
    portland: ["Portland", "USA"],
    philadelphia: ["Philadelphia", "USA"],
    washington: ["Washington", "USA · D.C."],
    los_angeles: ["Los Angeles", "USA"],
    la_coast: ["LA Coast", "Malibu · Santa Monica"],
    san_diego: ["San Diego", "USA"],
    san_francisco: ["San Francisco", "USA"],
  },
  ru: {
    saudi: ["Саудовская Аравия", "Эр-Рияд"],
    bahrain: ["Бахрейн", "Манама"],
    dubai: ["Дубай", "ОАЭ"],
    lebanon: ["Ливан", "Бейрут"],
    jordan: ["Иордания", "Амман · Петра"],
    israel: ["Израиль", "Тель-Авив"],
    egypt: ["Египет", "Каир"],
    turkey: ["Турция", "Стамбул"],
    georgia: ["Грузия", "Тбилиси"],
    armenia: ["Армения", "Ереван"],
    cyprus_greek: ["Кипр", "Греческая часть"],
    cyprus_turkish: ["Кипр", "Турецкая часть"],
    south_korea: ["Южная Корея", "Сеул"],
    china: ["Китай", "Шанхай · Пекин"],
    cambodia: ["Камбоджа", "Сием-Реап"],
    malaysia: ["Малайзия", "Куала-Лумпур"],
    vietnam: ["Вьетнам", "Дананг · Хойан"],
    macau: ["Макао", "Котай"],
    phuket: ["Пхукет", "Таиланд"],
    pattaya: ["Паттайя", "Таиланд"],
    bangkok: ["Бангкок", "Таиланд"],
    bali: ["Бали", "Индонезия"],
    australia: ["Австралия", "Сидней"],
    paris: ["Париж", "Франция · Шенген"],
    nice: ["Ницца", "Лазурный берег · Шенген"],
    monaco: ["Монако", "Княжество"],
    london: ["Лондон", "Великобритания"],
    latvia: ["Рига", "Латвия · Шенген"],
    lithuania: ["Вильнюс", "Литва · Шенген"],
    estonia: ["Таллинн", "Эстония · Шенген"],
    germany: ["Берлин", "Германия · Шенген"],
    italy: ["Италия", "Рим · Шенген"],
    switzerland: ["Швейцария", "Цюрих · Шенген"],
    spain: ["Испания", "Барселона · Шенген"],
    greece: ["Афины", "Греция · Шенген"],
    belgium: ["Брюссель", "Бельгия · Шенген"],
    norway: ["Осло", "Норвегия · Шенген"],
    sweden: ["Стокгольм", "Швеция · Шенген"],
    denmark: ["Копенгаген", "Дания · Шенген"],
    czechia: ["Прага", "Чехия · Шенген"],
    albania: ["Албания", "Тирана"],
    bosnia: ["Сараево", "Босния и Герцеговина"],
    serbia: ["Белград", "Сербия"],
    montenegro: ["Будва", "Черногория"],
    toronto: ["Торонто", "Канада"],
    vancouver: ["Ванкувер", "Канада"],
    seattle: ["Сиэтл", "США"],
    portland: ["Портленд", "США"],
    philadelphia: ["Филадельфия", "США"],
    washington: ["Вашингтон", "США · округ Колумбия"],
    los_angeles: ["Лос-Анджелес", "США"],
    la_coast: ["Побережье LA", "Малибу · Санта-Моника"],
    san_diego: ["Сан-Диего", "США"],
    san_francisco: ["Сан-Франциско", "США"],
  },
  es: {
    saudi: ["Arabia Saudí", "Riad"],
    bahrain: ["Baréin", "Manama"],
    dubai: ["Dubái", "EAU"],
    lebanon: ["Líbano", "Beirut"],
    jordan: ["Jordania", "Amán · Petra"],
    israel: ["Israel", "Tel Aviv"],
    egypt: ["Egipto", "El Cairo"],
    turkey: ["Turquía", "Estambul"],
    georgia: ["Georgia", "Tiflis"],
    armenia: ["Armenia", "Ereván"],
    cyprus_greek: ["Chipre", "Parte griega"],
    cyprus_turkish: ["Chipre", "Parte turca"],
    south_korea: ["Corea del Sur", "Seúl"],
    china: ["China", "Shanghái · Pekín"],
    cambodia: ["Camboya", "Siem Reap"],
    malaysia: ["Malasia", "Kuala Lumpur"],
    vietnam: ["Vietnam", "Da Nang · Hoi An"],
    macau: ["Macao", "Cotai"],
    phuket: ["Phuket", "Tailandia"],
    pattaya: ["Pattaya", "Tailandia"],
    bangkok: ["Bangkok", "Tailandia"],
    bali: ["Bali", "Indonesia"],
    australia: ["Australia", "Sídney"],
    paris: ["París", "Francia · Schengen"],
    nice: ["Niza", "Costa Azul · Schengen"],
    monaco: ["Mónaco", "Principado"],
    london: ["Londres", "Reino Unido"],
    latvia: ["Riga", "Letonia · Schengen"],
    lithuania: ["Vilna", "Lituania · Schengen"],
    estonia: ["Tallin", "Estonia · Schengen"],
    germany: ["Berlín", "Alemania · Schengen"],
    italy: ["Italia", "Roma · Schengen"],
    switzerland: ["Suiza", "Zúrich · Schengen"],
    spain: ["España", "Barcelona · Schengen"],
    greece: ["Atenas", "Grecia · Schengen"],
    belgium: ["Bruselas", "Bélgica · Schengen"],
    norway: ["Oslo", "Noruega · Schengen"],
    sweden: ["Estocolmo", "Suecia · Schengen"],
    denmark: ["Copenhague", "Dinamarca · Schengen"],
    czechia: ["Praga", "Chequia · Schengen"],
    albania: ["Albania", "Tirana"],
    bosnia: ["Sarajevo", "Bosnia y Herzegovina"],
    serbia: ["Belgrado", "Serbia"],
    montenegro: ["Budva", "Montenegro"],
    toronto: ["Toronto", "Canadá"],
    vancouver: ["Vancouver", "Canadá"],
    seattle: ["Seattle", "EE. UU."],
    portland: ["Portland", "EE. UU."],
    philadelphia: ["Filadelfia", "EE. UU."],
    washington: ["Washington", "EE. UU. · D. C."],
    los_angeles: ["Los Ángeles", "EE. UU."],
    la_coast: ["Costa de L. A.", "Malibú · Santa Mónica"],
    san_diego: ["San Diego", "EE. UU."],
    san_francisco: ["San Francisco", "EE. UU."],
  },
  pt: {
    saudi: ["Arábia Saudita", "Riad"],
    bahrain: ["Bahrein", "Manama"],
    dubai: ["Dubai", "EAU"],
    lebanon: ["Líbano", "Beirute"],
    jordan: ["Jordânia", "Amã · Petra"],
    israel: ["Israel", "Tel Aviv"],
    egypt: ["Egito", "Cairo"],
    turkey: ["Turquia", "Istambul"],
    georgia: ["Geórgia", "Tbilisi"],
    armenia: ["Armênia", "Erevan"],
    cyprus_greek: ["Chipre", "Parte grega"],
    cyprus_turkish: ["Chipre", "Parte turca"],
    south_korea: ["Coreia do Sul", "Seul"],
    china: ["China", "Xangai · Pequim"],
    cambodia: ["Camboja", "Siem Reap"],
    malaysia: ["Malásia", "Kuala Lumpur"],
    vietnam: ["Vietnã", "Da Nang · Hoi An"],
    macau: ["Macau", "Cotai"],
    phuket: ["Phuket", "Tailândia"],
    pattaya: ["Pattaya", "Tailândia"],
    bangkok: ["Bangkok", "Tailândia"],
    bali: ["Bali", "Indonésia"],
    australia: ["Austrália", "Sydney"],
    paris: ["Paris", "França · Schengen"],
    nice: ["Nice", "Côte d'Azur · Schengen"],
    monaco: ["Mônaco", "Principado"],
    london: ["Londres", "Reino Unido"],
    latvia: ["Riga", "Letônia · Schengen"],
    lithuania: ["Vilnius", "Lituânia · Schengen"],
    estonia: ["Tallinn", "Estônia · Schengen"],
    germany: ["Berlim", "Alemanha · Schengen"],
    italy: ["Itália", "Roma · Schengen"],
    switzerland: ["Suíça", "Zurique · Schengen"],
    spain: ["Espanha", "Barcelona · Schengen"],
    greece: ["Atenas", "Grécia · Schengen"],
    belgium: ["Bruxelas", "Bélgica · Schengen"],
    norway: ["Oslo", "Noruega · Schengen"],
    sweden: ["Estocolmo", "Suécia · Schengen"],
    denmark: ["Copenhague", "Dinamarca · Schengen"],
    czechia: ["Praga", "Tchéquia · Schengen"],
    albania: ["Albânia", "Tirana"],
    bosnia: ["Sarajevo", "Bósnia e Herzegovina"],
    serbia: ["Belgrado", "Sérvia"],
    montenegro: ["Budva", "Montenegro"],
    toronto: ["Toronto", "Canadá"],
    vancouver: ["Vancouver", "Canadá"],
    seattle: ["Seattle", "EUA"],
    portland: ["Portland", "EUA"],
    philadelphia: ["Filadélfia", "EUA"],
    washington: ["Washington", "EUA · D.C."],
    los_angeles: ["Los Angeles", "EUA"],
    la_coast: ["Litoral de LA", "Malibu · Santa Monica"],
    san_diego: ["San Diego", "EUA"],
    san_francisco: ["São Francisco", "EUA"],
  },
};

/* ── Легендарные комбо по умолчанию (БД переопределяет) ──────────── */

export type ComboIcon =
  | "moon"
  | "mountain"
  | "compass"
  | "anchor"
  | "sun"
  | "gem"
  | "crown"
  | "landmark"
  | "waves";

export const COMBO_DEFAULTS = [
  { id: "siam-trilogy", title: "Siam Trilogy", ids: ["bangkok", "pattaya", "phuket"], bonus: 400, icon: "moon" },
  {
    id: "crossroads-of-empires",
    title: "Crossroads of Empires",
    ids: ["turkey", "georgia", "armenia"],
    bonus: 500,
    icon: "mountain",
  },
  { id: "silk-road", title: "The Silk Road E-Visa", ids: ["cambodia", "vietnam", "bali"], bonus: 800, icon: "compass" },
  { id: "divided-island", title: "The Divided Island", ids: ["cyprus_greek", "cyprus_turkish"], bonus: 900, icon: "anchor" },
  { id: "desert-kingdoms", title: "The Desert Kingdoms", ids: ["saudi", "bahrain", "jordan"], bonus: 1000, icon: "sun" },
  { id: "baltic-amber", title: "Baltic Amber", ids: ["latvia", "lithuania", "estonia"], bonus: 1800, icon: "gem" },
  {
    id: "schengen-sovereign",
    title: "The Schengen Sovereign",
    ids: ["paris", "nice", "monaco", "italy"],
    bonus: 2000,
    icon: "crown",
  },
  {
    id: "anglosphere-elite",
    title: "Anglosphere Elite",
    ids: ["london", "australia", "toronto", "los_angeles"],
    bonus: 3000,
    icon: "landmark",
  },
  {
    id: "pacific-coast",
    title: "Pacific Coast Highway",
    ids: ["seattle", "portland", "san_francisco", "la_coast", "los_angeles", "san_diego"],
    bonus: 3500,
    icon: "waves",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  ids: readonly DestId[];
  bonus: number;
  icon: ComboIcon;
}>;

export type ComboId = (typeof COMBO_DEFAULTS)[number]["id"];

const COMBO_IDS = new Set<string>(COMBO_DEFAULTS.map((c) => c.id));
export const isComboId = (id: unknown): id is ComboId => typeof id === "string" && COMBO_IDS.has(id);

export const COMBO_LORE: Record<Lang, Record<ComboId, string>> = {
  en: {
    "siam-trilogy": "The capital, the night Riviera and the islands — three faces of Siam",
    "crossroads-of-empires": "The Bosphorus, Tbilisi and Yerevan — where empires once met",
    "silk-road": "The Silk Road, assembled one e-visa at a time",
    "divided-island": "One island, two borders — cross both sides of Cyprus",
    "desert-kingdoms": "Three desert monarchies — three royal invitations",
    "baltic-amber": "Three amber capitals on the northern edge of Schengen",
    "schengen-sovereign": "Conquer the heart of the Old World with a single visa dossier",
    "anglosphere-elite": "The world's four most exacting consulates — cleared",
    "pacific-coast": "The Pacific Coast Highway, Seattle to San Diego, on a single visa",
  },
  ru: {
    "siam-trilogy": "Столица, ночная Ривьера и острова — три лица Сиама",
    "crossroads-of-empires": "Босфор, Тбилиси и Ереван — там, где сходились империи",
    "silk-road": "Шёлковый путь, собранный по электронным визам",
    "divided-island": "Один остров, две границы — пройти обе стороны Кипра",
    "desert-kingdoms": "Три монархии пустыни — три королевских приглашения",
    "baltic-amber": "Три янтарные столицы на северном краю Шенгена",
    "schengen-sovereign": "Покорить сердце Старого Света одним визовым досье",
    "anglosphere-elite": "Четыре самых придирчивых консульства мира — пройдены",
    "pacific-coast": "Тихоокеанское шоссе от Сиэтла до Сан-Диего — по одной визе",
  },
  es: {
    "siam-trilogy": "La capital, la Riviera nocturna y las islas: tres rostros de Siam",
    "crossroads-of-empires": "El Bósforo, Tiflis y Ereván: donde se cruzaban los imperios",
    "silk-road": "La Ruta de la Seda, trazada visado electrónico a visado electrónico",
    "divided-island": "Una isla, dos fronteras: cruzar ambos lados de Chipre",
    "desert-kingdoms": "Tres monarquías del desierto, tres invitaciones reales",
    "baltic-amber": "Tres capitales de ámbar en el borde norte de Schengen",
    "schengen-sovereign": "Conquistar el corazón del Viejo Mundo con un solo expediente de visado",
    "anglosphere-elite": "Los cuatro consulados más exigentes del mundo, superados",
    "pacific-coast": "La Pacific Coast Highway, de Seattle a San Diego, con un solo visado",
  },
  pt: {
    "siam-trilogy": "A capital, a Riviera noturna e as ilhas — três faces do Sião",
    "crossroads-of-empires": "O Bósforo, Tbilisi e Erevan — onde os impérios se cruzavam",
    "silk-road": "A Rota da Seda, montada visto eletrônico a visto eletrônico",
    "divided-island": "Uma ilha, duas fronteiras — atravessar os dois lados de Chipre",
    "desert-kingdoms": "Três monarquias do deserto — três convites reais",
    "baltic-amber": "Três capitais de âmbar no limite norte de Schengen",
    "schengen-sovereign": "Conquistar o coração do Velho Mundo com um único dossiê de visto",
    "anglosphere-elite": "Os quatro consulados mais exigentes do mundo — superados",
    "pacific-coast": "A Pacific Coast Highway, de Seattle a San Diego, com um único visto",
  },
};

/* ── Уровни Circle (пороги по умолчанию; БД переопределяет) ──────── */

export const CIRCLES = [
  { level: 1, key: "voyager", title: "Voyager", min: 0 },
  { level: 2, key: "resident", title: "Resident", min: 1000 },
  { level: 3, key: "preferred", title: "Preferred", min: 3000 },
  { level: 4, key: "inner", title: "Inner Circle", min: 7500 },
  { level: 5, key: "private", title: "Private Circle", min: 15000 },
  { level: 6, key: "black", title: "Black Circle", min: 30000 },
] as const;

export type CircleKey = (typeof CIRCLES)[number]["key"];

/** "inner_circle", "Inner Circle", "INNER-CIRCLE", "inner" → "inner" */
export function normalizeCircleKey(raw: unknown): CircleKey | null {
  if (typeof raw !== "string") return null;
  const key = raw
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/circle$/, "");
  return CIRCLES.some((c) => c.key === key) ? (key as CircleKey) : null;
}

/* ── Строки БД ───────────────────────────────────────────────────── */

type Num = number | string | null | undefined;

export type GameDestinationRow = {
  id: string;
  name?: string | null;
  region?: string | null;
  visa_tier?: string | null;
  points?: Num;
  multiplier?: Num;
  active?: boolean | null;
  sort_order?: number | null;
};

export type GameComboRow = {
  id: string;
  title?: string | null;
  destination_ids?: string[] | null;
  required_count?: number | null;
  bonus?: Num;
  active?: boolean | null;
  sort_order?: number | null;
};

export type GameCircleRow = {
  level: number;
  key?: string | null;
  title?: string | null;
  min_influence?: Num;
};

export type AttendanceRow = {
  destination_id: string;
  visit_number?: number | null;
  points?: Num;
  multiplier?: Num;
  stamped_at?: string | null;
};

export type LeaderboardRow = {
  profile_id: string;
  total_influence?: Num;
  rank_title?: string | null;
  level?: number | null;
  circle_key?: string | null;
  next_level_at?: Num;
  stamp_points?: Num;
  combo_points?: Num;
  stamps_count?: Num;
  destinations_count?: Num;
  combos_completed?: Num;
  position?: Num;
  full_name?: string | null;
  avatar_url?: string | null;
  /** дивиденды поручительницы (миграция club_invites) — уже внутри total_influence */
  patronage_points?: Num;
  proteges_count?: Num;
  /** баллы всех туров × множитель (миграция 20261014) — уже внутри total_influence */
  tour_points?: Num;
  tours_count?: Num;
};

/* ── Итоговая конфигурация (каталог + БД) ────────────────────────── */

export type DestinationConfig = {
  id: DestId;
  region: RegionId;
  code: string;
  tier: Tier;
  points: number;
  multiplier: number;
  active: boolean;
  order: number;
};

export type ComboConfig = {
  id: ComboId;
  title: string;
  ids: DestId[];
  /** сколько направлений нужно собрать; null — все */
  required: number | null;
  bonus: number;
  active: boolean;
  order: number;
  icon: ComboIcon;
};

export type CircleConfig = {
  level: number;
  key: CircleKey;
  title: string;
  min: number;
};

/* ── Утилиты ─────────────────────────────────────────────────────── */

/** Число из БД: number или числовая строка (numeric в Postgres приходит строкой) */
export function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** 12450 → "12 450" (узкий неразрывный пробел — одинаково во всех языках) */
export function fmtPoints(n: number) {
  const sign = n < 0 ? "−" : "";
  return sign + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function placeName(lang: Lang, id: DestId) {
  return PLACES[lang][id][0];
}

/* ── Слияние каталога с БД ───────────────────────────────────────── */

/** rows пустой или не передан — работают значения по умолчанию */
export function resolveDestinations(rows?: GameDestinationRow[] | null): DestinationConfig[] {
  const hasDb = Boolean(rows && rows.length);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return CATALOG.map((d, order) => {
    const row = byId.get(d.id);
    const rawTier = row?.visa_tier;
    const tier: Tier = isTier(rawTier) ? rawTier : d.tier;
    return {
      id: d.id,
      region: d.region,
      code: d.code,
      tier,
      points: num(row?.points) ?? TIERS[tier].points,
      multiplier: num(row?.multiplier) ?? TIERS[tier].multiplier,
      // строки нет в БД — штамп туда не поставить, значит направление неактивно
      active: hasDb ? Boolean(row) && row?.active !== false : true,
      order,
    };
  });
}

export function resolveCombos(rows?: GameComboRow[] | null): ComboConfig[] {
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return COMBO_DEFAULTS.map((c, i) => {
    const row = byId.get(c.id);
    const ids = row?.destination_ids
      ? [...new Set(row.destination_ids.filter(isDestId))]
      : [...c.ids];
    const req = row?.required_count;
    return {
      id: c.id,
      title: row?.title?.trim() || c.title,
      ids,
      required: typeof req === "number" && req >= 1 && req < ids.length ? Math.floor(req) : null,
      bonus: Math.max(0, Math.round(num(row?.bonus) ?? c.bonus)),
      active: row ? row.active !== false : true,
      order: typeof row?.sort_order === "number" ? row.sort_order : i + 1,
      icon: c.icon,
    };
  }).sort((a, b) => a.order - b.order);
}

export function resolveCircles(rows?: GameCircleRow[] | null): CircleConfig[] {
  const byLevel = new Map((rows ?? []).map((r) => [r.level, r]));
  return CIRCLES.map((c) => {
    const row = byLevel.get(c.level);
    return {
      level: c.level,
      key: c.key,
      title: row?.title?.trim() || c.title,
      min: c.level === 1 ? 0 : Math.max(0, Math.round(num(row?.min_influence) ?? c.min)),
    };
  });
}

/* ── Формула Индекса (зеркало SQL-вью) ───────────────────────────── */

/** 1-й визит ×1 · 2-й ×1.5 · 3-й и далее ×2 */
export function visitFactor(visitNumber: number | null | undefined) {
  if (!visitNumber || visitNumber <= 1) return 1;
  if (visitNumber === 2) return 1.5;
  return 2;
}

export type StampInput = {
  destinationId: string;
  /** порядковый номер визита в это направление; нет — посчитается по порядку */
  visitNumber?: number | null;
  /** свой вес штампа (перекрывает вес направления) */
  points?: Num;
  multiplier?: Num;
  date?: string | null;
};

/**
 * Вес штампа. Считается в целых сотых, чтобы округление совпадало с
 * Postgres round(numeric) до единицы (половина — от нуля).
 */
export function stampValue(
  dest: Pick<DestinationConfig, "points" | "multiplier">,
  stamp: Pick<StampInput, "points" | "multiplier" | "visitNumber">,
) {
  const points = Math.max(0, Math.round(num(stamp.points) ?? dest.points));
  const mult100 = Math.max(0, Math.round((num(stamp.multiplier) ?? dest.multiplier) * 100));
  const factor2 = Math.round(visitFactor(stamp.visitNumber) * 2); // 2 · 3 · 4
  const scaled = points * mult100 * factor2; // = вес × 200
  return Math.floor((scaled + 100) / 200);
}

export function circleFor(index: number, circles: CircleConfig[]): CircleConfig {
  const sorted = [...circles].sort((a, b) => a.min - b.min || a.level - b.level);
  let current = sorted[0];
  for (const c of sorted) if (c.min <= index) current = c;
  return current;
}

export function nextCircle(index: number, circles: CircleConfig[]): CircleConfig | null {
  return [...circles].sort((a, b) => a.min - b.min).find((c) => c.min > index) ?? null;
}

/** Сколько направлений комбо нужно собрать */
export const comboNeed = (c: Pick<ComboConfig, "ids" | "required">) =>
  Math.min(c.required ?? c.ids.length, c.ids.length);

export type Standing = {
  index: number;
  stampPoints: number;
  comboPoints: number;
  stampsCount: number;
  destinationsCount: number;
  visited: ReadonlySet<DestId>;
  /** вес каждого штампа в порядке входа (0 — направление выключено) */
  values: number[];
  byTier: Record<Tier, number>;
  completedCombos: ComboId[];
  circle: CircleConfig;
  next: CircleConfig | null;
};

/** stamps — в хронологическом порядке */
export function computeStanding(
  stamps: StampInput[],
  destinations: DestinationConfig[],
  combos: ComboConfig[],
  circles: CircleConfig[],
): Standing {
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const visits = new Map<string, number>();
  const visited = new Set<DestId>();
  let stampPoints = 0;
  let stampsCount = 0;

  const values = stamps.map((s) => {
    const n = (visits.get(s.destinationId) ?? 0) + 1;
    visits.set(s.destinationId, n);
    const d = isDestId(s.destinationId) ? byId.get(s.destinationId) : undefined;
    if (!d || !d.active) return 0;
    const value = stampValue(d, { ...s, visitNumber: s.visitNumber ?? n });
    stampPoints += value;
    stampsCount += 1;
    visited.add(d.id);
    return value;
  });

  const completed = combos.filter(
    (c) => c.active && c.ids.length > 0 && c.ids.filter((id) => visited.has(id)).length >= comboNeed(c),
  );
  const comboPoints = completed.reduce((sum, c) => sum + c.bonus, 0);

  const byTier: Record<Tier, number> = { free: 0, evisa: 0, hard: 0 };
  visited.forEach((id) => {
    const d = byId.get(id);
    if (d) byTier[d.tier] += 1;
  });

  const index = stampPoints + comboPoints;
  return {
    index,
    stampPoints,
    comboPoints,
    stampsCount,
    destinationsCount: visited.size,
    visited,
    values,
    byTier,
    completedCombos: completed.map((c) => c.id),
    circle: circleFor(index, circles),
    next: nextCircle(index, circles),
  };
}
