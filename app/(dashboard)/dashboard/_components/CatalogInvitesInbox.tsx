"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Резидентка — «Вас нашли в каталоге» (этап 2)
 * app/(dashboard)/dashboard/_components/CatalogInvitesInbox.tsx
 *
 * Приглашения менеджеров из каталога в их кастинг (решение D1: только
 * в кастинг). Ответы: «Интересно» / «Не сейчас» / «Не приглашать меня».
 * «Интересно» — это не отклик: дальше обычная кнопка кастинга, опцион
 * и рукопожатие по прежним правилам. Пусто — блок не рендерится.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Loader2, MapPin, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { getMyCatalogInvites, respondCatalogInvite } from "@/app/actions/catalog-visibility";
import { catalogCopy, fmtDay, fmtRange, pickI18n, type ResidentInvite } from "@/lib/resident-catalog";
import { GHOST_BTN, GOLD_BTN } from "@/app/components/catalog/catalog-ui";

const ACTIVE = new Set(["pending", "interested"]);

export default function CatalogInvitesInbox() {
  const { lang } = useLanguage();
  const c = catalogCopy(lang);
  const [items, setItems] = useState<ResidentInvite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getMyCatalogInvites();
    // миграция не накатана или роль не resident — блок просто не показываем
    setItems(r.ok ? r.invites.filter((i) => ACTIVE.has(i.status)) : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (id: string, a: "interested" | "not_now" | "blocked") => {
    setBusy(id);
    setError(null);
    const r = await respondCatalogInvite(id, a);
    setBusy(null);
    setConfirmBlock(null);
    if (!r.ok) setError(c.errors[r.reason] ?? c.errors.failed);
    await load();
  };

  if (!items || !items.length) return null;

  return (
    <section className="space-y-3" aria-label={c.inboxTitle}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c9a961]">{c.inboxKicker}</p>
        <h2 className="mt-1 text-lg text-zinc-100">{c.inboxTitle}</h2>
        <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
          <ShieldCheck size={12} aria-hidden /> {c.inboxNote}
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p>}

      {items.map((inv) => {
        const title = pickI18n(inv.casting.title, lang) || inv.casting.city;
        const isBusy = busy === inv.id;
        return (
          <article key={inv.id} className="rounded-[18px] border border-[#c9a961]/25 bg-zinc-900/50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base text-zinc-100">{title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zinc-400">
                  <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {inv.casting.city}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden /> {fmtRange(inv.casting.startsOn, inv.casting.endsOn, lang)}</span>
                </p>
              </div>
              <span className="rounded-full border border-zinc-700/70 px-2 py-0.5 text-[10px] text-zinc-400">
                {inv.status === "interested" ? c.inviteStatus.interested : c.inboxUntil(fmtDay(inv.expiresAt, lang))}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-4">
              <div><dt className="text-zinc-500">{c.inboxFrom}</dt><dd className="text-zinc-200">{inv.manager.label}{inv.manager.badge ? ` · ${inv.manager.badge}` : ""}</dd></div>
              <div><dt className="text-zinc-500">&nbsp;</dt><dd className="text-zinc-400">{c.inboxTours(inv.manager.toursDone)}</dd></div>
              {inv.casting.feeAmount != null && (
                <div><dt className="text-zinc-500">{c.inboxFee}</dt><dd className="text-zinc-200">{inv.casting.feeAmount} {inv.casting.feeCurrency ?? ""}</dd></div>
              )}
              <div>
                <dt className="text-zinc-500">{c.inboxFlight} / {c.inboxHotel}</dt>
                <dd className="text-zinc-300">
                  {(c.paidBy as Record<string, string>)[inv.casting.flightPaidBy] ?? "—"} / {(c.paidBy as Record<string, string>)[inv.casting.hotelPaidBy] ?? "—"}
                </dd>
              </div>
            </dl>

            {inv.message && (
              <p className="mt-3 flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-300">
                <MessageSquareQuote size={14} className="mt-0.5 shrink-0 text-[#c9a961]" aria-hidden /> {inv.message}
              </p>
            )}

            {inv.status === "interested" ? (
              <div className="mt-4 space-y-2">
                <Link href={`/dashboard/castings/${inv.casting.id}`} className={GOLD_BTN}>
                  {c.inboxOpenCasting} <ArrowRight size={14} aria-hidden />
                </Link>
                <p className="text-[12px] text-zinc-500">
                  {inv.responded ? c.inviteStatus.interested : !inv.openToTours ? c.inboxOpenToursHint : inv.canRespond ? c.inboxRespondHint : c.inboxCantRespond}
                </p>
              </div>
            ) : confirmBlock === inv.id ? (
              <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-3">
                <p className="text-[12px] text-rose-100/90">{c.inboxBlockConfirm}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={GHOST_BTN} disabled={isBusy} onClick={() => answer(inv.id, "blocked")}>
                    {isBusy && <Loader2 size={14} className="animate-spin" aria-hidden />} {c.inboxBlock}
                  </button>
                  <button type="button" className={GHOST_BTN} onClick={() => setConfirmBlock(null)}>{c.close}</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={GOLD_BTN} disabled={isBusy || !inv.casting.open} onClick={() => answer(inv.id, "interested")}>
                  {isBusy && <Loader2 size={14} className="animate-spin" aria-hidden />} {c.inboxInterested}
                </button>
                <button type="button" className={GHOST_BTN} disabled={isBusy} onClick={() => answer(inv.id, "not_now")}>{c.inboxNotNow}</button>
                <button type="button" className={`${GHOST_BTN} text-zinc-400`} disabled={isBusy} onClick={() => setConfirmBlock(inv.id)}>{c.inboxBlock}</button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
