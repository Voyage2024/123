"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток — экран менеджера (этап 2)
 * app/components/catalog/ResidentCatalog.tsx
 *
 * Всё, что тут видно, отдаёт база через voyage_rcat_*: доступ, пауза,
 * «скрыться от менеджера» и лимиты проверяются на каждый вызов.
 * Обложки, фото и видео — под именным водяным знаком менеджера (D3).
 * Приглашение — только в свой кастинг (D1), дальше обычный путь кастинга.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookmarkCheck, BookmarkPlus, ChevronLeft, ChevronRight, Filter, FolderHeart, Loader2, Lock, Send, Trash2, UserRound, X,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { PageHeader, PageShell, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import {
  deleteShortlist, getCatalogViewer, inviteFromCatalog, listShortlists, myCatalogCastings, openCatalogCard, pruneShortlist,
  saveShortlist, searchCatalog, sentCatalogInvites, shortlistEntries, toggleShortlist, withdrawCatalogInvite,
} from "@/app/actions/resident-catalog";
import { WatermarkLayer } from "@/app/components/media/WatermarkLayer";
import { CatalogCardView } from "@/app/components/catalog/CatalogCardView";
import { BusyLine, FIELD, FreshnessChip, GHOST_BTN, GOLD_BTN, KycChip, LanguagesLine } from "@/app/components/catalog/catalog-ui";
import {
  CLOTHING_SIZES, INVITE_MESSAGE_MAX, catalogCopy, fmtDay, fmtRange, inviteMessageOk, pickI18n,
  type CatalogCard, type CatalogCopy, type CatalogFailure, type CatalogFilters, type CatalogItem, type CatalogLimits,
  type CatalogViewer, type ManagerCasting, type SentInvite, type Shortlist, type ShortlistEntry,
} from "@/lib/resident-catalog";

const EMPTY_FILTERS: CatalogFilters = { video: "any" };
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
    if (!r.ok) { setError(errText(c, r.reason)); return; }
    setItems((prev) => (p === 0 ? r.items : [...prev, ...r.items]));
    setTotal(r.total); setHasMore(r.hasMore); setPage(r.page);
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

  const refreshAfterCard = () => { void loadLists(); if (activeList) void loadEntries(activeList); };

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
          key={openId}
          residentId={openId}
          c={c}
          lang={lang}
          watermark={watermark}
          lists={lists}
          onLimits={onLimits}
          onClose={() => { setOpenId(null); refreshAfterCard(); }}
          onPrev={idx > 0 ? () => setOpenId(visible[idx - 1].id) : undefined}
          onNext={idx >= 0 && idx < visible.length - 1 ? () => setOpenId(visible[idx + 1].id) : undefined}
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
          onClose={() => { setInvite(null); if (!activeList) void run(filters, 0); else void loadEntries(activeList); }}
        />
      )}
    </div>
  );
}

/* ── плитка ────────────────────────────────────────────────────────── */

function Tile({ item, c, lang, watermark, onOpen }: { item: CatalogItem; c: CatalogCopy; lang: string; watermark: string; onOpen: () => void }) {
  const cover = item.poster ?? item.photo;
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
        <span className="absolute left-2 top-2 flex flex-wrap gap-1"><FreshnessChip value={item.freshness} c={c} /></span>
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
        </p>
        <div className="flex flex-wrap items-center gap-1.5"><KycChip level={item.kycLevel} /><LanguagesLine languages={item.languages} /></div>
        <BusyLine busy={item.busy.slice(0, 2)} lang={lang} c={c} />
      </div>
    </button>
  );
}

/* ── фильтры ───────────────────────────────────────────────────────── */

function FiltersForm({ c, value, onApply, onReset }: { c: CatalogCopy; value: CatalogFilters; onApply: (f: CatalogFilters) => void; onReset: () => void }) {
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
      <label className="text-xs text-zinc-400">{c.fVideo}
        <select className={`${FIELD} mt-1`} value={f.video ?? "any"} onChange={(e) => setF({ ...f, video: e.target.value as CatalogFilters["video"] })}>
          <option value="any">{c.fVideoAny}</option><option value="has">{c.fVideoHas}</option><option value="fresh">{c.fVideoFresh}</option>
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

/* ── анкета ────────────────────────────────────────────────────────── */

function CardDialog({ residentId, c, lang, watermark, lists, onLimits, onClose, onPrev, onNext, onInvite, onListsChanged }: {
  residentId: string; c: CatalogCopy; lang: string; watermark: string; lists: Shortlist[];
  onLimits: (l: CatalogLimits | null) => void; onClose: () => void; onPrev?: () => void; onNext?: () => void;
  onInvite: (id: string) => void; onListsChanged: () => void;
}) {
  const [card, setCard] = useState<CatalogCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inLists, setInLists] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
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
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={card?.name ?? c.cardOpen}>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button type="button" className="rounded-full p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-30" disabled={!onPrev} onClick={onPrev} aria-label={c.cardPrev}><ChevronLeft size={18} /></button>
            <button type="button" className="rounded-full p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-30" disabled={!onNext} onClick={onNext} aria-label={c.cardNext}><ChevronRight size={18} /></button>
          </div>
          <button type="button" onClick={onClose} aria-label={c.close} className="rounded-full p-2 text-zinc-400 hover:bg-white/5"><X size={18} /></button>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">{error}</p>
        ) : !card ? (
          <p className="flex items-center gap-2 py-8 text-sm text-zinc-500"><Loader2 size={14} className="animate-spin" /> {c.loading}</p>
        ) : (
          <CatalogCardView
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
      </div>
    </div>
  );
}

/* ── приглашение ───────────────────────────────────────────────────── */

function InviteDialog({ c, lang, ids, castings, initialCasting, onLimits, onClose }: {
  c: CatalogCopy; lang: string; ids: string[]; castings: ManagerCasting[]; initialCasting: string;
  onLimits: (l: CatalogLimits | null) => void; onClose: () => void;
}) {
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
    setResult(ids.length === 1 ? (ok ? c.inviteSent : errText(c, r.results[0]?.reason ?? "failed")) : c.inviteBatchResult(ok, ids.length));
    if (ids.length > 1) {
      const reasons = new Map<string, number>();
      r.results.filter((x) => !x.ok).forEach((x) => { const t = errText(c, x.reason ?? "failed"); reasons.set(t, (reasons.get(t) ?? 0) + 1); });
      setFailures(Array.from(reasons.entries()).map(([t, n]) => `${t} × ${n}`));
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={c.inviteTitle}>
      <div className="w-full max-w-lg rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg text-zinc-100">{c.inviteTitle}{ids.length > 1 ? ` · ${ids.length}` : ""}</h2>
          <button type="button" onClick={onClose} aria-label={c.close} className="rounded-full p-2 text-zinc-400 hover:bg-white/5"><X size={18} /></button>
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
              <button type="button" className={GHOST_BTN} onClick={onClose}>{c.close}</button>
            </div>
          </div>
        )}
      </div>
    </div>
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
