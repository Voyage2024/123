"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · История начислений (выписка Influence Index)
 * app/(dashboard)/dashboard/_components/PointsHistory.tsx
 *
 * Источник — RPC public.get_my_points_history (миграция 20261020093000):
 * у каждой строки ledger есть происхождение — тур на карте, тусовка,
 * тур менеджера, штамп страны, комбо, ачивка, корректировка клуба —
 * и входные данные формулы (гонорар, надёжность, сложность).
 *
 *   сводка     сумма по категориям, клик фильтрует список
 *   список     по месяцам, новые сверху, «Показать ещё» — курсор p_before
 *   строка     раскрывается: как посчитаны баллы
 *
 * fallback — строки, уже загруженные страницей (демо или RPC ещё не применён).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  ChevronDown,
  Crown,
  Gem,
  LoaderCircle,
  MapPin,
  PartyPopper,
  Plane,
  Scale,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export type HistoryLang = "en" | "ru" | "es" | "pt";
type Category = "tour" | "event" | "stamp" | "combo" | "achievement" | "adjustment";
type SourceKind = "tour" | "party" | "partner_tour" | "passport" | "combo" | "achievement" | "adjustment" | "event" | "stamp";

type HistoryItem = {
  id: number;
  at: number;
  category: Category;
  points: number;
  reason: string;
  kind: SourceKind;
  title: string;
  project: string | null;
  region: string | null;
  country: string | null;
  formula: { commercial: number; reliability: number; complexity: number } | null;
};

export type LedgerFallbackRow = {
  id: number | string;
  category: string;
  points: number | string;
  reason: string | null;
  event_key?: string;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
};

const CATEGORIES: Category[] = ["tour", "event", "stamp", "combo", "achievement", "adjustment"];

const ICONS: Record<SourceKind, LucideIcon> = {
  tour: MapPin,
  partner_tour: Plane,
  party: PartyPopper,
  event: PartyPopper,
  passport: Stamp,
  stamp: Stamp,
  combo: Gem,
  achievement: Award,
  adjustment: Scale,
};

