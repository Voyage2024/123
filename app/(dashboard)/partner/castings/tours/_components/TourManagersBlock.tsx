"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог туров — блок «Ответственные менеджеры» (только owner)
 * app/(dashboard)/partner/castings/tours/_components/TourManagersBlock.tsx
 *
 * Новый тур (tourId = null): менеджеры набираются в staged и назначаются
 * сразу после сохранения тура (TourEditor → assignCatalogManager).
 * Существующий тур: назначение и отзыв сразу через server actions
 * app/actions/tour-catalog-managers.ts → RPC владельца в базе.
 * Отзыв не удаляет тур, кастинги и поездки; история сохраняется.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, History, LoaderCircle, Search, ShieldAlert, UserMinus, UserPlus, Users, X } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import {
  assignCatalogManager,
  listCatalogAssignments,
  revokeCatalogManager,
  searchCatalogManagers,
} from "@/app/actions/tour-catalog-managers";
import { VOYAGE_MANAGEMENT_ID } from "@/lib/organizer";
import type { CatalogAssignment, ManagerCandidate } from "@/lib/tour-catalog";
import { TOUR_MANAGERS_COPY, formatDay } from "@/app/(dashboard)/partner/castings/tours/_components/tourManagersCopy";

const INPUT =
  "min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/50 focus:outline-none";

