"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Резидентка — «Вас зовут в тур» (личные приглашения)
 * app/(dashboard)/dashboard/_components/TourInvitesInbox.tsx
 *
 * Прямое приглашение менеджера-скаута в его тур, мимо публичного
 * кастинга: «Принять участие» → строка в partner_tour_members →
 * ссылка «Открыть Комнату тура». Пусто — блок не рендерится.
 * Плашка «Ваш менеджер» — если модель закреплена за скаутом.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Loader2, MapPin, MessageSquareQuote, UserRoundCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { respondTourInvite } from "@/app/actions/scouting";
import { fmtDateTime, fmtDay, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, Notice } from "@/app/components/tour-ops/ops-ui";
import { scoutError } from "@/lib/scouting/i18n";
import { parseMyTourInvites, type MyTourInvites } from "@/lib/scouting/types";
import { INVITE_TONE, tourRange, useScout } from "@/app/components/scouting/scout-ui";

export default function TourInvitesInbox() {
  const { s, lang } = useScout();
  const tz = viewerTimezone(null);
  const [data, setData] = useState<MyTourInvites | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("voyage_my_tour_invites");
    // RPC ещё не накатили или роль не resident — блок просто не показываем
    setData(e ? null : parseMyTourInvites(d));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (id: string, accept: boolean) => {
    setBusy(id);
    setError(null);
    const r = await respondTourInvite(id, accept);
    setBusy(null);
    setConfirmDecline(null);
    if (!r.ok) setError(scoutError(s, r.code));
    await load();
  };

  if (!data) return null;
  const visible = data.invites;
  if (!visible.length && !data.scout) return null;

  return (
    <section className="space-y-3" aria-label={s.inbox.title}>
      {data.scout && (
        <p className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-[12px] text-amber-100/90">
          <UserRoundCheck className="size-3.5" /> {s.inbox.scout(data.scout.name)}
          {data.scout.since && <span className="text-amber-100/50">· {s.inbox.scoutSince(fmtDay(data.scout.since, tz, lang))}</span>}
        </p>
      )}
      {visible.length > 0 && (
        <>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">{s.inbox.eyebrow}</p>
            <h2 className="mt-1 text-xl font-medium text-zinc-50">{s.inbox.title}</h2>
          </div>
          {error && <Notice tone="rose">{error}</Notice>}
          <ul className="grid gap-3 lg:grid-cols-2">
            {visible.map((i) => {
              const open = i.status === "invited";
              return (
                <Panel as="article" key={i.id} className={`p-5 ${open ? "border-amber-200/30" : "opacity-80"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-lg text-zinc-50"><MapPin className="size-4 text-amber-200/70" /> {i.city}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-zinc-400"><CalendarDays className="size-3.5" /> {tourRange(i.departsAt, i.returnsAt, tz, lang)}</p>
                      {i.managerName && <p className="mt-1 text-[12px] text-zinc-500">{s.inbox.from(i.managerName)}</p>}
                    </div>
                    <Chip className={INVITE_TONE[i.status] ?? INVITE_TONE.revoked}>
                      {open ? s.inbox.until(fmtDateTime(i.expiresAt, tz, lang)) : s.tourInvite.status[i.status] ?? i.status}
                    </Chip>
                  </div>
                  {i.message && (
                    <p className="mt-3 flex gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-[13px] leading-relaxed text-zinc-300">
                      <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-amber-200/50" /> {i.message}
                    </p>
                  )}
                  {open && i.busy && <div className="mt-3"><Notice tone="amber">{s.inbox.busy}</Notice></div>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {open && confirmDecline !== i.id && (
                      <>
                        <button type="button" className={BTN_GOLD} disabled={busy === i.id || i.busy} onClick={() => answer(i.id, true)}>
                          {busy === i.id ? <Loader2 className="size-4 animate-spin" /> : null} {s.inbox.accept}
                        </button>
                        <button type="button" className={BTN_GHOST} disabled={busy === i.id} onClick={() => setConfirmDecline(i.id)}>{s.inbox.decline}</button>
                      </>
                    )}
                    {open && confirmDecline === i.id && (
                      <>
                        <span className="text-[12px] text-zinc-400">{s.inbox.confirmDecline}</span>
                        <button type="button" className={BTN_GHOST} disabled={busy === i.id} onClick={() => answer(i.id, false)}>{s.inbox.decline}</button>
                        <button type="button" className="min-h-9 px-3 text-xs text-zinc-500 hover:text-zinc-300" onClick={() => setConfirmDecline(null)}>×</button>
                      </>
                    )}
                    {i.status === "accepted" && (
                      <Link href={`/dashboard/tour-room/${i.tourId}`} className={BTN_GOLD}>
                        {s.inbox.openRoom} <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </div>
                </Panel>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
