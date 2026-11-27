"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток — экран менеджера (этап 2 → каталог 2.0, этап A)
 * app/components/catalog/ResidentCatalog.tsx
 *
 * Этап A: обложка плитки — всегда главное фото портфолио (видео-постер
 * больше не обложка), значки только положительные, порядок по
 * актуальности анкеты, фильтр «Материалы» вместо «Видео».
 *
 * Всё, что тут видно, отдаёт база через voyage_rcat_*: доступ, пауза,
 * «скрыться от менеджера» и лимиты проверяются на каждый вызов.
 * Обложки, фото и видео — под именным водяным знаком менеджера (D3).
 * Приглашение — только в свой кастинг (D1), дальше обычный путь кастинга.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight, Filter, FolderHeart, Loader2, Lock, Send, Trash2, UserRound, X,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { PageHeader, PageShell, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import {
  deleteShortlist, getCatalogViewer, inviteFromCatalog, listShortlists, myCatalogCastings, openCatalogCard, pruneShortlist,
  saveShortlist, searchCatalog, sentCatalogInvites, shortlistEntries, toggleShortlist, withdrawCatalogInvite,
} from "@/app/actions/resident-catalog";
import { WatermarkLayer } from "@/app/components/media/WatermarkLayer";
import { CatalogCardView } from "@/app/components/catalog/CatalogCardView";
import { BusyLine, FIELD, FreshnessChip, GHOST_BTN, GOLD_BTN, KycChip, LanguagesLine, VideoChip } from "@/app/components/catalog/catalog-ui";
import {
  CATALOG_MATERIALS, CATALOG_SORTS, CLOTHING_SIZES, INVITE_MESSAGE_MAX, catalogCopy, fmtDay, fmtRange, inviteMessageOk, photoFirstCopy, pickI18n,
  type CatalogCard, type CatalogCopy, type CatalogFailure, type CatalogFilters, type CatalogItem, type CatalogLimits,
  type CatalogViewer, type ManagerCasting, type SentInvite, type Shortlist, type ShortlistEntry,
} from "@/lib/resident-catalog";

const EMPTY_FILTERS: CatalogFilters = { materials: "any", sort: "updated" };
const errText = (c: CatalogCopy, r: CatalogFailure) => c.errors[r] ?? c.errors.failed;

export default function ResidentCatalog() {
  const { lang } = useLanguage();
  const c = catalogCopy(lang);
  const [viewer, setViewer] = useState<CatalogViewer | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [limits, setLimits] = useState<CatalogLimits | null>(null);

  const loadViewer = useCallback(async () => {
    const r = await getCatalogViewer();
    if (!r.ok) { setViewerError(errText(c, r.reason)); return; }
    setViewer(r.viewer);
    if (r.viewer.mode !== "none") setLimits(r.viewer.limits);
  }, [c]);

  useEffect(() => { void loadViewer(); }, [loadViewer]);

  return (
    <PageShell>
      <PageHeader eyebrow={c.catEyebrow} title={c.catTitle} subtitle={c.catSubtitle}
        aside={viewer && viewer.mode === "manager" && limits ? (
          <Panel className="px-4 py-3"><p className="text-[11px] text-zinc-400">{c.catLimits(limits.opensUsed, limits.opens, limits.invitesUsed, limits.invites)}</p>
            <p className="mt-1 text-[10px] text-zinc-600">{c.catWatermarkNote} · {viewer.code}</p></Panel>
        ) : undefined}
      />
      <div className="mt-8">
        {viewerError ? (
          <Gate title={c.catGateTitle} text={viewerError} />
        ) : !viewer ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 size={14} className="animate-spin" /> {c.loading}</p>
        ) : viewer.mode === "none" ? (
          <Gate title={c.catGateTitle} text={c.catGate[viewer.reason] ?? c.errors.failed} />
        ) : (
          <>
            {viewer.mode === "staff" && !viewer.enabled && (
              <p className="mb-4 rounded-xl border border-amber-200/25 bg-amber-200/[0.06] px-3 py-2 text-xs text-amber-100">{c.catStaffDisabled}</p>
            )}
            <CatalogWorkspace lang={lang} c={c} watermark={viewer.watermark} onLimits={setLimits} />
          </>
        )}
      </div>
    </PageShell>
  );
}

