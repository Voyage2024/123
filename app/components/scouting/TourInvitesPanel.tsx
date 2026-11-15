"use client";

/* ──────────────────────────────────────────────────────────────────────
 * Доска тура → вкладка «Прямые приглашения» (менеджер тура и owner)
 *   кандидаты — модели, закреплённые за организатором тура (с причиной,
 *   если позвать нельзя); отправленные приглашения и их статусы.
 * Плюс блок скаут-бонусов для кассы тура (ScoutCashboxBlock).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, Check, Loader2, Send, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, Panel, SectionHeader } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { inviteModelsToTour, revokeTourInvite } from "@/app/actions/scouting";
import { errorCode } from "@/lib/tour-ops/types";
import { fmtDateTime, fmtMoney, viewerTimezone, type UiLang } from "@/lib/tour-ops/time";
import { Chip, Field, INPUT, Notice } from "@/app/components/tour-ops/ops-ui";
import KycLevelBadge from "@/app/components/profile/KycLevelBadge";
import { scoutError } from "@/lib/scouting/i18n";
import { parseCashboxScout, parseTourDirectInvites, type TourDirectInvites } from "@/lib/scouting/types";
import { Avatar, INVITE_TONE, useScout } from "@/app/components/scouting/scout-ui";

export default function TourInvitesPanel({ tourId, closed }: { tourId: string; closed: boolean }) {
  const { s, lang } = useScout();
  const tz = viewerTimezone(null);
  const [data, setData] = useState<TourDirectInvites | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [hours, setHours] = useState(48);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "emerald" | "amber" | "rose"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc("voyage_tour_direct_invites", { p_tour: tourId });
    if (e) setError(scoutError(s, errorCode(e.message)));
    else {
      setError(null);
      setData(parseTourDirectInvites(d));
    }
  }, [tourId, s]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const send = async () => {
    setSending(true);
    const r = await inviteModelsToTour({ tourId, residentIds: [...picked], message, hours });
    setSending(false);
    if (!r.ok) return setMsg({ tone: "rose", text: scoutError(s, r.code) });
    const d = r.data!;
    const text = [s.tourInvite.sent(d.invited, d.notified), d.skipped.length ? s.tourInvite.skipped(d.skipped.length) : ""].filter(Boolean).join(" ");
    setMsg({ tone: d.skipped.length || d.notified < d.invited ? "amber" : "emerald", text });
    setPicked(new Set());
    setMessage("");
    await load();
  };

  const revoke = async (id: string) => {
    const r = await revokeTourInvite(id);
    if (!r.ok) setMsg({ tone: "rose", text: scoutError(s, r.code) });
    await load();
  };

  if (error) return <Notice tone="rose">{error}</Notice>;
  if (!data) return <p className="text-sm text-zinc-500"><Loader2 className="inline size-4 animate-spin" /></p>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-3">
        <SectionHeader eyebrow={s.tourInvite.tab} title={s.tourInvite.title} icon={UserPlus} />
        <p className="text-[13px] leading-relaxed text-zinc-400">{s.tourInvite.hint}</p>
        {data.candidates.length === 0 ? (
          <Panel className="p-5 text-[13px] leading-relaxed text-zinc-400">
            {s.tourInvite.noCandidates}{" "}
            <Link href="/partner/models" className="text-amber-200 underline-offset-4 hover:underline">{s.models.title}</Link>
          </Panel>
        ) : (
          <Panel className="p-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{s.tourInvite.candidates}</p>
            <ul className="divide-y divide-zinc-900">
              {data.candidates.map((c) => {
                const blocked = c.block !== null || closed;
                const on = picked.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 py-2.5 text-left transition ${blocked ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-900/40"}`}
                    >
                      <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-amber-200 bg-amber-200 text-zinc-950" : "border-zinc-700"}`}>
                        {on && <Check className="size-3.5" />}
                      </span>
                      <Avatar name={c.name} url={c.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-100">{c.name}</span>
                      <KycLevelBadge level={c.kycLevel} lang={lang} tone="own" />
                      {c.block && <span className="shrink-0 text-[11px] text-zinc-500">{s.blocks[c.block] ?? c.block}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!closed && (
              <div className="mt-4 space-y-3 border-t border-zinc-800/70 pt-4">
                <Field label={s.tourInvite.message}>
                  <textarea className={`${INPUT} min-h-20 py-2.5`} maxLength={500} value={message} placeholder={s.tourInvite.messagePh} onChange={(e) => setMessage(e.target.value)} />
                </Field>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={s.tourInvite.hours} className="w-40">
                    <select className={INPUT} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                      {Object.entries(s.tourInvite.hoursOptions).map(([h, label]) => <option key={h} value={h}>{label}</option>)}
                    </select>
                  </Field>
                  <button type="button" className={BTN_GOLD} disabled={sending || picked.size === 0} onClick={send}>
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {sending ? s.tourInvite.sending : `${s.tourInvite.send}${picked.size ? ` (${picked.size})` : ""}`}
                  </button>
                </div>
              </div>
            )}
          </Panel>
        )}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </section>

      <section className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{s.tourInvite.listTitle}</p>
        {data.invites.length === 0 ? (
          <Panel className="p-5 text-[13px] text-zinc-500">{s.tourInvite.empty}</Panel>
        ) : (
          <ul className="space-y-2">
            {data.invites.map((i) => (
              <Panel as="article" key={i.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={i.name} url={i.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-zinc-100">{i.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {fmtDateTime(i.createdAt, tz, lang)}
                      {i.status === "invited" && ` · ${s.inbox.until(fmtDateTime(i.expiresAt, tz, lang))}`}
                      {!i.notified && ` · ${s.tourInvite.telegramOff}`}
                    </p>
                  </div>
                  <Chip className={INVITE_TONE[i.status] ?? INVITE_TONE.revoked}>{s.tourInvite.status[i.status] ?? i.status}</Chip>
                  {i.status === "invited" && (
                    <button type="button" className={`${BTN_GHOST} !min-h-8 px-3`} onClick={() => revoke(i.id)}>{s.tourInvite.revoke}</button>
                  )}
                </div>
                {i.message && <p className="mt-2 line-clamp-2 text-[12px] text-zinc-400">«{i.message}»</p>}
              </Panel>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Касса тура: скаут-бонусы и «Агентству чистыми». Данные — блок scout из voyage_tour_cashbox. */
