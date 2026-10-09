"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · GAMIFICATION HUB — резидентская версия (read-only)
 * app/(dashboard)/dashboard/gamification/GamificationClient.tsx
 *
 * Слои:
 *   1. Членская карта + Индекс глобального влияния
 *   2. Voyage Passport — многостраничная хроника пройденного
 *   3. Consular Clearance — карта экспансии с визовыми цензами
 *   4. Легендарные комбо — визовые кампании с бонусом к индексу
 *
 * Данные — те же, что видит админка (Supabase, под сессией резидента):
 *   game_destinations / game_combos / game_circles — веса, комбо, пороги
 *   game_attendance (свои строки)                  — штампы паспорта
 *   v_global_leaderboard (своя строка)             — Индекс и Circle
 * Индекс и Circle берутся из вью — это единый расчёт в БД, общий с
 * админкой и таблицей лидеров. Локальный computeStanding() из
 * lib/gamification.ts (та же формула) нужен для разбивки по цензам и
 * комбо и для мгновенного отклика, пока вью не ответила.
 * Правки админа приходят по realtime — страница пересчитывается сама.
 *
 * Каталог, названия, регионы и лор комбо — lib/gamification.ts.
 * Бренд-слой (Voyage Passport, Consular Clearance, Circle, названия
 * комбо, французская микрокопия) одинаков во всех языках.
 * ──────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  Anchor,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  ConciergeBell,
  Crown,
  Gem,
  Landmark,
  Moon,
  Mountain,
  Sparkles,
  Sun,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import {
  CIRCLES,
  COMBO_LORE,
  PLACES,
  REGIONS,
  REGION_LABELS,
  TIERS,
  circleFor,
  comboNeed,
  computeStanding,
  fmtPoints,
  isDestId,
  nextCircle,
  normalizeCircleKey,
  normalizeLang,
  num,
  resolveCircles,
  resolveCombos,
  resolveDestinations,
  stampValue,
  type AttendanceRow,
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
  type LeaderboardRow,
  type StampInput,
  type Tier,
} from "@/lib/gamification";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/* ── Текстура: SVG-шум как data URI, без внешних файлов ──────────── */

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const PAPER =
  "linear-gradient(105deg, #d9d0ba 0%, #e9e1cc 18%, #efe8d5 50%, #e6ddc7 82%, #d5ccb5 100%)";
const PAPER_VERSO =
  "linear-gradient(255deg, #d9d0ba 0%, #e9e1cc 18%, #efe8d5 50%, #e6ddc7 82%, #d5ccb5 100%)";
const PAPER_GRID =
  "repeating-linear-gradient(0deg, #4a4436 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, #4a4436 0 1px, transparent 1px 9px)";

/* ── Константы ───────────────────────────────────────────────────── */

const SEASON = 2026;
const RELOAD_DEBOUNCE_MS = 400;

const SLOTS_PER_PAGE = 6;
const COVER_MS = 1100;
const PAGE_MS = 950;
const CLOSE_GAP_MS = 520; // страницы возвращаются → затем закрывается обложка
const EASE = "cubic-bezier(0.25,0.9,0.3,1)";
const PERSPECTIVE = "2600px";

/* небольшой «ручной» разброс штампов по слотам, px */
const JITTER: ReadonlyArray<readonly [number, number]> = [
  [-6, 4],
  [5, -5],
  [-3, 6],
  [7, 3],
  [-5, -4],
  [4, 5],
];

/* чернила и формы штампов — назначаются направлению детерминированно */
const INKS = ["#2f5d50", "#7a2e2e", "#5c4a7d", "#8a5a24", "#2e3f6e", "#24555e", "#6b2f4f"] as const;
type StampShape = "round" | "rect" | "oval";
const SHAPES: StampShape[] = ["round", "rect", "oval"];

/* ══════════════════════════════════════════════════════════════════
 * ЛОКАЛИЗАЦИЯ ИНТЕРФЕЙСА
 * (названия направлений, регионов и лор комбо — в lib/gamification.ts)
 * ══════════════════════════════════════════════════════════════════ */

/** 1 штамп · 2 штампа · 5 штампов */
const ru3 = (n: number, one: string, few: string, many: string) => {
  const m100 = Math.abs(n) % 100;
  const m10 = m100 % 10;
  if (m100 > 10 && m100 < 20) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
};
const pl = (n: number, singular: string, plural: string) => (n === 1 ? singular : plural);

const en = {
  title: "The Resident's Chronicle",
  subtitle: "A world divided by visas. And your path through it.",
  influenceTitle: "Global Influence Index",
  destinations: (n: number) => `${n} ${pl(n, "destination", "destinations")}`,
  influenceNote: "Consular Clearance destinations count double toward the index —",
  influenceNoteAccent: (m: number) => `×${m} for every barrier cleared`,
  nextCircle: (title: string) => `Next · ${title}`,
  topCircle: "The club's highest circle",
  stampsSeason: (n: number) => `${n} ${pl(n, "stamp", "stamps")} · season ${SEASON}`,
  arrivals: "Arrivals · Arrivées",
  nextChapter: "room for the next chapter",
  tapToOpen: "touch to open",
  openPassport: "Open passport",
  close: "close",
  prevPage: "Previous page",
  nextPage: "Next page",
  pageOf: (cur: string, total: string) => `Page ${cur} of ${total}`,
  gridSubtitle: "the visa barrier as a mark of prestige",
  veilTitle: "Consular clearance required",
  veilCta: "Request the club concierge",
  combosTitle: "Legendary Combos",
  tourPoints: "Tour points",
  combosSubtitle: "visa campaigns people talk about",
  comboAwarded: "Awarded · entered into the club annals",
  comboProgress: (done: number, total: number) => `${done} of ${total} visa frontiers cleared`,
  comboBonus: "to the index",
  footer: "The next stamp is only ever placed in person.",
};

type Dict = typeof en;

const ru: Dict = {
  title: "Хроника резидента",
  subtitle: "Мир, разделённый на визы. И ваш путь сквозь него.",
  influenceTitle: "Индекс глобального влияния",
  destinations: (n) => `${n} ${ru3(n, "направление", "направления", "направлений")}`,
  influenceNote: "Направления Consular Clearance удваивают вклад в индекс —",
  influenceNoteAccent: (m) => `×${m} за каждый пройденный ценз`,
  nextCircle: (title) => `Следующий круг · ${title}`,
  topCircle: "Высший круг клуба",
  stampsSeason: (n) => `${n} ${ru3(n, "штамп", "штампа", "штампов")} · сезон ${SEASON}`,
  arrivals: "Arrivals · Прибытия",
  nextChapter: "место следующей главы",
  tapToOpen: "коснитесь, чтобы открыть",
  openPassport: "Открыть паспорт",
  close: "закрыть",
  prevPage: "Предыдущая страница",
  nextPage: "Следующая страница",
  pageOf: (cur, total) => `Страница ${cur} из ${total}`,
  gridSubtitle: "визовый барьер — элемент престижа",
  veilTitle: "Требуется консульский допуск",
  veilCta: "Запросить консьержа клуба",
  combosTitle: "Легендарные комбо",
  tourPoints: "Баллы туров",
  combosSubtitle: "визовые кампании, о которых говорят",
  comboAwarded: "Вручено · внесено в летопись клуба",
  comboProgress: (done, total) => `пройдено ${done} из ${total} визовых рубежей`,
  comboBonus: "к индексу",
  footer: "Следующий штамп ставится только вживую.",
};