const COPY: Record<HistoryLang, {
  categories: Record<Category, string>;
  kinds: Record<SourceKind, string>;
  projects: Record<string, string>;
  all: string;
  empty: string;
  emptyFilter: string;
  more: string;
  loading: string;
  error: string;
  total: string;
  how: string;
  base: (category: Category) => string;
  commercial: string;
  reliability: string;
  complexity: string;
  country: string;
}> = {
  ru: {
    categories: { tour: "Туры", event: "Тусовки", stamp: "Штампы", combo: "Комбо", achievement: "Ачивки", adjustment: "Корректировки" },
    kinds: {
      tour: "Тур на карте", partner_tour: "Тур менеджера", party: "Тусовка", event: "Тусовка",
      passport: "Паспорт", stamp: "Штамп страны", combo: "Легендарное комбо", achievement: "Достижение", adjustment: "Решение клуба",
    },
    projects: { shoot: "съёмка", show: "показ", campaign: "кампейн", event: "ивент" },
    all: "Все",
    empty: "Начислений пока нет. Первый завершённый тур откроет выписку.",
    emptyFilter: "В этой категории начислений нет.",
    more: "Показать ещё",
    loading: "Загружаем выписку…",
    error: "Не удалось загрузить историю. Показаны последние начисления.",
    total: "Всего начислено",
    how: "Как посчитано",
    base: (c) => (c === "event" ? "База за тусовку" : "База за тур"),
    commercial: "Коммерческая ценность",
    reliability: "Надёжность на момент тура",
    complexity: "Коэффициент сложности",
    country: "Страна",
  },
  en: {
    categories: { tour: "Tours", event: "Parties", stamp: "Stamps", combo: "Combos", achievement: "Achievements", adjustment: "Adjustments" },
    kinds: {
      tour: "Map tour", partner_tour: "Manager tour", party: "Party", event: "Party",
      passport: "Passport", stamp: "Country stamp", combo: "Legendary combo", achievement: "Achievement", adjustment: "Club decision",
    },
    projects: { shoot: "shoot", show: "show", campaign: "campaign", event: "event" },
    all: "All",
    empty: "No points yet. Your first completed tour opens the statement.",
    emptyFilter: "Nothing in this category yet.",
    more: "Show more",
    loading: "Loading statement…",
    error: "Could not load the history. Showing recent entries.",
    total: "Total awarded",
    how: "How it was calculated",
    base: (c) => (c === "event" ? "Party base" : "Tour base"),
    commercial: "Commercial value",
    reliability: "Reliability at the time",
    complexity: "Complexity multiplier",
    country: "Country",
  },
  es: {
    categories: { tour: "Tours", event: "Fiestas", stamp: "Sellos", combo: "Combos", achievement: "Logros", adjustment: "Ajustes" },
    kinds: {
      tour: "Tour del mapa", partner_tour: "Tour de gerente", party: "Fiesta", event: "Fiesta",
      passport: "Pasaporte", stamp: "Sello de país", combo: "Combo legendario", achievement: "Logro", adjustment: "Decisión del club",
    },
    projects: { shoot: "sesión", show: "desfile", campaign: "campaña", event: "evento" },
    all: "Todo",
    empty: "Aún no hay puntos. Tu primer tour completado abrirá el extracto.",
    emptyFilter: "No hay movimientos en esta categoría.",
    more: "Mostrar más",
    loading: "Cargando extracto…",
    error: "No se pudo cargar el historial. Se muestran los últimos movimientos.",
    total: "Total otorgado",
    how: "Cómo se calculó",
    base: (c) => (c === "event" ? "Base por fiesta" : "Base por tour"),
    commercial: "Valor comercial",
    reliability: "Fiabilidad en ese momento",
    complexity: "Coeficiente de dificultad",
    country: "País",
  },
  pt: {
    categories: { tour: "Tours", event: "Festas", stamp: "Carimbos", combo: "Combos", achievement: "Conquistas", adjustment: "Ajustes" },
    kinds: {
      tour: "Tour do mapa", partner_tour: "Tour do gerente", party: "Festa", event: "Festa",
      passport: "Passaporte", stamp: "Carimbo de país", combo: "Combo lendário", achievement: "Conquista", adjustment: "Decisão do clube",
    },
    projects: { shoot: "ensaio", show: "desfile", campaign: "campanha", event: "evento" },
    all: "Tudo",
    empty: "Ainda não há pontos. Seu primeiro tour concluído abre o extrato.",
    emptyFilter: "Nada nesta categoria ainda.",
    more: "Mostrar mais",
    loading: "Carregando extrato…",
    error: "Não foi possível carregar o histórico. Mostrando os lançamentos recentes.",
    total: "Total concedido",
    how: "Como foi calculado",
    base: (c) => (c === "event" ? "Base da festa" : "Base do tour"),
    commercial: "Valor comercial",
    reliability: "Confiabilidade no momento",
    complexity: "Coeficiente de complexidade",
    country: "País",
  },
};

const LOCALE: Record<HistoryLang, string> = { en: "en-GB", ru: "ru-RU", es: "es-ES", pt: "pt-PT" };
const PAGE = 30;

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};
const asCategory = (v: unknown): Category => (CATEGORIES.includes(v as Category) ? (v as Category) : "adjustment");

function localized(value: unknown, lang: HistoryLang): string | null {
  const r = rec(value);
  return txt(r[lang.toUpperCase()]) ?? txt(r.EN) ?? txt(r.RU) ?? null;
}

function parseItem(raw: unknown, lang: HistoryLang): HistoryItem | null {
  const r = rec(raw);
  const id = n(r.id);
  const at = typeof r.at === "string" ? Date.parse(r.at) : NaN;
  if (id === null || Number.isNaN(at)) return null;
  const source = rec(r.source);
  const formula = rec(r.formula);
  const category = asCategory(r.category);
  return {
    id,
    at,
    category,
    points: n(r.points) ?? 0,
    reason: txt(r.reason) ?? "",
    kind: (txt(source.kind) as SourceKind) ?? category,
    title: localized(source.title_i18n, lang) ?? txt(source.title) ?? txt(r.reason) ?? "—",
    project: txt(source.project),
    region: txt(source.region),
    country: txt(r.country_code),
    formula: r.formula
      ? {
          commercial: n(formula.commercial_value) ?? 0,
          reliability: n(formula.reliability) ?? 100,
          complexity: n(formula.complexity) ?? 1,
        }
      : null,
  };
}