export function ScoutCashboxBlock({
  scout,
  agency,
  currency,
  modelNames,
  lang,
}: {
  scout: unknown;
  agency: number;
  currency: string;
  modelNames: Map<string, string>;
  lang: UiLang;
}) {
  const { s } = useScout();
  const data = parseCashboxScout(scout);
  if (!data || data.byModel.length === 0) return null;
  const sameCurrency = data.byModel.every((r) => r.currency === currency);
  const m = (v: number, c = currency) => fmtMoney(v, c, lang);
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            <BadgeDollarSign className="size-3.5 text-amber-200/70" /> {s.cashbox.title}
          </p>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-zinc-500">{s.cashbox.hint}</p>
        </div>
        {sameCurrency && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{s.cashbox.net}</p>
            <p className="mt-1 text-xl tabular-nums text-amber-100">{m(agency - data.total)}</p>
            <p className="text-[11px] text-zinc-500">{m(agency)} − {m(data.total)}</p>
          </div>
        )}
      </div>
      <ul className="mt-3 space-y-2 border-t border-zinc-800/70 pt-3">
        {data.byModel.map((r, i) => (
          <li key={i} className="flex items-start justify-between gap-3 text-[13px]">
            <span className="min-w-0">
              <span className="block truncate text-zinc-200">{modelNames.get(r.modelId) ?? "—"}</span>
              <span className="block text-[11px] text-zinc-500">{s.cashbox.byModel(r.scoutName)}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums text-zinc-100">
              −{m(r.amount, r.currency)}
              {r.pending !== 0 && <span className="block text-[11px] text-amber-200/80">{s.cashbox.pending}: {m(r.pending, r.currency)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