const es: Dict = {
  title: "Crónica del residente",
  subtitle: "Un mundo dividido por visados. Y su camino a través de él.",
  influenceTitle: "Índice de influencia global",
  destinations: (n) => `${n} ${pl(n, "destino", "destinos")}`,
  influenceNote: "Los destinos Consular Clearance cuentan doble en el índice —",
  influenceNoteAccent: (m) => `×${m} por cada barrera superada`,
  nextCircle: (title) => `Siguiente · ${title}`,
  topCircle: "El círculo más alto del club",
  stampsSeason: (n) => `${n} ${pl(n, "sello", "sellos")} · temporada ${SEASON}`,
  arrivals: "Arrivals · Llegadas",
  nextChapter: "espacio para el próximo capítulo",
  tapToOpen: "toque para abrir",
  openPassport: "Abrir pasaporte",
  close: "cerrar",
  prevPage: "Página anterior",
  nextPage: "Página siguiente",
  pageOf: (cur, total) => `Página ${cur} de ${total}`,
  gridSubtitle: "la barrera del visado como signo de prestigio",
  veilTitle: "Se requiere autorización consular",
  veilCta: "Solicitar el concierge del club",
  combosTitle: "Combos legendarios",
  tourPoints: "Puntos de tours",
  combosSubtitle: "campañas de visado de las que todos hablan",
  comboAwarded: "Otorgado · inscrito en los anales del club",
  comboProgress: (done, total) => `${done} de ${total} fronteras de visado superadas`,
  comboBonus: "al índice",
  footer: "El próximo sello solo se estampa en persona.",
};

const pt: Dict = {
  title: "Crônica do residente",
  subtitle: "Um mundo dividido por vistos. E o seu caminho através dele.",
  influenceTitle: "Índice de influência global",
  destinations: (n) => `${n} ${pl(n, "destino", "destinos")}`,
  influenceNote: "Destinos Consular Clearance contam em dobro no índice —",
  influenceNoteAccent: (m) => `×${m} por cada barreira superada`,
  nextCircle: (title) => `Próximo · ${title}`,
  topCircle: "O círculo mais alto do clube",
  stampsSeason: (n) => `${n} ${pl(n, "carimbo", "carimbos")} · temporada ${SEASON}`,
  arrivals: "Arrivals · Chegadas",
  nextChapter: "espaço para o próximo capítulo",
  tapToOpen: "toque para abrir",
  openPassport: "Abrir passaporte",
  close: "fechar",
  prevPage: "Página anterior",
  nextPage: "Próxima página",
  pageOf: (cur, total) => `Página ${cur} de ${total}`,
  gridSubtitle: "a barreira do visto como marca de prestígio",
  veilTitle: "Requer autorização consular",
  veilCta: "Solicitar o concierge do clube",
  combosTitle: "Combos lendários",
  tourPoints: "Pontos de tours",
  combosSubtitle: "campanhas de visto de que todos falam",
  comboAwarded: "Concedido · registrado nos anais do clube",
  comboProgress: (done, total) => `${done} de ${total} fronteiras de visto superadas`,
  comboBonus: "ao índice",
  footer: "O próximo carimbo só se recebe pessoalmente.",
};

const T: Record<Lang, Dict> = { en, ru, es, pt };

/* ══════════════════════════════════════════════════════════════════
 * ОФОРМЛЕНИЕ ДАННЫХ
 * ══════════════════════════════════════════════════════════════════ */

/* цвет имени/иконки и микро-рамки по цензу */
const TIER_STYLE: Record<Tier, { accent: string; frame: string }> = {
  free: { accent: "text-zinc-300", frame: "ring-white/[0.06]" },
  evisa: { accent: "text-[#e6d3a3]/85", frame: "ring-[#e6d3a3]/[0.14]" },
  hard: { accent: "text-[#dfe4ea]/90", frame: "ring-[#dfe4ea]/[0.16]" },
};

/* оформление членской карты по уровню Circle */
const CIRCLE_META: Record<
  CircleKey,
  {
    text: string; // цвет названия на карте
    glare: string; // RGB перелива под курсором
    ring: string; // кромка карты
    pip: string; // заполненные риски ранга
    crown: string; // цвет короны
  }