function Gate({ title, text }: { title: string; text: string }) {
  return (
    <Panel className="flex items-start gap-3 p-6">
      <Lock size={18} className="mt-0.5 shrink-0 text-[#c9a961]" aria-hidden />
      <div><h2 className="text-base text-zinc-100">{title}</h2><p className="mt-1 text-sm text-zinc-400">{text}</p></div>
    </Panel>
  );
}

/* ── рабочая область ───────────────────────────────────────────────── */

function CatalogWorkspace({ lang, c, watermark, onLimits }: {
  lang: string; c: CatalogCopy; watermark: string; onLimits: (l: CatalogLimits | null) => void;
}) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [castings, setCastings] = useState<ManagerCasting[]>([]);
  const [forCasting, setForCasting] = useState<string>("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<Shortlist[]>([]);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [invite, setInvite] = useState<string[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const run = useCallback(async (f: CatalogFilters, p: number) => {
    setLoading(true); setError(null);
    const r = await searchCatalog(f, p);
    setLoading(false);
    if (!r.ok) { setError(errText(c, r.reason)); return [] as CatalogItem[]; }
    setItems((prev) => (p === 0 ? r.items : [...prev, ...r.items]));
    setTotal(r.total); setHasMore(r.hasMore); setPage(r.page);
    return r.items;
  }, [c]);

  const loadLists = useCallback(async () => {
    const r = await listShortlists();
    if (r.ok) setLists(r.lists);
  }, []);

  const loadEntries = useCallback(async (id: string) => {
    const r = await shortlistEntries(id);
    setEntries(r.ok ? r.entries : []);
  }, []);

  useEffect(() => {
    void run(EMPTY_FILTERS, 0);
    void loadLists();
    void myCatalogCastings().then((r) => { if (r.ok) setCastings(r.castings); });
  }, [run, loadLists]);

  useEffect(() => { if (activeList) void loadEntries(activeList); }, [activeList, loadEntries]);

  const apply = (f: CatalogFilters) => { setFilters(f); void run(f, 0); };

  const pickCasting = (id: string) => {
    setForCasting(id);
    const cs = castings.find((x) => x.id === id);
    if (!cs) { apply(EMPTY_FILTERS); return; }
    // «Под кастинг»: даты, рост и KYC из требований кастинга; остальное менеджер уточняет сам
    apply({ ...EMPTY_FILTERS, free_from: cs.startsOn, free_to: cs.endsOn, height_min: cs.heightMin ?? null, kyc_min: Math.max(1, cs.minKyc) });
  };

  const visible: CatalogItem[] = useMemo(() => {
    if (!activeList) return items;
    return entries.filter((e): e is CatalogItem & { unavailable?: false; addedAt: string } => !e.unavailable);
  }, [activeList, items, entries]);
  const unavailableCount = activeList ? entries.filter((e) => e.unavailable).length : 0;
  const idx = openId ? visible.findIndex((x) => x.id === openId) : -1;

  // Навигация в карточке — только по текущей выдаче (те же фильтры и сортировка базы,
  // уже отданные этому менеджеру voyage_rcat_search) или по открытой подборке.
  const navTotal = activeList ? visible.length : Math.max(total, visible.length);
  const canPrev = idx > 0;
  const canNext = idx >= 0 && (idx < visible.length - 1 || (!activeList && hasMore));
  const goPrev = useCallback(() => { if (idx > 0) setOpenId(visible[idx - 1].id); }, [idx, visible]);
  const goNext = useCallback(async () => {
    if (idx < 0) return;
    if (idx < visible.length - 1) { setOpenId(visible[idx + 1].id); return; }
    if (activeList || !hasMore || loading) return;
    const more = await run(filters, page + 1); // следующая страница той же выдачи
    if (more.length) setOpenId(more[0].id);
  }, [idx, visible, activeList, hasMore, loading, run, filters, page]);

  const refreshAfterCard = () => { void loadLists(); if (activeList) void loadEntries(activeList); };
  // после приглашения отмечаем плитки на месте — без перезагрузки выдачи и сброса прокрутки
  const markInvited = (ids: string[]) => {
    const at = new Date().toISOString();
    const mark = (x: CatalogItem): CatalogItem => (ids.includes(x.id) ? { ...x, invite: { status: "pending", at } } : x);
    setItems((prev) => prev.map(mark));
    if (activeList) void loadEntries(activeList);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        {/* под кастинг + фильтры */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[14rem] flex-1 items-center gap-2 text-xs text-zinc-400">
            <span className="shrink-0">{c.fForCasting}</span>
            <select className={FIELD} value={forCasting} onChange={(e) => pickCasting(e.target.value)} disabled={!castings.length}>
              <option value="">{castings.length ? c.fForCastingPick : c.fForCastingNone}</option>
              {castings.map((cs) => (
                <option key={cs.id} value={cs.id}>{pickI18n(cs.title, lang) || cs.city} · {fmtRange(cs.startsOn, cs.endsOn, lang)}</option>
              ))}
            </select>
          </label>
          <button type="button" className={GHOST_BTN} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <Filter size={14} aria-hidden /> {c.fFilters}
          </button>
        </div>
        {showFilters && <FiltersForm c={c} value={filters} onApply={apply} onReset={() => { setForCasting(""); apply(EMPTY_FILTERS); }} />}

        {activeList ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={GHOST_BTN} onClick={() => setActiveList(null)}><ChevronLeft size={14} /> {c.shortAll}</button>
            <span className="text-sm text-zinc-200">{lists.find((l) => l.id === activeList)?.title}</span>
            {visible.length > 0 && (
              <button type="button" className={GOLD_BTN} onClick={() => setInvite(visible.map((x) => x.id))}><Send size={14} /> {c.shortInviteAll}</button>
            )}
            {unavailableCount > 0 && (
              <button type="button" className={GHOST_BTN} onClick={async () => { await pruneShortlist(activeList); await loadEntries(activeList); await loadLists(); }}>
                {c.shortPrune} ({unavailableCount})
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">{c.found(total)}</p>
        )}

        {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>}

        {visible.length === 0 && !loading ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
            {activeList ? c.shortEmpty : c.empty}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((it) => (
              <li key={it.id}><Tile item={it} c={c} lang={lang} watermark={watermark} onOpen={() => setOpenId(it.id)} /></li>
            ))}
            {activeList && Array.from({ length: unavailableCount }).map((_, i) => (
              <li key={`u${i}`} className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-600">
                {c.shortUnavailable}
              </li>
            ))}
          </ul>
        )}

        {!activeList && hasMore && (
          <div className="flex justify-center">
            <button type="button" className={GHOST_BTN} disabled={loading} onClick={() => run(filters, page + 1)}>
              {loading && <Loader2 size={14} className="animate-spin" />} {c.more}
            </button>
          </div>
        )}
        {loading && page === 0 && <p className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" /> {c.loading}</p>}
      </div>

      <aside className="space-y-4">
        <ShortlistsPanel c={c} lists={lists} active={activeList} onPick={setActiveList} onChanged={loadLists} />
        <SentInvitesPanel c={c} lang={lang} />
      </aside>

      {openId && (
        <CardDialog
          residentId={openId}
          c={c}
          lang={lang}
          watermark={watermark}
          lists={lists}
          onLimits={onLimits}
          onClose={() => { setOpenId(null); refreshAfterCard(); }}
          position={idx >= 0 ? idx + 1 : 0}
          total={navTotal}
          onPrev={canPrev ? goPrev : undefined}
          onNext={canNext ? goNext : undefined}
          nextLoading={loading && idx === visible.length - 1}
          paused={invite !== null}
          onInvite={(id) => setInvite([id])}
          onListsChanged={refreshAfterCard}
        />
      )}

      {invite && (
        <InviteDialog
          c={c}
          lang={lang}
          ids={invite}
          castings={castings}
          initialCasting={forCasting}
          onLimits={onLimits}
          onClose={(sent) => { setInvite(null); if (sent.length) markInvited(sent); }}
        />
      )}
    </div>
  );
}