export function TourManagersBlock({
  tourId,
  lang,
  staged,
  onStagedChange,
  disabled,
  onChanged,
}: {
  tourId: string | null;
  lang: Lang;
  /** Новый тур: выбранные, но ещё не назначенные менеджеры */
  staged: ManagerCandidate[];
  onStagedChange: (next: ManagerCandidate[]) => void;
  disabled?: boolean;
  /** Назначения изменились — обновить карточки каталога */
  onChanged?: () => void;
}) {
  const t = TOUR_MANAGERS_COPY[lang] ?? TOUR_MANAGERS_COPY.EN;
  const [assignments, setAssignments] = useState<CatalogAssignment[]>([]);
  const [loading, setLoading] = useState(Boolean(tourId));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManagerCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<{ id: string; reason: string; transferTo: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    if (!tourId) return;
    setLoading(true);
    const res = await listCatalogAssignments(tourId);
    setLoading(false);
    if (!res.ok) {
      setError(t.errors[res.reason]);
      return;
    }
    setAssignments(res.assignments);
  }, [tourId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Поиск с задержкой 250 мс
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchCatalogManagers(query);
      if (!alive) return;
      setSearching(false);
      if (res.ok) setResults(res.managers);
      else setError(t.errors[res.reason]);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, t]);

  const active = assignments.filter((a) => a.isActive);
  const history = assignments.filter((a) => !a.isActive);
  const assignedIds = new Set([...active.map((a) => a.managerId), ...staged.map((m) => m.id)]);

  const assign = async (candidate: ManagerCandidate) => {
    setError(null);
    setNotice(null);
    if (!tourId) {
      if (!assignedIds.has(candidate.id)) onStagedChange([...staged, candidate]);
      return;
    }
    setBusy(candidate.id);
    const res = await assignCatalogManager(tourId, candidate.id);
    setBusy(null);
    if (!res.ok) {
      setError(t.errors[res.reason]);
      return;
    }
    await load();
    onChanged?.();
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setBusy(revoking.id);
    setError(null);
    const res = await revokeCatalogManager(revoking.id, revoking.reason, revoking.transferTo || null);
    setBusy(null);
    if (!res.ok) {
      setError(t.errors[res.reason]);
      return;
    }
    setRevoking(null);
    setNotice(t.revokeDone(res.transferred, res.kept));
    await load();
    onChanged?.();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-300">
            <Users size={13} className="text-amber-200/80" /> {t.managersTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{tourId ? t.managersHint : t.managersNewHint}</p>
        </div>
        {loading && <LoaderCircle size={15} className="mt-0.5 shrink-0 animate-spin text-zinc-500" />}
      </div>

      {/* Назначенные (или выбранные для нового тура) */}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {staged.map((m) => (
            <motion.li
              key={`staged-${m.id}`}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2"
            >
              <ManagerLabel name={m.name} agency={m.agency} isSystem={m.isSystem} t={t} />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">{t.pending}</span>
                <button
                  type="button"
                  onClick={() => onStagedChange(staged.filter((x) => x.id !== m.id))}
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:text-zinc-200"
                  aria-label={t.revoke}
                  disabled={disabled}
                >
                  <X size={14} />
                </button>
              </div>
            </motion.li>
          ))}
          {active.map((a) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <ManagerLabel name={a.managerName} isSystem={a.managerIsSystem} t={t} />
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    <span className="mr-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-400/20 px-1.5 text-[10px] text-emerald-200/80">
                      <Check size={10} /> {t.active}
                    </span>
                    {t.assignedOn(formatDay(a.assignedAt, lang), a.assignedByName)}
                    {a.source === "backfill" ? ` · ${t.backfill}` : ""}
                    {!a.managerEligible ? ` · ${t.inactiveAccount}` : ""}
                  </p>
                </div>
                {revoking?.id !== a.id && (
                  <button
                    type="button"
                    disabled={disabled || busy !== null}
                    onClick={() => setRevoking({ id: a.id, reason: "", transferTo: "" })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-400/20 px-3 text-xs text-rose-300 transition hover:bg-rose-400/5 disabled:opacity-50"
                  >
                    <UserMinus size={13} /> {t.revoke}
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {revoking?.id === a.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 grid gap-3 border-t border-zinc-800 pt-3 sm:grid-cols-2">
                      <label className="block space-y-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        <span>{t.revokeReason}</span>
                        <input
                          className={INPUT}
                          maxLength={500}
                          value={revoking.reason}
                          onChange={(e) => setRevoking({ ...revoking, reason: e.target.value })}
                        />
                      </label>
                      <label className="block space-y-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        <span>{t.transferTo}</span>
                        <select
                          className={INPUT}
                          value={revoking.transferTo}
                          onChange={(e) => setRevoking({ ...revoking, transferTo: e.target.value })}
                        >
                          <option value="">{t.transferNone}</option>
                          {a.managerId !== VOYAGE_MANAGEMENT_ID && <option value={VOYAGE_MANAGEMENT_ID}>VOYAGE Management</option>}
                          {active
                            .filter((o) => o.id !== a.id && o.managerId && o.managerId !== VOYAGE_MANAGEMENT_ID && o.managerEligible)
                            .map((o) => (
                              <option key={o.id} value={o.managerId ?? ""}>
                                {o.managerName}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => setRevoking(null)}
                          aria-label="Cancel"
                          className="inline-flex min-h-9 items-center rounded-lg border border-zinc-800 px-3 text-xs text-zinc-300 hover:text-white"
                        >
                          <X size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirmRevoke()}
                          disabled={busy !== null}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-400/50 bg-rose-500/15 px-3 text-xs text-rose-100 disabled:opacity-50"
                        >
                          {busy === a.id ? <LoaderCircle size={13} className="animate-spin" /> : <UserMinus size={13} />} {t.revokeConfirm}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </AnimatePresence>
        {!loading && active.length === 0 && staged.length === 0 && (
          <li className="rounded-xl border border-dashed border-zinc-800 px-3 py-3 text-xs text-zinc-500">{t.noManagers}</li>
        )}
      </ul>

      {/* Поиск менеджеров */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className={`${INPUT} pl-9`}
            value={query}
            placeholder={t.search}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.search}
          />
          {searching && <LoaderCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500" />}
        </div>
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {results.map((m) => {
            const taken = assignedIds.has(m.id);
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 transition hover:bg-zinc-900/60">
                <ManagerLabel name={m.name} agency={m.agency} telegram={m.telegram} isSystem={m.isSystem} t={t} />
                <button
                  type="button"
                  disabled={taken || disabled || busy !== null}
                  onClick={() => void assign(m)}
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition ${taken ? "border-zinc-800 text-zinc-500" : "border-amber-200/30 text-amber-100 hover:bg-amber-200/10"} disabled:cursor-not-allowed`}
                >
                  {busy === m.id ? <LoaderCircle size={12} className="animate-spin" /> : taken ? <Check size={12} /> : <UserPlus size={12} />}
                  {taken ? t.added : t.add}
                </button>
              </li>
            );
          })}
          {!searching && results.length === 0 && <li className="px-3 py-1.5 text-xs text-zinc-500">{t.searchEmpty}</li>}
        </ul>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-200">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {notice && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-100">{notice}</p>}

      {/* История назначений */}
      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-amber-100"
          >
            <History size={13} /> {showHistory ? t.hideHistory : t.showHistory(history.length)}
          </button>
          <AnimatePresence initial={false}>
            {showHistory && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 space-y-1.5 overflow-hidden"
              >
                {history.map((a) => (
                  <li key={a.id} className="rounded-xl border border-zinc-800/60 px-3 py-2 text-[11px] text-zinc-500">
                    <span className="text-zinc-300">{a.managerName}</span> · {t.assignedOn(formatDay(a.assignedAt, lang), a.assignedByName)} ·{" "}
                    <span className="text-rose-200/70">{t.revokedOn(formatDay(a.revokedAt, lang), a.revokedByName)}</span>
                    {a.revokeReason ? ` · «${a.revokeReason}»` : ""}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function ManagerLabel({
  name,
  agency,
  telegram,
  isSystem,
  t,
}: {
  name: string;
  agency?: string | null;
  telegram?: string | null;
  isSystem: boolean;
  t: (typeof TOUR_MANAGERS_COPY)["EN"];
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-100">
      {isSystem ? <Building2 size={14} className="shrink-0 text-amber-200/80" /> : <Users size={14} className="shrink-0 text-zinc-500" />}
      <span className="truncate">{name}</span>
      {isSystem && (
        <span className="shrink-0 rounded-full border border-amber-200/30 px-1.5 text-[10px] uppercase tracking-[0.14em] text-amber-100/80">{t.systemBadge}</span>
      )}
      {agency && agency !== name && <span className="hidden truncate text-xs text-zinc-500 sm:inline">{agency}</span>}
      {telegram && <span className="hidden shrink-0 font-mono text-[11px] text-zinc-500 sm:inline">@{telegram.replace(/^@/, "")}</span>}
    </span>
  );
}