> = {
  voyager: {
    text: "text-zinc-300/90",
    glare: "214,219,226",
    ring: "ring-white/[0.07]",
    pip: "bg-zinc-400/70",
    crown: "text-zinc-400/50",
  },
  resident: {
    text: "text-zinc-200/90",
    glare: "214,219,226",
    ring: "ring-white/[0.07]",
    pip: "bg-zinc-300/70",
    crown: "text-zinc-300/55",
  },
  preferred: {
    text: "text-[#e6d3a3]/75",
    glare: "230,211,163",
    ring: "ring-white/[0.07]",
    pip: "bg-[#e6d3a3]/55",
    crown: "text-[#e6d3a3]/50",
  },
  inner: {
    text: "text-[#e6d3a3]/90",
    glare: "230,211,163",
    ring: "ring-white/[0.07]",
    pip: "bg-[#e6d3a3]/75",
    crown: "text-[#e6d3a3]/60",
  },
  private: {
    text: "text-[#dfe4ea]/90",
    glare: "223,228,234",
    ring: "ring-[#dfe4ea]/[0.12]",
    pip: "bg-[#dfe4ea]/75",
    crown: "text-[#dfe4ea]/65",
  },
  black: {
    text: "text-[#f0dfae]",
    glare: "240,223,174",
    ring: "ring-[#e6d3a3]/[0.2]",
    pip: "bg-[#f0dfae]",
    crown: "text-[#f0dfae]/85",
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

/* демо-паспорт: только при <GamificationClient demo /> */
const DEMO_STAMPS: StampInput[] = [
  { destinationId: "turkey", date: "2026-01-18" },
  { destinationId: "georgia", date: "2026-02-03" },
  { destinationId: "bali", date: "2026-02-14" },
  { destinationId: "armenia", date: "2026-03-09" },
  { destinationId: "cambodia", date: "2026-04-21" },
  { destinationId: "vietnam", date: "2026-05-23" },
  { destinationId: "cyprus_turkish", date: "2026-06-12", points: 400 }, // кастомный вес штампа
  { destinationId: "phuket", date: "2026-07-30" },
];

/* ══════════════════════════════════════════════════════════════════
 * УТИЛИТЫ
 * ══════════════════════════════════════════════════════════════════ */

function toRoman(n: number) {
  const map: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = Math.max(0, Math.floor(n));
  let out = "";
  for (const [value, glyph] of map) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/** Детерминированный хэш (FNV-1a) — одинаков на сервере и клиенте */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** "2026-02-14…" → "14 · 02 · 2026" */
function fmtStampDate(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]} · ${m[2]} · ${m[1]}` : "";
}

function firstString(...values: unknown[]) {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._\-+]+/).filter(Boolean);
  if (!words.length) return undefined;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/* ICAO 9303: транслитерация кириллицы для машиночитаемой строки */
const ICAO: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z",
  и: "I", й: "I", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R",
  с: "S", т: "T", у: "U", ф: "F", х: "KH", ц: "TS", ч: "CH", ш: "SH",
  щ: "SHCH", ъ: "IE", ы: "Y", ь: "", э: "E", ю: "IU", я: "IA",
};

function toMrzName(s: string) {
  return Array.from(s.toLowerCase())
    .map((ch) => ICAO[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<")
    .replace(/^<+|<+$/g, "");
}

/** «Анна Ковалёва», "0027" → P<VYGKOVALEVA<<ANNA<<<…<<<0027 (44 знака) */
function buildMrz(fullName: string, memberNo: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const surname = toMrzName(parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? ""));
  const given = toMrzName(parts.slice(0, -1).join(" "));
  const tail = memberNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(-4).padStart(4, "0");
  const head = `P<VYG${surname}<<${given}`.slice(0, 40);
  return head.padEnd(40, "<") + tail;
}

/* ══════════════════════════════════════════════════════════════════
 * ХУКИ
 * ══════════════════════════════════════════════════════════════════ */

/** Язык из глобального контекста: { lang } | { language } | { locale } | "ru" */
function useLang(): Lang {
  const ctx: unknown = useLanguage();
  if (ctx && typeof ctx === "object") {
    const c = ctx as Record<string, unknown>;
    return normalizeLang(c.lang ?? c.language ?? c.locale);
  }
  return normalizeLang(ctx);
}

type AuthLike = {
  user?: {
    id?: string;
    email?: string | null;
    created_at?: string;
    user_metadata?: Record<string, unknown> | null;
  } | null;
  profile?: Record<string, unknown> | null;
  loading?: boolean;
  isLoading?: boolean;
};

type Resident = {
  loading: boolean;
  name: string;
  email: string;
  memberNo: string; // без «Nº», 4 знака
  since: string | null; // римский год вступления
};

function buildResident(
  user: AuthLike["user"],
  profile: AuthLike["profile"],
  loading: boolean,
): Resident {
  const p = profile ?? {};
  const meta = user?.user_metadata ?? {};

  const email = firstString(p.email, user?.email) ?? "";
  const fromParts = [p.first_name, p.last_name]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ");
  const name =
    firstString(p.full_name, p.display_name, p.name, fromParts, meta.full_name, meta.name) ??
    nameFromEmail(email) ??
    "Voyage Resident";

  const rawNo = [p.member_no, p.member_number, p.membership_number].find(
    (v) => typeof v === "number" || (typeof v === "string" && v.trim() !== ""),
  );
  const memberNo =
    rawNo !== undefined
      ? String(rawNo).replace(/^n[ºo°.]?\s*/i, "").trim().padStart(4, "0")
      : user?.id
        ? user.id.replace(/-/g, "").slice(0, 4).toUpperCase()
        : "0000";

  const sinceRaw = firstString(p.member_since, p.joined_at, p.created_at, user?.created_at);
  const year = sinceRaw ? new Date(sinceRaw).getUTCFullYear() : NaN;

  return {
    loading: loading && !user,
    name,
    email,
    memberNo,
    since: Number.isFinite(year) ? toRoman(year) : null,
  };
}

/** Резидент из сессии: useAuth() → { user, profile, loading } */
function useResident() {
  const auth = useAuth() as unknown as AuthLike | null | undefined;
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = Boolean(auth?.loading ?? auth?.isLoading);
  const resident = useMemo(() => buildResident(user, profile, authLoading), [user, profile, authLoading]);
  return { resident, userId: user?.id ?? null, authLoading };
}

type GameData = {
  destinations: DestinationConfig[];
  combos: ComboConfig[];
  circles: CircleConfig[];
  stamps: StampInput[];
  standing: LeaderboardRow | null;
};

const DEFAULT_CONFIG = {
  destinations: resolveDestinations(),
  combos: resolveCombos(),
  circles: resolveCircles(),
};
const EMPTY_DATA: GameData = { ...DEFAULT_CONFIG, stamps: [], standing: null };
const DEMO_DATA: GameData = { ...DEFAULT_CONFIG, stamps: DEMO_STAMPS, standing: null };

const toStamp = (row: AttendanceRow): StampInput => ({
  destinationId: row.destination_id,
  visitNumber: row.visit_number ?? 1, // как во вью: нет номера — первый визит
  points: row.points,
  multiplier: row.multiplier,
  date: row.stamped_at,
});

/** Конфигурация, свои штампы и своя строка лидерборда + realtime */
function useGameData(userId: string | null, authLoading: boolean, demo: boolean) {
  const [data, setData] = useState<GameData | null>(null);
  const live = !demo && !authLoading && userId !== null;

  useEffect(() => {
    if (!live || userId === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const [destRes, comboRes, circleRes, stampRes, standingRes] = await Promise.all([
        supabase.from("game_destinations").select("id, visa_tier, points, multiplier, active, sort_order"),
        supabase.from("game_combos").select("id, title, destination_ids, required_count, bonus, active, sort_order"),
        supabase.from("game_circles").select("level, key, title, min_influence"),
        supabase
          .from("game_attendance")
          .select("destination_id, visit_number, points, multiplier, stamped_at")
          .eq("profile_id", userId)
          .order("stamped_at", { ascending: true }),
        supabase.from("v_global_leaderboard").select("*").eq("profile_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;

      for (const res of [destRes, comboRes, circleRes, stampRes, standingRes]) {
        if (res.error) console.error("[Gamification] Load error:", res.error);
      }

      setData({
        destinations: resolveDestinations(destRes.error ? null : (destRes.data as GameDestinationRow[])),
        combos: resolveCombos(comboRes.error ? null : (comboRes.data as GameComboRow[])),
        circles: resolveCircles(circleRes.error ? null : (circleRes.data as GameCircleRow[])),
        stamps: stampRes.error ? [] : ((stampRes.data ?? []) as AttendanceRow[]).map(toStamp),
        standing: standingRes.error ? null : ((standingRes.data ?? null) as LeaderboardRow | null),
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
    };

    void load();

    const channel = supabase
      .channel(`voyage-passport-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_destinations" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_combos" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_circles" }, schedule)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_attendance", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      // протеже приняли / сожгли поручительство → меняются дивиденды в Индексе
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_invites", filter: `patron_id=eq.${userId}` },
        schedule,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [live, userId]);

  if (demo) return DEMO_DATA;
  if (!live) return EMPTY_DATA;
  return data ?? EMPTY_DATA;
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КОМПОНЕНТЫ
 * ══════════════════════════════════════════════════════════════════ */

/* ── Членская карта: 3D-перелив за курсором ──────────────────────── */

function MembershipCard({ resident, circle }: { resident: Resident; circle: CircleConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const [moving, setMoving] = useState(false);

  const meta = CIRCLE_META[circle.key];
  const rank = circle.level - 1;

  const onMove = useCallback((e: ReactMouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setMoving(true);
    setStyle({
      transform: `perspective(1100px) rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg)`,
      ["--gx" as string]: `${px * 100}%`,
      ["--gy" as string]: `${py * 100}%`,
    });
  }, []);

  const onLeave = useCallback(() => {
    setMoving(false);
    setStyle({
      transform: "perspective(1100px) rotateX(0deg) rotateY(0deg)",
      ["--gx" as string]: "50%",
      ["--gy" as string]: "-20%",
    });
  }, []);

  return (
    <div style={{ perspective: "1100px" }}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ ...style, ["--glare" as string]: meta.glare }}
        className={[
          "group relative aspect-[8/5] w-full select-none overflow-hidden rounded-[1.4rem]",
          moving
            ? "transition-transform duration-100 ease-out"
            : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "motion-reduce:transition-none motion-reduce:transform-none",
          "bg-[radial-gradient(120%_140%_at_20%_0%,#1c1c20_0%,#0c0c0f_45%,#050506_100%)]",
          `ring-1 ${meta.ring}`,
          "shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.6)]",
        ].join(" ")}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: NOISE }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at var(--gx,50%) var(--gy,-20%), rgba(var(--glare),0.14), rgba(var(--glare),0.04) 40%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -inset-y-1/2 w-1/3 rotate-[24deg] opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100"
          style={{
            left: "calc(var(--gx, 50%) - 16%)",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />
        <div className="pointer-events-none absolute inset-[10px] rounded-[1rem] ring-1 ring-white/[0.04]" />

        <div className="relative flex h-full flex-col justify-between p-7 sm:p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-500">Voyage</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#e6d3a3]/50">
                Private Members
              </p>
            </div>
            <Crown size={18} strokeWidth={1} className={`mt-0.5 ${meta.crown}`} />
          </div>

          <div className="min-w-0">
            {resident.loading ? (
              <span
                aria-hidden
                className="block h-9 w-3/4 animate-pulse rounded-md bg-white/[0.04] sm:h-10"
              />
            ) : (
              <p
                title={resident.name}
                className={`${cormorant.className} truncate text-3xl font-medium tracking-wide text-zinc-100 sm:text-4xl`}
              >
                {resident.name}
              </p>
            )}
            {resident.email && (
              <p className="mt-1 truncate font-mono text-[10px] tracking-[0.16em] text-zinc-600">
                {resident.email}
              </p>
            )}

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-2.5 text-[9px] uppercase tracking-[0.35em] text-zinc-600">
                  Circle
                  <span aria-hidden className="flex gap-[3px]">
                    {CIRCLES.map((c, i) => (
                      <span
                        key={c.key}
                        className={`h-[3px] w-[3px] rounded-full ${i <= rank ? meta.pip : "bg-white/[0.08]"}`}
                      />
                    ))}
                  </span>
                </p>
                <p className={`${cormorant.className} mt-0.5 text-xl italic ${meta.text}`}>
                  {circle.title}
                </p>
              </div>
              <div className="text-right">
                {resident.since && (
                  <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-600">
                    Resident since {resident.since}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-xs tracking-[0.25em] text-zinc-400">
                  Nº {resident.memberNo}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Индекс глобального влияния ──────────────────────────────────── */

function InfluencePanel({
  t,
  index,
  destinationsCount,
  byTier,
  combosDone,
  combosTotal,
  patronage,
  tourPoints = 0,
  circle,
  next,
}: {
  t: Dict;
  index: number;
  destinationsCount: number;
  byTier: Record<Tier, number>;
  combosDone: number;
  combosTotal: number;
  patronage: number;
  /** баллы туров (миграция 20261014) — уже внутри Индекса */
  tourPoints?: number;
  circle: CircleConfig;
  next: CircleConfig | null;
}) {
  const rows: Array<[string, string, string]> = [
    [TIERS.free.label, String(byTier.free), "text-zinc-400"],
    [TIERS.evisa.label, String(byTier.evisa), "text-[#e6d3a3]/70"],
    [TIERS.hard.label, String(byTier.hard), "text-[#dfe4ea]/80"],
    [t.combosTitle, `${combosDone} / ${combosTotal}`, "text-[#e6d3a3]/55"],
    // баллы, начисленные в турах (/admin/events) — вливаются в Индекс
    ...(tourPoints > 0 ? [[t.tourPoints, `+${fmtPoints(tourPoints)}`, "text-[#e6d3a3]/70"] as [string, string, string]] : []),
    // дивиденды поручительницы — бренд-строка, одинаковая во всех языках
    ...(patronage > 0 ? [["Patronage", `+${fmtPoints(patronage)}`, "text-[#e6d3a3]/80"] as [string, string, string]] : []),
  ];

  const span = next ? next.min - circle.min : 0;
  const progress = next && span > 0 ? Math.min(1, Math.max(0, (index - circle.min) / span)) : 1;

  return (
    <div className="flex h-full flex-col justify-between rounded-[1.4rem] bg-white/[0.015] p-7 ring-1 ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">{t.influenceTitle}</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
          <p
            className={`${cormorant.className} text-6xl font-medium tabular-nums text-zinc-50 [text-shadow:0_0_30px_rgba(230,211,163,0.12)]`}
          >
            {fmtPoints(index)}
          </p>
          <p className={`${cormorant.className} text-lg italic text-zinc-500`}>
            · {t.destinations(destinationsCount)}
          </p>
        </div>

        <ul className="mt-7 space-y-3.5 border-t border-white/[0.05] pt-6">
          {rows.map(([label, value, tone]) => (
            <li key={label} className="flex items-baseline justify-between gap-4">
              <span className={`text-xs uppercase tracking-[0.2em] ${tone}`}>{label}</span>
              <span className="h-px flex-1 bg-white/[0.05]" />
              <span className="font-mono text-sm tabular-nums text-zinc-300">{value}</span>
            </li>
          ))}
        </ul>

        {/* путь к следующему кругу — пороги те же, что в базе */}
        <div className="mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
              {next ? t.nextCircle(next.title) : t.topCircle}
            </span>
            {next && (
              <span className="font-mono text-xs tabular-nums text-zinc-400">
                {fmtPoints(next.min - index)}
              </span>
            )}
          </div>
          <div className="mt-2 h-px w-full bg-white/[0.06]">
            <div
              className="h-px bg-[#e6d3a3]/60 shadow-[0_0_8px_rgba(230,211,163,0.5)] transition-[width] duration-700 motion-reduce:transition-none"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <p className={`${cormorant.className} mt-8 text-sm italic text-zinc-500`}>
        {t.influenceNote}{" "}
        <span className="text-[#dfe4ea]/70">{t.influenceNoteAccent(TIERS.hard.multiplier)}</span>.
      </p>
    </div>
  );
}

/* ── Штамп паспорта ──────────────────────────────────────────────── */

type StampData = {
  key: string;
  city: string;
  code: string;
  date: string;
  ink: string;
  rotate: number;
  shape: StampShape;
  value: number; // вес штампа в Индексе
};

function Stamp({ stamp, delay, visible }: { stamp: StampData; delay: number; visible: boolean }) {
  const shape =
    stamp.shape === "round"
      ? "h-28 w-28 rounded-full"
      : stamp.shape === "oval"
        ? "h-24 w-36 rounded-[50%]"
        : "h-24 w-36 rounded-md";

  // длинные названия («Саудовская Аравия») чуть уменьшаются, чтобы остаться в оттиске
  const citySize =
    stamp.city.length > 13 ? "text-[15px]" : stamp.city.length > 9 ? "text-lg" : "text-xl";

  return (
    <div
      title={`${stamp.city} · +${fmtPoints(stamp.value)}`}
      style={{
        transform: `rotate(${stamp.rotate}deg) scale(${visible ? 1 : 1.25})`,
        color: stamp.ink,
        transitionDelay: visible ? `${delay}ms` : "0ms",
      }}
      className={[
        shape,
        "relative flex shrink-0 flex-col items-center justify-center border-[2.5px] border-current p-2.5 text-center",
        "opacity-0 transition-all duration-500 ease-out",
        visible ? "opacity-[0.82]" : "",
        "mix-blend-multiply motion-reduce:transition-none",
      ].join(" ")}
    >
      <div
        className={`pointer-events-none absolute inset-[5px] border border-current opacity-70 ${
          stamp.shape === "round" ? "rounded-full" : stamp.shape === "oval" ? "rounded-[50%]" : "rounded-[3px]"
        }`}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
        style={{ backgroundImage: NOISE, backgroundSize: "90px" }}
      />
      <p className="text-[7px] font-semibold uppercase tracking-[0.28em]">{stamp.code}</p>
      <p className={`${cormorant.className} mt-0.5 ${citySize} font-semibold leading-none`}>
        {stamp.city}
      </p>
      <p className="mt-1 font-mono text-[8px] tracking-[0.18em]">{stamp.date}</p>
      <p className="mt-0.5 text-[6px] uppercase tracking-[0.35em] opacity-80">
        Voyage · Admit One
      </p>
    </div>
  );
}

/* ── Слоты под будущие штампы ────────────────────────────────────── */

function NextChapterSlot({ label, delay, visible }: { label: string; delay: number; visible: boolean }) {
  return (
    <div
      className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-dashed border-[#8a7c5d]/35 transition-opacity duration-700 motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      <p className={`${cormorant.className} px-4 text-center text-sm italic leading-snug text-[#8a7c5d]/70`}>
        {label}
      </p>
    </div>
  );
}

function EmptySlot({ no, delay, visible }: { no: number; delay: number; visible: boolean }) {
  const shape =
    no % 3 === 0 ? "h-24 w-24 rounded-full" : no % 3 === 1 ? "h-20 w-32 rounded-[50%]" : "h-20 w-32 rounded-md";

  return (
    <div
      className={`flex shrink-0 items-center justify-center border border-dashed border-[#8a7c5d]/20 transition-opacity duration-700 motion-reduce:transition-none ${shape} ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      <p className="font-mono text-[8px] tracking-[0.3em] text-[#8a7c5d]/45">
        Nº {String(no).padStart(2, "0")}
      </p>
    </div>
  );
}

/* ── Лист паспорта: шарнир по корешку, z-порядок меняется в полёте ─ */

function Leaf({
  index,
  flipped,
  angle,
  duration,
  reduced,
  onClick,
  children,
}: {
  index: number; // 0 — обложка, 1…N — страницы
  flipped: boolean;
  angle: number;
  duration: number;
  reduced: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="absolute inset-0 origin-left cursor-pointer rounded-[1.2rem]"
      style={{
        // справа сверху лежит обложка, слева — последний перевёрнутый лист.
        // При перевороте вперёд z меняется в конце полёта, назад — сразу.
        zIndex: flipped ? 10 + index : 200 - index,
        transformStyle: "preserve-3d",
        transform: `rotateY(${flipped ? angle : 0}deg)`,
        transition: reduced
          ? "none"
          : `transform ${duration}ms ${EASE}, z-index 0s linear ${flipped ? duration : 0}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Обложка: тёмная кожа ────────────────────────────────────────── */

function CoverFront({ hint }: { hint: string }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[1.2rem] ring-1 ring-white/[0.06] shadow-[0_36px_70px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]"
      style={{
        backfaceVisibility: "hidden",
        background: "radial-gradient(130% 120% at 30% 10%, #23201c 0%, #14120f 48%, #0a0908 100%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: NOISE, backgroundSize: "70px" }}
      />
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: NOISE, backgroundSize: "220px" }}
      />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="absolute inset-[14px] rounded-[0.9rem] border border-dashed border-[#e6d3a3]/[0.12]" />

      <div className="relative flex h-full flex-col items-center justify-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e6d3a3]/25">
          <Compass size={22} strokeWidth={1} className="text-[#e6d3a3]/50" />
        </div>
        <div className="text-center">
          <p
            className={`${cormorant.className} text-3xl font-medium tracking-[0.3em] text-[#e6d3a3]/70 [text-shadow:0_1px_0_rgba(255,255,255,0.06),0_-1px_1px_rgba(0,0,0,0.9)]`}
          >
            VOYAGE
          </p>
          <p className="mt-2 text-[9px] uppercase tracking-[0.5em] text-[#e6d3a3]/35">
            Passeport de Résident
          </p>
        </div>
        <p className="absolute bottom-6 text-[9px] uppercase tracking-[0.4em] text-zinc-600 transition-colors duration-300 group-hover:text-[#e6d3a3]/45">
          {hint}
        </p>
      </div>
    </div>
  );
}

function CoverInside() {
  return (
    <div
      className="absolute inset-0 rounded-[1.2rem] ring-1 ring-black/50"
      style={{
        backfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background: "linear-gradient(115deg, #16130f 0%, #1d1914 55%, #12100c 100%)",
      }}
    >
      <div
        className="absolute inset-0 rounded-[1.2rem] opacity-[0.1] mix-blend-overlay"
        style={{ backgroundImage: NOISE, backgroundSize: "90px" }}
      />
      <div className="flex h-full items-end justify-center pb-8">
        <p className={`${cormorant.className} text-sm italic tracking-wide text-[#e6d3a3]/30`}>
          Le monde appartient à ceux qui voyagent
        </p>
      </div>
    </div>
  );
}

/* ── Страница: плотная бумага со слотами ─────────────────────────── */

type Slot =
  | { kind: "stamp"; key: string; order: number; stamp: StampData }
  | { kind: "next"; key: string; order: number }
  | { kind: "empty"; key: string; order: number; no: number };

function PageFront({
  page,
  slots,
  revealed,
  lifted,
  isBase,
  holder,
  mrz,
  t,
}: {
  page: number;
  slots: Slot[];
  revealed: boolean;
  lifted: boolean;
  isBase: boolean;
  holder: string;
  mrz: string;
  t: Dict;
}) {
  const first = page === 1;
  const base = first ? 420 : 360;
  const step = first ? 150 : 130;

  return (
    <div
      className={[
        // isolate — чтобы mix-blend-multiply штампов смешивался именно с бумагой
        "absolute inset-0 isolate overflow-hidden rounded-[1.2rem] rounded-l-md ring-1 ring-black/40",
        isBase ? "shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85)]" : "",
      ].join(" ")}
      style={{ backfaceVisibility: "hidden", background: PAPER }}
    >
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-multiply"
        style={{ backgroundImage: NOISE, backgroundSize: "140px" }}
      />
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/25 via-black/5 to-transparent" />
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: PAPER_GRID }} />

      <div className="relative flex h-full flex-col p-5 sm:p-8">
        <div className="flex items-baseline justify-between gap-3 border-b border-[#7c6f52]/25 pb-2.5">
          <p className="shrink-0 text-[9px] uppercase tracking-[0.45em] text-[#5d5340]">{t.arrivals}</p>
          <p className={`${cormorant.className} min-w-0 truncate text-sm italic text-[#6b5f47]`}>{holder}</p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 place-items-center py-2 sm:grid-cols-3 sm:grid-rows-2 sm:py-3">
          {slots.map((slot) => {
            const [jx, jy] = JITTER[slot.order];
            const delay = base + slot.order * step;
            return (
              // relative/left/top и zoom не создают контекст наложения → чернила ложатся на бумагу
              <div key={slot.key} style={{ position: "relative", left: jx, top: jy }}>
                <div className="[zoom:0.78] sm:[zoom:1]">
                  {slot.kind === "stamp" ? (
                    <Stamp stamp={slot.stamp} delay={delay} visible={revealed} />
                  ) : slot.kind === "next" ? (
                    <NextChapterSlot label={t.nextChapter} delay={delay + 150} visible={revealed} />
                  ) : (
                    <EmptySlot no={slot.no} delay={delay} visible={revealed} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {first ? (
          <p className="overflow-hidden whitespace-nowrap border-t border-[#7c6f52]/25 pt-2.5 text-center font-mono text-[8px] tracking-[0.12em] text-[#6b5f47]/70 sm:text-[9px] sm:tracking-[0.35em]">
            {mrz}
          </p>
        ) : (
          <p
            className={`${cormorant.className} border-t border-[#7c6f52]/25 pt-2 text-center text-sm italic text-[#6b5f47]/70`}
          >
            — {toRoman(page)} —
          </p>
        )}
      </div>

      {/* светотень поднимающегося листа */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/[0.04] via-black/15 to-black/40 transition-opacity ease-out motion-reduce:transition-none"
        style={{ opacity: lifted ? 1 : 0, transitionDuration: `${PAGE_MS}ms` }}
      />
    </div>
  );
}

/* ── Оборот страницы (виден слева после перелистывания) ──────────── */

function PageVerso({ lit }: { lit: boolean }) {
  return (
    <div
      className="absolute inset-0 isolate overflow-hidden rounded-[1.2rem] rounded-r-md ring-1 ring-black/40"
      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: PAPER_VERSO }}
    >
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-multiply"
        style={{ backgroundImage: NOISE, backgroundSize: "140px" }}
      />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/25 via-black/5 to-transparent" />
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: PAPER_GRID }} />
      <div
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.1] sm:h-56 sm:w-56"
        style={{ backgroundImage: "repeating-radial-gradient(circle at center, #4a4436 0 1px, transparent 1px 7px)" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <Compass size={20} strokeWidth={1} className="text-[#8a7c5d]/45" />
        <p className={`${cormorant.className} text-2xl tracking-[0.35em] text-[#8a7c5d]/40`}>VOYAGE</p>
        <p className="text-[8px] uppercase tracking-[0.45em] text-[#8a7c5d]/40">Visas · Entrées</p>
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/[0.04] via-black/15 to-black/40 transition-opacity ease-out motion-reduce:transition-none"
        style={{ opacity: lit ? 0 : 1, transitionDuration: `${PAGE_MS}ms` }}
      />
    </div>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 ring-1 ring-white/[0.07] transition-all duration-300 hover:text-[#e6d3a3]/80 hover:ring-[#e6d3a3]/25 focus:outline-none focus-visible:ring-[#e6d3a3]/40 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ── Паспорт: обложка + листаемые страницы ───────────────────────── */

function VoyagePassport({
  stamps,
  holder,
  mrz,
  t,
}: {
  stamps: StampData[];
  holder: string;
  mrz: string;
  t: Dict;
}) {
  const reduced = usePrefersReducedMotion();

  // минимум две страницы; на последней всегда есть свободный слот
  const pageCount = Math.max(2, Math.ceil((stamps.length + 1) / SLOTS_PER_PAGE));

  // flips: 0 — паспорт закрыт; k — открыта страница k (перевёрнуто k листов)
  const [flips, setFlips] = useState(0);
  const current = Math.min(flips, pageCount);
  const open = current > 0;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pages = useMemo(() => {
    const all = Array.from({ length: pageCount * SLOTS_PER_PAGE }, (_, n): Slot => {
      const order = n % SLOTS_PER_PAGE;
      if (n < stamps.length) return { kind: "stamp", key: stamps[n].key, order, stamp: stamps[n] };
      if (n === stamps.length) return { kind: "next", key: "next-chapter", order };
      return { kind: "empty", key: `slot-${n}`, order, no: n + 1 };
    });
    return Array.from({ length: pageCount }, (_, p) =>
      all.slice(p * SLOTS_PER_PAGE, (p + 1) * SLOTS_PER_PAGE),
    );
  }, [stamps, pageCount]);

  const go = useCallback(
    (target: number) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const to = Math.max(0, Math.min(target, pageCount));
      if (to === 0 && current > 1) {
        // как с настоящим паспортом: сначала страницы ложатся на место, потом обложка
        setFlips(1);
        timer.current = setTimeout(
          () => {
            timer.current = null;
            setFlips(0);
          },
          reduced ? 0 : CLOSE_GAP_MS,
        );
        return;
      }
      setFlips(to);
    },
    [current, pageCount, reduced],
  );

  const next = useCallback(() => {
    if (current < pageCount) go(current + 1);
  }, [current, pageCount, go]);

  const prev = useCallback(() => {
    if (current > 0) go(current - 1);
  }, [current, go]);

  const close = useCallback(() => go(0), [go]);

  // клик по открытой странице: дальше, а с последней — закрыть
  const advance = useCallback(
    () => go(current < pageCount ? current + 1 : 0),
    [current, pageCount, go],
  );

  const onLeaf = (leaf: number) => {
    if (leaf < current) go(leaf); // перевёрнутый лист слева — вернуть его
    else if (leaf === current) advance();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        advance();
        break;
      case "ArrowRight":
        e.preventDefault();
        next();
        break;
      case "ArrowLeft":
        e.preventDefault();
        prev();
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
    }
  };

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (dx < -45) next();
    else if (dx > 45) prev();
  };

  const pageLabel = t.pageOf(toRoman(Math.max(current, 1)), toRoman(pageCount));

  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">Voyage Passport</h2>
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600">
          {t.stampsSeason(stamps.length)}
        </p>
      </div>

      <div
        role="region"
        aria-label={`Voyage Passport · ${open ? pageLabel : t.openPassport}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="group relative mx-auto aspect-[3/4] w-full max-w-3xl select-none rounded-[1.2rem] outline-none focus-visible:ring-2 focus-visible:ring-[#e6d3a3]/40 sm:aspect-[16/10]"
        style={{ perspective: PERSPECTIVE }}
      >
        {pages.map((slots, i) => {
          const leaf = i + 1;
          const flipped = leaf < current;
          return (
            <Leaf
              key={leaf}
              index={leaf}
              flipped={flipped}
              angle={-152 + leaf * 1.4}
              duration={PAGE_MS}
              reduced={reduced}
              onClick={() => onLeaf(leaf)}
            >
              <PageFront
                page={leaf}
                slots={slots}
                revealed={current >= leaf}
                lifted={flipped}
                isBase={leaf === pageCount}
                holder={holder}
                mrz={mrz}
                t={t}
              />
              <PageVerso lit={flipped} />
            </Leaf>
          );
        })}

        <Leaf
          index={0}
          flipped={open}
          angle={-152}
          duration={COVER_MS}
          reduced={reduced}
          onClick={() => onLeaf(0)}
        >
          <CoverFront hint={open ? "" : t.tapToOpen} />
          <CoverInside />
        </Leaf>
      </div>

      {/* навигация по страницам — проявляется, когда паспорт открыт */}
      <div
        aria-hidden={!open}
        className={`mx-auto mt-7 grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center transition-opacity duration-500 motion-reduce:transition-none ${
          open ? "opacity-100 delay-500" : "pointer-events-none opacity-0"
        }`}
      >
        <span />
        <div className="flex items-center gap-5">
          <NavButton label={t.prevPage} onClick={prev} disabled={!open || current <= 1}>
            <ChevronLeft size={14} strokeWidth={1.4} />
          </NavButton>
          <p
            aria-live="polite"
            className={`${cormorant.className} min-w-[10ch] text-center text-sm italic text-zinc-500`}
          >
            {pageLabel}
          </p>
          <NavButton label={t.nextPage} onClick={next} disabled={!open || current >= pageCount}>
            <ChevronRight size={14} strokeWidth={1.4} />
          </NavButton>
        </div>
        <button
          type="button"
          onClick={close}
          disabled={!open}
          className="justify-self-end text-[9px] uppercase tracking-[0.35em] text-zinc-600 transition-colors duration-300 hover:text-[#e6d3a3]/60 focus:outline-none focus-visible:text-[#e6d3a3]/80 disabled:pointer-events-none"
        >
          {t.close}
        </button>
      </div>
    </section>
  );
}

/* ── Карточка направления ────────────────────────────────────────── */

function DestinationCard({
  dest,
  visited,
  lang,
  t,
}: {
  dest: DestinationConfig;
  visited: boolean;
  lang: Lang;
  t: Dict;
}) {
  const style = TIER_STYLE[dest.tier];
  const isHard = dest.tier === "hard";
  const [name, sub] = PLACES[lang][dest.id];

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-2xl p-5",
        "bg-white/[0.015] ring-1 transition-all duration-500",
        "motion-reduce:transition-none",
        visited
          ? "ring-[#e6d3a3]/25 shadow-[0_0_36px_-14px_rgba(230,211,163,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : `${style.frame} shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:bg-white/[0.03]`,
      ].join(" ")}
    >
      {/* платиновая кромка цитадели */}
      {isHard && !visited && (
        <div className="pointer-events-none absolute inset-[7px] rounded-xl border border-[#dfe4ea]/[0.08]" />
      )}

      {/* тёплое свечение пройденного направления */}
      {visited && (
        <div className="pointer-events-none absolute -top-10 right-0 h-24 w-32 rounded-full bg-[#e6d3a3]/[0.08] blur-2xl" />
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`${cormorant.className} text-2xl font-medium leading-tight ${visited ? "text-[#e6d3a3]" : style.accent}`}
          >
            {name}
          </p>
          {visited ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-[#e6d3a3]/40 drop-shadow-[0_0_8px_rgba(230,211,163,0.45)]">
              <Check size={12} strokeWidth={2} className="text-[#e6d3a3]" />
            </span>
          ) : isHard ? (
            <Landmark size={16} strokeWidth={1.2} className="mt-1 shrink-0 text-[#dfe4ea]/50" />
          ) : null}
        </div>

        <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
          <p
            className={`text-[8px] uppercase tracking-[0.28em] ${
              isHard ? "text-[#dfe4ea]/55" : dest.tier === "evisa" ? "text-[#e6d3a3]/45" : "text-zinc-600"
            }`}
          >
            {TIERS[dest.tier].label}
          </p>
          <p className="font-mono text-[10px] tabular-nums text-zinc-600">
            {fmtPoints(stampValue(dest, {}))}
            {dest.multiplier !== 1 && <span className="ml-1 text-[#dfe4ea]/60">×{dest.multiplier}</span>}
          </p>
        </div>
      </div>

      {/* вуаль консульского допуска — только Hard Visa, только непройденные */}
      {isHard && !visited && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-black/70 opacity-0 backdrop-blur-[3px] transition-opacity duration-500 group-hover:opacity-100">
          <ConciergeBell size={18} strokeWidth={1.2} className="text-[#dfe4ea]/70" />
          <p className={`${cormorant.className} px-6 text-center text-base italic leading-snug text-[#dfe4ea]/90`}>
            {t.veilTitle}
          </p>
          <p className="text-[8px] uppercase tracking-[0.35em] text-[#e6d3a3]/60">{t.veilCta}</p>
        </div>
      )}
    </article>
  );
}

/* ── Consular Clearance: карта экспансии ─────────────────────────── */

function ConsularGrid({
  t,
  lang,
  destinations,
  visited,
}: {
  t: Dict;
  lang: Lang;
  destinations: DestinationConfig[];
  visited: ReadonlySet<DestId>;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">Consular Clearance</h2>
        <p className={`${cormorant.className} text-right text-sm italic text-zinc-600`}>{t.gridSubtitle}</p>
      </div>

      {/* легенда цензов */}
      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-white/[0.05] pb-4">
        {(Object.keys(TIERS) as Tier[]).map((tierId) => (
          <p
            key={tierId}
            className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-zinc-600"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                tierId === "hard" ? "bg-[#dfe4ea]/70" : tierId === "evisa" ? "bg-[#e6d3a3]/60" : "bg-zinc-500"
              }`}
            />
            {TIERS[tierId].label}
            {TIERS[tierId].multiplier !== 1 && (
              <span className="text-[#dfe4ea]/60">· ×{TIERS[tierId].multiplier}</span>
            )}
          </p>
        ))}
      </div>

      <div className="space-y-10">
        {REGIONS.map((region) => {
          const items = destinations.filter((d) => d.active && d.region === region);
          if (items.length === 0) return null;
          return (
            <div key={region}>
              <div className="mb-4 flex items-baseline gap-4">
                <h3 className={`${cormorant.className} text-xl italic text-zinc-400`}>
                  {REGION_LABELS[lang][region]}
                </h3>
                <span className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <DestinationCard key={d.id} dest={d} visited={visited.has(d.id)} lang={lang} t={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Легендарные комбо ───────────────────────────────────────────── */

function LegendaryCombos({
  t,
  lang,
  combos,
  visited,
}: {
  t: Dict;
  lang: Lang;
  combos: ComboConfig[];
  visited: ReadonlySet<DestId>;
}) {
  const active = combos.filter((c) => c.active && c.ids.length > 0);

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">{t.combosTitle}</h2>
        <p className={`${cormorant.className} text-right text-sm italic text-zinc-600`}>{t.combosSubtitle}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {active.map((combo) => {
          const { id, title, ids, bonus } = combo;
          const Icon = COMBO_ICON[combo.icon];
          const need = comboNeed(combo);
          const done = ids.filter((i) => visited.has(i)).length;
          const complete = done >= need;

          return (
            <article
              key={id}
              className={[
                "relative flex flex-col overflow-hidden rounded-[1.2rem] p-7 ring-1 transition-all duration-500",
                complete
                  ? "bg-[#e6d3a3]/[0.03] ring-[#e6d3a3]/25 shadow-[0_0_50px_-16px_rgba(230,211,163,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]"
                  : "bg-white/[0.015] ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              ].join(" ")}
            >
              {complete && (
                <div className="pointer-events-none absolute -top-14 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-[#e6d3a3]/[0.1] blur-3xl" />
              )}

              <div className="relative flex flex-1 flex-col">
                <div
                  className={[
                    "mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1",
                    complete
                      ? "ring-[#e6d3a3]/40 drop-shadow-[0_0_14px_rgba(230,211,163,0.35)]"
                      : "ring-white/[0.08]",
                  ].join(" ")}
                  style={{
                    background: complete
                      ? "radial-gradient(circle at 32% 28%, #3a3424 0%, #1c1810 60%, #0d0b07 100%)"
                      : "radial-gradient(circle at 32% 28%, #232323 0%, #131313 60%, #0a0a0a 100%)",
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.1}
                    className={complete ? "text-[#e6d3a3]" : "text-zinc-500"}
                  />
                </div>

                <h3
                  className={`${cormorant.className} mt-5 text-center text-2xl font-medium ${complete ? "text-[#e6d3a3]" : "text-zinc-200"}`}
                >
                  {title}
                </h3>
                <p className="mx-auto mt-2 max-w-[28ch] text-center text-xs leading-relaxed text-zinc-500">
                  {COMBO_LORE[lang][id]}
                </p>

                {/* маршрут комбо */}
                <div className="mb-6 mt-6 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
                  {ids.map((destId, i) => {
                    const v = visited.has(destId);
                    return (
                      <span key={destId} className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.18em] ring-1 ${
                            v ? "text-[#e6d3a3]/90 ring-[#e6d3a3]/30" : "text-zinc-500 ring-white/[0.07]"
                          }`}
                        >
                          {PLACES[lang][destId][0]}
                        </span>
                        {i < ids.length - 1 && <span className="h-px w-2.5 bg-white/[0.1]" />}
                      </span>
                    );
                  })}
                </div>

                {/* итог кампании: прогресс слева, награда справа снизу */}
                <div className="mt-auto flex items-end justify-between gap-4 border-t border-white/[0.05] pt-4">
                  <p
                    className={`${cormorant.className} text-sm italic leading-snug ${
                      complete ? "text-[#e6d3a3]/80" : "text-zinc-600"
                    }`}
                  >
                    {complete ? (
                      <span className="inline-flex items-start gap-2">
                        <Sparkles size={13} strokeWidth={1.3} className="mt-[3px] shrink-0" />
                        {t.comboAwarded}
                      </span>
                    ) : (
                      t.comboProgress(done, need)
                    )}
                  </p>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-mono text-sm tabular-nums ${
                        complete
                          ? "text-[#e6d3a3] [text-shadow:0_0_14px_rgba(230,211,163,0.35)]"
                          : "text-zinc-300"
                      }`}
                    >
                      +{fmtPoints(bonus)}
                    </p>
                    <p className="mt-0.5 text-[8px] uppercase tracking-[0.3em] text-zinc-600">{t.comboBonus}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── Страница ────────────────────────────────────────────────────── */

/** demo — показать демонстрационный паспорт без обращения к базе */
export default function GamificationClient({ demo = false }: { demo?: boolean }) {
  const lang = useLang();
  const t = T[lang];
  const { resident, userId, authLoading } = useResident();
  const data = useGameData(userId, authLoading, demo);

  // та же формула, что во вью: разбивка по цензам и комбо + мгновенный отклик
  const local = useMemo(
    () => computeStanding(data.stamps, data.destinations, data.combos, data.circles),
    [data],
  );

  // Индекс и Circle — из БД (v_global_leaderboard); пока вью не ответила — локальный расчёт
  const index = num(data.standing?.total_influence) ?? local.index;
  const dbCircle = normalizeCircleKey(data.standing?.circle_key);
  const circle = data.circles.find((c) => c.key === dbCircle) ?? circleFor(index, data.circles);
  const next = nextCircle(index, data.circles);

  const stamps = useMemo(() => {
    const byId = new Map(data.destinations.map((d) => [d.id, d]));
    const out: StampData[] = [];
    data.stamps.forEach((s, i) => {
      if (!isDestId(s.destinationId)) return;
      const d = byId.get(s.destinationId);
      if (!d) return;
      out.push({
        key: `${s.destinationId}-${s.date ?? ""}-${i}`,
        city: PLACES[lang][d.id][0],
        code: d.code,
        date: fmtStampDate(s.date),
        ink: INKS[hash(d.id) % INKS.length],
        shape: SHAPES[hash(`${d.id}:shape`) % SHAPES.length],
        rotate: (hash(`${s.destinationId}:${s.date ?? i}`) % 15) - 7,
        value: local.values[i] ?? 0,
      });
    });
    return out;
  }, [data.stamps, data.destinations, local.values, lang]);

  const mrz = useMemo(
    () => buildMrz(resident.name, resident.memberNo),
    [resident.name, resident.memberNo],
  );

  return (
    <div lang={lang} className="relative mx-auto max-w-5xl px-6 pb-24 pt-12 sm:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(90%_60%_at_50%_-10%,#191714_0%,#0a0a0b_55%,#060607_100%)]" />

      <header className="mb-14">
        <p className="text-[10px] uppercase tracking-[0.5em] text-zinc-600">Voyage · Season {SEASON}</p>
        <h1
          className={`${cormorant.className} mt-3 text-5xl font-medium tracking-wide text-zinc-50 sm:text-6xl`}
        >
          {t.title}
        </h1>
        <p className={`${cormorant.className} mt-3 text-lg italic text-zinc-500`}>{t.subtitle}</p>
      </header>

      <div className="mb-20 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <MembershipCard resident={resident} circle={circle} />
        <InfluencePanel
          t={t}
          index={index}
          destinationsCount={local.destinationsCount}
          byTier={local.byTier}
          combosDone={local.completedCombos.length}
          combosTotal={data.combos.filter((c) => c.active).length}
          patronage={num(data.standing?.patronage_points) ?? 0}
          tourPoints={num(data.standing?.tour_points) ?? 0}
          circle={circle}
          next={next}
        />
      </div>

      <div className="mb-20">
        <VoyagePassport stamps={stamps} holder={resident.name} mrz={mrz} t={t} />
      </div>

      <div className="mb-20">
        <ConsularGrid t={t} lang={lang} destinations={data.destinations} visited={local.visited} />
      </div>

      <LegendaryCombos t={t} lang={lang} combos={data.combos} visited={local.visited} />

      <p
        className={`${cormorant.className} mt-20 border-t border-white/[0.05] pt-8 text-center text-sm italic text-zinc-600`}
      >
        {t.footer}
      </p>
    </div>
  );
}