/* ── плитка ────────────────────────────────────────────────────────── */

function Tile({ item, c, lang, watermark, onOpen }: { item: CatalogItem; c: CatalogCopy; lang: string; watermark: string; onOpen: () => void }) {
  const pf = photoFirstCopy(lang);
  const cover = item.photo; // фото — основа анкеты: обложка одна для всех, с видео и без
  return (
    <button type="button" onClick={onOpen} aria-label={`${c.cardOpen}: ${item.name}`}
      className="group block w-full overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 text-left transition hover:border-[#c9a961]/50">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full select-none object-cover" draggable={false} onContextMenu={(e) => e.preventDefault()} />
        ) : (
          <span className="flex h-full items-center justify-center text-zinc-700"><UserRound size={32} /></span>
        )}
        <WatermarkLayer text={watermark} />
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          <FreshnessChip value={item.freshness} c={c} />
          <VideoChip show={item.videoAllowed && item.hasVideo} label={pf.badgeVideo} />
        </span>
        {item.inShortlist && <BookmarkCheck size={16} className="absolute right-2 top-2 text-[#c9a961]" aria-label={c.shortIn} />}
        {item.invite && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-amber-100">{c.inviteStatus[item.invite.status]}</span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm text-zinc-100">{item.name}{item.age !== null ? `, ${item.age}` : ""}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
          {item.city && <span className="truncate">{item.city}</span>}
          {item.height !== null && <span>· {item.height} {c.cm}</span>}
          {item.photoCount > 0 && <span className="text-zinc-500">· {pf.photos(item.photoCount)}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5"><KycChip level={item.kycLevel} /><LanguagesLine languages={item.languages} /></div>
        <BusyLine busy={item.busy.slice(0, 2)} lang={lang} c={c} />
      </div>
    </button>
  );
}