function fromFallback(rows: LedgerFallbackRow[]): HistoryItem[] {
  return rows.flatMap((row) => {
    const id = n(row.id);
    const at = row.created_at ? Date.parse(row.created_at) : NaN;
    if (id === null || Number.isNaN(at)) return [];
    const meta = rec(row.metadata);
    const category = asCategory(row.category);
    return [{
      id, at, category,
      points: n(row.points) ?? 0,
      reason: row.reason ?? "",
      kind: category as SourceKind,
      title: txt(meta.source_label) ?? row.reason ?? row.event_key ?? "—",
      project: null,
      region: null,
      country: txt(meta.country_code),
      formula: null,
    }];
  });
}

const fmt = (value: number) => new Intl.NumberFormat("ru-RU").format(Math.round(value));

export default function PointsHistory({
  lang,
  fallback = [],
  live = true,
  refreshKey,
}: {
  lang: HistoryLang;
  fallback?: LedgerFallbackRow[];
  live?: boolean;
  /** Меняется, когда страница получила realtime-событие ledger → перечитать первую страницу */
  refreshKey?: number | string;
}) {
  const t = COPY[lang] ?? COPY.ru;
  const [items, setItems] = useState<HistoryItem[]>(() => (live ? [] : fromFallback(fallback)));
  const [totals, setTotals] = useState<{ total: number; by: Partial<Record<Category, number>> } | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(live);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [open, setOpen] = useState<number | null>(null);

  const fetchPage = useCallback(
    async (before: number | null) => {
      const { data, error } = await supabase.rpc("get_my_points_history", { p_limit: PAGE, p_before: before });
      if (error) throw error;
      const root = rec(data);
      const list = Array.isArray(root.items) ? root.items.flatMap((x) => parseItem(x, lang) ?? []) : [];
      const tot = rec(root.totals);
      const by = rec(tot.by_category);
      return {
        list,
        next: n(root.next_before),
        totals: {
          total: n(tot.total) ?? 0,
          by: Object.fromEntries(CATEGORIES.map((c) => [c, n(by[c]) ?? 0])) as Partial<Record<Category, number>>,
        },
      };
    },
    [lang],
  );

  useEffect(() => {
    if (!live) {
      setItems(fromFallback(fallback));
      return;
    }
    let alive = true;
    setLoading(true);
    fetchPage(null)
      .then((res) => {
        if (!alive) return;
        setItems(res.list);
        setCursor(res.next);
        setTotals(res.totals);
        setFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setItems(fromFallback(fallback));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // fallback намеренно не в зависимостях: он нужен только при ошибке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, fetchPage, refreshKey]);

  const loadMore = async () => {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(cursor);
      setItems((prev) => [...prev, ...res.list.filter((x) => !prev.some((p) => p.id === x.id))]);
      setCursor(res.next);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = useMemo(() => {
    if (totals) return totals;
    const by: Partial<Record<Category, number>> = {};
    for (const item of items) by[item.category] = (by[item.category] ?? 0) + item.points;
    return { total: items.reduce((s, i) => s + i.points, 0), by };
  }, [totals, items]);

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);
  const months = useMemo(() => {
    const groups: { key: string; label: string; sum: number; rows: HistoryItem[] }[] = [];
    for (const item of visible) {
      const d = new Date(item.at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups.find((x) => x.key === key);
      if (!g) {
        const label = d.toLocaleDateString(LOCALE[lang], { month: "long", year: "numeric" });
        g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), sum: 0, rows: [] };
        groups.push(g);
      }
      g.sum += item.points;
      g.rows.push(item);
    }
    return groups;
  }, [visible, lang]);

  const chips = CATEGORIES.filter((c) => (summary.by[c] ?? 0) !== 0);

  return (
    <div id="points-history" className="scroll-mt-24">
      {/* Сводка по категориям */}
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] transition-colors ${
            filter === "all" ? "border-[#c9a961]/50 bg-[#c9a961]/10 text-[#e6d3a3]" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {t.all} · <span className="font-mono tabular-nums">{fmt(summary.total)}</span>
        </button>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(filter === c ? "all" : c)}
            className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] transition-colors ${
              filter === c ? "border-[#c9a961]/50 bg-[#c9a961]/10 text-[#e6d3a3]" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.categories[c]} · <span className="font-mono tabular-nums">{(summary.by[c] ?? 0) > 0 ? "+" : ""}{fmt(summary.by[c] ?? 0)}</span>
          </button>
        ))}
      </div>

      {failed && <p className="mb-3 rounded-lg border border-amber-200/15 bg-amber-200/[0.03] px-3 py-2 text-[11px] text-amber-100/80">{t.error}</p>}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
          <LoaderCircle size={14} className="animate-spin" />
          {t.loading}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-xs leading-relaxed text-zinc-500">{items.length === 0 ? t.empty : t.emptyFilter}</p>
      ) : (
        <div className="space-y-6">
          {months.map((g) => (
            <section key={g.key}>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                  <CalendarDays size={12} className="text-[#c9a961]/60" />
                  {g.label}
                </p>
                <p className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {g.sum > 0 ? "+" : ""}
                  {fmt(g.sum)}
                </p>
              </div>
              <ol className="divide-y divide-white/[0.04]">
                {g.rows.map((item) => {
                  const Icon = ICONS[item.kind] ?? Crown;
                  const expanded = open === item.id;
                  const date = new Date(item.at).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
                  const subtitle = [
                    t.kinds[item.kind] ?? t.categories[item.category],
                    item.project ? t.projects[item.project] ?? item.project : null,
                    item.country,
                    date,
                  ].filter(Boolean).join(" · ");
                  const label =
                    item.category === "stamp" && item.country ? `${t.kinds.stamp} · ${item.country}`
                    : item.category === "combo" || item.category === "achievement" || item.category === "adjustment" ? item.reason || item.title
                    : item.title;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={!item.formula}
                        onClick={() => setOpen(expanded ? null : item.id)}
                        className="group flex w-full items-center gap-3 py-3.5 text-left disabled:cursor-default"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c9a961]/20 bg-[#c9a961]/[0.05] text-[#e6d3a3]/80">
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm text-zinc-200">{label}</span>
                          <span className="mt-0.5 block text-[9px] uppercase tracking-[0.15em] text-zinc-600">{subtitle}</span>
                        </span>
                        <span className={`shrink-0 font-mono text-sm tabular-nums ${item.points > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {item.points > 0 ? "+" : ""}
                          {fmt(item.points)}
                        </span>
                        {item.formula && (
                          <ChevronDown size={14} className={`shrink-0 text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        )}
                      </button>
                      {expanded && item.formula && (
                        <div className="mb-3 ml-12 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-[11px] leading-6 text-zinc-400">
                          <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-[#c9a961]/70">{t.how}</p>
                          <p>{t.base(item.category)} + {t.commercial}: <span className="font-mono text-zinc-200">{fmt(item.formula.commercial)}</span></p>
                          <p>{t.reliability}: <span className="font-mono text-zinc-200">{item.formula.reliability}%</span></p>
                          <p>{t.complexity}: <span className="font-mono text-zinc-200">×{item.formula.complexity}</span></p>
                          {item.country && <p>{t.country}: <span className="font-mono text-zinc-200">{item.country}</span></p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {cursor !== null && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-[#c9a961]/30 px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-[#e6d3a3] transition-colors hover:bg-[#c9a961]/10 disabled:opacity-50"
              >
                {loadingMore && <LoaderCircle size={12} className="animate-spin" />}
                {t.more}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