/* ── фильтры ───────────────────────────────────────────────────────── */

function FiltersForm({ c, value, onApply, onReset }: { c: CatalogCopy; value: CatalogFilters; onApply: (f: CatalogFilters) => void; onReset: () => void }) {
  const { lang } = useLanguage();
  const pf = photoFirstCopy(lang);
  const [f, setF] = useState<CatalogFilters>(value);
  useEffect(() => setF(value), [value]);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return (
    <form className="grid gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => { e.preventDefault(); onApply(f); }}>
      <label className="text-xs text-zinc-400">{c.fCity}
        <input className={`${FIELD} mt-1`} value={f.city ?? ""} maxLength={60} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </label>
      <label className="text-xs text-zinc-400">{c.fLanguages}
        <input className={`${FIELD} mt-1`} placeholder="EN, ES" value={(f.languages ?? []).join(", ")}
          onChange={(e) => setF({ ...f, languages: e.target.value.split(/[\s,]+/).filter(Boolean).map((x) => x.toUpperCase()).slice(0, 5) })} />
      </label>
      <div className="text-xs text-zinc-400">{c.fHeight}, {c.cm}
        <div className="mt-1 flex gap-2">
          <input className={FIELD} inputMode="numeric" placeholder="160" value={f.height_min ?? ""} onChange={(e) => setF({ ...f, height_min: num(e.target.value) })} />
          <input className={FIELD} inputMode="numeric" placeholder="185" value={f.height_max ?? ""} onChange={(e) => setF({ ...f, height_max: num(e.target.value) })} />
        </div>
      </div>
      <label className="text-xs text-zinc-400">{c.fKyc}
        <select className={`${FIELD} mt-1`} value={f.kyc_min ?? 1} onChange={(e) => setF({ ...f, kyc_min: Number(e.target.value) })}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>KYC {n}+</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-400">{c.fSize}
        <select className={`${FIELD} mt-1`} value={f.size ?? ""} onChange={(e) => setF({ ...f, size: e.target.value || null })}>
          <option value="">—</option>
          {CLOTHING_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-400">{pf.fMaterials}
        <select className={`${FIELD} mt-1`} value={f.materials ?? "any"} onChange={(e) => setF({ ...f, video: undefined, materials: e.target.value as CatalogFilters["materials"] })}>
          {CATALOG_MATERIALS.map((m) => <option key={m} value={m}>{m === "video" ? pf.fMatVideo : m === "fresh" ? pf.fMatFresh : pf.fMatAny}</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-400">{pf.fSort}
        <select className={`${FIELD} mt-1`} value={f.sort ?? "updated"} onChange={(e) => setF({ ...f, sort: e.target.value as CatalogFilters["sort"] })}>
          {CATALOG_SORTS.map((o) => <option key={o} value={o}>{o === "new" ? pf.sortNew : pf.sortUpdated}</option>)}
        </select>
      </label>
      <div className="text-xs text-zinc-400 sm:col-span-2">{c.fDates}
        <div className="mt-1 flex gap-2">
          <input type="date" className={FIELD} value={f.free_from ?? ""} onChange={(e) => setF({ ...f, free_from: e.target.value || null })} />
          <input type="date" className={FIELD} value={f.free_to ?? ""} onChange={(e) => setF({ ...f, free_to: e.target.value || null })} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className={GOLD_BTN}>{c.fApply}</button>
        <button type="button" className={GHOST_BTN} onClick={onReset}>{c.fReset}</button>
      </div>
    </form>
  );
}

/* ── оверлей ───────────────────────────────────────────────────────── */

/**
 * Модальный слой поверх ВСЕГО экрана. Рендерится порталом в <body>: внутри
 * страницы он был в контексте наложения PageShell (`isolate`), поэтому шапка
 * сайта (z-50) и боковое меню (z-40) лежали поверх затемнения и закрывали
 * верх карточки, а у затемнения не было обработчика клика.
 * Закрытие по фону — только если и нажатие, и отпускание были на самом фоне
 * (выделение текста в карточке с отпусканием на фоне карточку не закрывает).
 */
function Overlay({ z, label, onBackdrop, children }: { z: number; label: string; onBackdrop: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // фон не прокручивается; позиция каталога сохраняется
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6"
      style={{ zIndex: z }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-catalog-backdrop=""
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnBackdrop.current) onBackdrop(); downOnBackdrop.current = false; }}
    >
      {children}
    </div>,
    document.body,
  );
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const NAV_BTN =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 text-xs text-zinc-300 transition hover:border-[#c9a961]/50 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a961]/50 disabled:pointer-events-none disabled:opacity-30";

/* ── анкета ────────────────────────────────────────────────────────── */

function CardDialog({ residentId, c, lang, watermark, lists, onLimits, onClose, onPrev, onNext, onInvite, onListsChanged, position, total, nextLoading, paused }: {
  residentId: string; c: CatalogCopy; lang: string; watermark: string; lists: Shortlist[];
  onLimits: (l: CatalogLimits | null) => void; onClose: () => void; onPrev?: () => void; onNext?: () => void | Promise<void>;
  onInvite: (id: string) => void; onListsChanged: () => void;
  position: number; total: number; nextLoading: boolean; paused: boolean;
}) {
  const [card, setCard] = useState<CatalogCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inLists, setInLists] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // фокус: при открытии запоминаем плитку, при закрытии возвращаем (без прокрутки страницы)
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => { returnFocus.current?.focus({ preventScroll: true }); };
  }, []);

  // смена анкеты: карточка остаётся открытой, грузится следующая, прокрутка — наверх
  useEffect(() => {
    let alive = true;
    setCard(null); setError(null); setNewTitle("");
    scrollRef.current?.scrollTo({ top: 0 });
    void openCatalogCard(residentId).then((r) => {
      if (!alive) return;
      if ("limits" in r && r.limits !== undefined) onLimits(r.limits);
      if (!r.ok) { setError(errText(c, r.reason)); return; }
      setCard(r.card);
      setInLists(new Set(r.card.shortlists));
    });
    return () => { alive = false; };
  }, [residentId, c, onLimits]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.defaultPrevented) return; // открыто окно приглашения — клавиши его
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return; // стрелки в поле ввода — для текста
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === "ArrowRight" && onNext) { e.preventDefault(); void onNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, paused]);

  const toggle = async (listId: string) => {
    const add = !inLists.has(listId);
    setBusy(true);
    const r = await toggleShortlist(listId, residentId, add);
    setBusy(false);
    if (!r.ok) { setError(errText(c, r.reason ?? "failed")); return; }
    setInLists((s) => { const n = new Set(s); if (add) n.add(listId); else n.delete(listId); return n; });
    onListsChanged();
  };

  const createAndAdd = async () => {
    const t = newTitle.trim();
    if (!t) return;
    setBusy(true);
    const r = await saveShortlist(null, t);
    if (r.ok && r.id) { await toggleShortlist(r.id, residentId, true); setInLists((s) => new Set(s).add(r.id)); setNewTitle(""); onListsChanged(); }
    else if (!r.ok) setError(errText(c, r.reason));
    setBusy(false);
  };

  return (
    <Overlay z={100} label={card?.name ?? c.cardOpen} onBackdrop={onClose}>
      <div className="flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:max-h-[92vh] sm:rounded-3xl">
        {/* навигация: вне прокручиваемой части — всегда на виду */}
        <nav aria-label={c.cardOpen} className="flex shrink-0 items-center gap-2 border-b border-zinc-800/80 bg-zinc-950/95 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:pt-2.5">
          <button type="button" className={NAV_BTN} onClick={onClose} title={c.cardBack}>
            <ArrowLeft size={15} aria-hidden /> <span className="hidden sm:inline">{c.cardBack}</span>
          </button>
          <div className="mx-auto flex items-center gap-1.5 sm:gap-2">
            <button type="button" className={NAV_BTN} disabled={!onPrev} onClick={onPrev} aria-label={c.cardPrev} title={c.cardPrev}>
              <ChevronLeft size={16} aria-hidden /> <span className="hidden sm:inline">{c.cardPrev}</span>
            </button>
            <span className="min-w-[4.5rem] text-center font-mono text-[11px] tabular-nums text-[#c9a961]" aria-live="polite">
              {position > 0 && total > 0 ? c.cardPos(position, total) : "—"}
            </span>
            <button type="button" className={NAV_BTN} disabled={!onNext || nextLoading} onClick={() => onNext && void onNext()} aria-label={c.cardNext} title={c.cardNext}>
              <span className="hidden sm:inline">{c.cardNext}</span> {nextLoading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ChevronRight size={16} aria-hidden />}
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label={c.close} title={c.close}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition hover:border-[#c9a961]/50 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a961]/50">
            <X size={18} aria-hidden />
          </button>
        </nav>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
          {error ? (
            <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">{error}</p>
          ) : !card ? (
            <p className="flex items-center gap-2 py-8 text-sm text-zinc-500"><Loader2 size={14} className="animate-spin" /> {c.loading}</p>
          ) : (
            <CatalogCardView
              key={card.id}
              card={card}
              lang={lang}
              watermark={watermark}
              toolbar={
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {card.noInvites ? (
                      <span className="text-xs text-zinc-500">{c.inviteBlocked}</span>
                    ) : (
                      <button type="button" className={GOLD_BTN} onClick={() => onInvite(card.id)}><Send size={14} /> {c.inviteTitle}</button>
                    )}
                    {card.invite && <span className="self-center text-xs text-amber-100">{c.inviteStatus[card.invite.status]} · {fmtDay(card.invite.at, lang)}</span>}
                  </div>
                  <div className="rounded-xl border border-zinc-800 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.shortTitle}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lists.map((l) => (
                        <button key={l.id} type="button" disabled={busy} onClick={() => toggle(l.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${inLists.has(l.id) ? "border-[#c9a961]/60 bg-[#c9a961]/15 text-amber-100" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
                          {inLists.has(l.id) ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />} {l.title}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input className={FIELD} maxLength={80} placeholder={c.shortNewPlaceholder} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                      <button type="button" className={GHOST_BTN} disabled={busy || !newTitle.trim()} onClick={createAndAdd}>{c.shortCreate}</button>
                    </div>
                  </div>
                </div>
              }
            />
          )}
          <p className="mt-6 hidden text-center text-[10px] text-zinc-600 sm:block">{c.cardNavHint}</p>
        </div>
      </div>
    </Overlay>
  );
}

/* ── приглашение ───────────────────────────────────────────────────── */

function InviteDialog({ c, lang, ids, castings, initialCasting, onLimits, onClose }: {
  c: CatalogCopy; lang: string; ids: string[]; castings: ManagerCasting[]; initialCasting: string;
  onLimits: (l: CatalogLimits | null) => void; onClose: (sentIds: string[]) => void;
}) {
  const [sent, setSent] = useState<string[]>([]);
  const close = useCallback(() => onClose(sent), [onClose, sent]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  const [castingId, setCastingId] = useState(initialCasting || castings[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const msgOk = message.trim() === "" || inviteMessageOk(message);

  const send = async () => {
    setBusy(true); setResult(null); setFailures([]);
    const r = await inviteFromCatalog(ids, castingId, message.trim() || null);
    setBusy(false);
    if (!r.ok) { setResult(errText(c, r.reason)); return; }
    if (r.limits) onLimits(r.limits);
    const ok = r.results.filter((x) => x.ok).length;
    setSent(r.results.filter((x) => x.ok).map((x) => x.residentId));
    setResult(ids.length === 1 ? (ok ? c.inviteSent : errText(c, r.results[0]?.reason ?? "failed")) : c.inviteBatchResult(ok, ids.length));
    if (ids.length > 1) {
      const reasons = new Map<string, number>();
      r.results.filter((x) => !x.ok).forEach((x) => { const t = errText(c, x.reason ?? "failed"); reasons.set(t, (reasons.get(t) ?? 0) + 1); });
      setFailures(Array.from(reasons.entries()).map(([t, n]) => `${t} × ${n}`));
    }
  };

  return (
    <Overlay z={110} label={c.inviteTitle} onBackdrop={close}>
      <div className="w-full max-w-lg rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg text-zinc-100">{c.inviteTitle}{ids.length > 1 ? ` · ${ids.length}` : ""}</h2>
          <button type="button" onClick={close} aria-label={c.close} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-white/5"><X size={18} /></button>
        </div>
        {!castings.length ? (
          <p className="mt-3 text-sm text-zinc-400">{c.inviteNoCastings}</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-zinc-400">{c.inviteCasting}
              <select className={`${FIELD} mt-1`} value={castingId} onChange={(e) => setCastingId(e.target.value)}>
                {castings.map((cs) => <option key={cs.id} value={cs.id}>{pickI18n(cs.title, lang) || cs.city} · {fmtRange(cs.startsOn, cs.endsOn, lang)}</option>)}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">{c.inviteMessage}
              <textarea className={`${FIELD} mt-1 min-h-24 py-2`} maxLength={INVITE_MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} />
              <span className={`mt-1 block text-[11px] ${msgOk ? "text-zinc-600" : "text-rose-300"}`}>{msgOk ? c.inviteMessageHint : c.errors.message_contacts} · {message.length}/{INVITE_MESSAGE_MAX}</span>
            </label>
            {result && <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200">{result}</p>}
            {failures.length > 0 && <ul className="space-y-0.5 text-[11px] text-zinc-500">{failures.map((f) => <li key={f}>{f}</li>)}</ul>}
            <div className="flex gap-2">
              <button type="button" className={GOLD_BTN} disabled={busy || !castingId || !msgOk || !!result} onClick={send}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {c.inviteSend}
              </button>
              <button type="button" className={GHOST_BTN} onClick={close}>{c.close}</button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

/* ── подборки ──────────────────────────────────────────────────────── */

function ShortlistsPanel({ c, lists, active, onPick, onChanged }: {
  c: CatalogCopy; lists: Shortlist[]; active: string | null; onPick: (id: string | null) => void; onChanged: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    const r = await saveShortlist(null, title);
    if (!r.ok) { setError(errText(c, r.reason)); return; }
    setTitle(""); setError(null); await onChanged();
  };
  return (
    <Panel className="p-4">
      <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-zinc-400"><FolderHeart size={14} /> {c.shortTitle}</h2>
      <ul className="mt-3 space-y-1">
        {lists.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(active === l.id ? null : l.id)}
              className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition ${active === l.id ? "bg-[#c9a961]/15 text-amber-100" : "text-zinc-300 hover:bg-white/5"}`}>
              {l.title} <span className="text-zinc-500">· {l.count}</span>
            </button>
            {confirmDel === l.id ? (
              <button type="button" className="text-[11px] text-rose-300" onClick={async () => { await deleteShortlist(l.id); setConfirmDel(null); if (active === l.id) onPick(null); await onChanged(); }}>
                {c.shortDeleteConfirm}
              </button>
            ) : (
              <button type="button" className="rounded p-1 text-zinc-600 hover:text-rose-300" aria-label={c.shortDelete} onClick={() => setConfirmDel(l.id)}><Trash2 size={13} /></button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className={FIELD} maxLength={80} placeholder={c.shortNewPlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className={GHOST_BTN} disabled={!title.trim()} onClick={create}>{c.shortCreate}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </Panel>
  );
}

function SentInvitesPanel({ c, lang }: { c: CatalogCopy; lang: string }) {
  const [items, setItems] = useState<SentInvite[]>([]);
  const load = useCallback(async () => { const r = await sentCatalogInvites(); if (r.ok) setItems(r.invites); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!items.length) return null;
  return (
    <Panel className="p-4">
      <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-zinc-400"><Send size={14} /> {c.sentTitle}</h2>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 20).map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate text-zinc-200">{i.name ?? c.sentHidden}</p>
              <p className="text-zinc-500">{i.city} · {fmtDay(i.startsOn, lang)} · {c.inviteStatus[i.status]}</p>
            </div>
            {i.status === "pending" && (
              <button type="button" className="shrink-0 text-[11px] text-zinc-400 hover:text-rose-300" onClick={async () => { await withdrawCatalogInvite(i.id); await load(); }}>
                {c.sentWithdraw}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
