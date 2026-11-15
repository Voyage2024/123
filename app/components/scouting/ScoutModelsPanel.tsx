"use client";

/* ──────────────────────────────────────────────────────────────────────
 * «Мои модели» — /partner/models (менеджер; owner видит подсказку)
 *   • закреплённые модели: статус анкеты, KYC, Telegram, текущие туры
 *     (чужие — только город и даты), «Пригласить в тур»;
 *   • инвайт-ссылки VYM-… → t.me/<бот>?start=mod_<код>;
 *   • скаут-бонусы: только модель, тур (город/даты), сумма, статус.
 *   • 15.11: воронка модели и «Напомнить» (как у роли scout), леджер с
 *     выплатами (ref/хэш), ссылки VYS для новых скаутов.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, Link2, Loader2, MapPin, Plus, Send, ShieldQuestion, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, SectionHeader, StatStrip } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { inviteModelsToTour, issueScoutInvite, revokeScoutInvite } from "@/app/actions/scouting";
import { errorCode } from "@/lib/tour-ops/types";
import { fmtDay, fmtMoney, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, CopyButton, Field, INPUT, Modal, Notice, Tabs } from "@/app/components/tour-ops/ops-ui";
import { scoutError } from "@/lib/scouting/i18n";
import { parseMyBonuses, type MyBonuses, type OwnTour, type ScoutedModel } from "@/lib/scouting/types";
import { parseCabinetModels, type CabinetModels } from "@/lib/scouting/cabinet";
import { tourRange, useScout } from "@/app/components/scouting/scout-ui";
import { ScoutEarnings, ScoutModelCard, ScoutRecruitPanel } from "@/app/components/scouting/ScoutCabinet";

type Tab = "models" | "invites" | "bonuses";
type Invite = { id: string; code: string; note: string | null; status: string; uses: number; maxUses: number; expiresAt: string };
type Msg = { tone: "rose" | "emerald" | "amber"; text: string } | null;

function botLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=mod_${code}` : null;
}

export default function ScoutModelsPanel() {
  const { s, lang } = useScout();
  const { role } = useAuth();
  const tz = viewerTimezone(null);
  const isOwner = role === "owner";
  const [tab, setTab] = useState<Tab>("models");
  const [data, setData] = useState<CabinetModels | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [bonuses, setBonuses] = useState<MyBonuses | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [inviteFor, setInviteFor] = useState<ScoutedModel | null>(null);
  const [newInvite, setNewInvite] = useState({ note: "", days: 60, maxUses: 25 });

  const load = useCallback(async () => {
    const [m, i, b] = await Promise.all([
      supabase.rpc("voyage_my_scouted_models"),
      supabase.from("scout_invites").select("id,code,note,status,uses,max_uses,expires_at").order("created_at", { ascending: false }).limit(40),
      supabase.rpc("voyage_my_scout_bonuses"),
    ]);
    setLoading(false);
    if (m.error) setMsg({ tone: "rose", text: scoutError(s, errorCode(m.error.message)) });
    setData(m.error ? null : parseCabinetModels(m.data));
    setInvites((i.data ?? []).map((r) => ({ id: r.id, code: r.code, note: r.note, status: r.status, uses: r.uses, maxUses: r.max_uses, expiresAt: r.expires_at })));
    setBonuses(b.error ? null : parseMyBonuses(b.data));
  }, [s]);

  useEffect(() => {
    void load();
  }, [load]);

  const createInvite = async () => {
    setBusy("invite");
    const r = await issueScoutInvite({ note: newInvite.note, days: newInvite.days, maxUses: newInvite.maxUses });
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: scoutError(s, r.code) });
    else setNewInvite({ note: "", days: 60, maxUses: 25 });
    await load();
  };

  const revoke = async (id: string) => {
    setBusy(id);
    const r = await revokeScoutInvite(id);
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: scoutError(s, r.code) });
    await load();
  };

  const models = data?.models ?? [];
  const inTour = models.filter((m) => m.tours.length > 0).length;
  const pendingText = (bonuses?.totals ?? []).filter((x) => x.pending).map((x) => fmtMoney(x.pending, x.currency, lang)).join(" · ") || "0";
  const paidText = (bonuses?.totals ?? []).filter((x) => x.paid).map((x) => fmtMoney(x.paid, x.currency, lang)).join(" · ") || "0";
  const pendingClaims = (data?.claims ?? []).filter((c) => c.status === "pending").length;

  return (
    <PageShell>
      <PageHeader eyebrow={s.models.eyebrow} title={s.models.title} subtitle={s.models.subtitle} />

      {isOwner && (
        <div className="mt-6">
          <Notice tone="amber">
            {s.models.ownerHint}{" "}
            <Link href="/admin/tour-control/scouts" className="underline decoration-amber-200/40 underline-offset-4 hover:text-amber-50">{s.models.ownerLink}</Link>
          </Notice>
        </div>
      )}

      <StatStrip
        items={[
          { label: s.models.tabs.models, value: String(models.length), icon: Users, tone: "gold", hint: pendingClaims ? `${s.models.claimsTitle}: ${pendingClaims}` : undefined },
          { label: s.models.inTour, value: String(inTour), icon: MapPin },
          { label: s.bonuses.pending, value: pendingText, icon: BadgeDollarSign, tone: "amber" },
          { label: s.bonuses.paid, value: paidText, icon: Sparkles, tone: "emerald" },
        ]}
      />

      <div className="mt-8">
        <Tabs
          items={[
            { key: "models", label: s.models.tabs.models },
            { key: "invites", label: s.models.tabs.invites },
            { key: "bonuses", label: s.models.tabs.bonuses },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {msg && <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {loading && <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /></p>}

      {!loading && tab === "models" && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-3">
            {models.length === 0 ? (
              <Panel className="p-6 text-sm leading-relaxed text-zinc-400">{s.models.empty}</Panel>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {models.map((m) => (
                  <ScoutModelCard
                    key={m.id}
                    m={m}
                    tz={tz}
                    onResult={(text, tone) => setMsg({ text, tone })}
                    footer={!isOwner && (data?.tours.length ?? 0) > 0 && m.status === "approved" && !m.banned ? (
                      <button type="button" onClick={() => setInviteFor(m)} className={BTN_GHOST}>
                        <Send className="size-3.5" /> {s.models.inviteToTour}
                      </button>
                    ) : null}
                  />
                ))}
              </ul>
            )}
          </section>
          <aside className="space-y-4">
            {(data?.claims.length ?? 0) > 0 && (
              <Panel className="p-5">
                <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{s.models.claimsTitle}</p>
                <ul className="space-y-2 text-[13px]">
                  {data!.claims.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-zinc-200">{c.name} <span className="text-zinc-500">· {s.models.claimReason[c.reason] ?? c.reason}</span></span>
                      <Chip className={c.status === "pending" ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : c.status === "approved" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-zinc-700 text-zinc-400"}>
                        {s.models.claimStatus[c.status] ?? c.status}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            <Panel className="p-5">
              <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500"><ShieldQuestion className="size-3.5 text-amber-200/60" /> {s.models.rulesTitle}</p>
              <ul className="space-y-2.5 text-[13px] leading-relaxed text-zinc-300">
                {s.models.rules.map((r, i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-amber-200/60" />{r}</li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      )}

      {!loading && tab === "invites" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {!isOwner && (
            <Panel className="space-y-3 p-5">
              <SectionHeader eyebrow={s.models.tabs.invites} title={s.invites.create} icon={Link2} />
              <p className="text-[12px] leading-relaxed text-zinc-500">{s.invites.hint}</p>
              <Field label={s.invites.note}>
                <input className={INPUT} value={newInvite.note} maxLength={120} placeholder={s.invites.notePh} onChange={(e) => setNewInvite((v) => ({ ...v, note: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={s.invites.days}>
                  <input className={INPUT} type="number" min={1} max={180} value={newInvite.days} onChange={(e) => setNewInvite((v) => ({ ...v, days: Number(e.target.value) }))} />
                </Field>
                <Field label={s.invites.maxUses}>
                  <input className={INPUT} type="number" min={1} max={200} value={newInvite.maxUses} onChange={(e) => setNewInvite((v) => ({ ...v, maxUses: Number(e.target.value) }))} />
                </Field>
              </div>
              <button type="button" className={`${BTN_GOLD} w-full`} disabled={busy === "invite"} onClick={createInvite}>
                {busy === "invite" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {s.invites.create}
              </button>
            </Panel>
          )}
          <section className="space-y-3">
            <ScoutRecruitPanel isOwner={isOwner} />
            {invites.length === 0 ? (
              <Panel className="p-6 text-sm text-zinc-400">{s.invites.empty}</Panel>
            ) : (
              <ul className="space-y-2">
                {invites.map((i) => {
                  const expired = Date.parse(i.expiresAt) <= Date.now();
                  const active = i.status === "active" && !expired && i.uses < i.maxUses;
                  const link = botLink(i.code);
                  return (
                    <Panel as="article" key={i.id} className={`p-4 ${active ? "" : "opacity-60"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm tracking-wider text-amber-100">{i.code}</p>
                          <p className="mt-1 text-[12px] text-zinc-500">
                            {i.note ? `${i.note} · ` : ""}
                            {s.invites.uses(i.uses, i.maxUses)} · {i.status === "revoked" ? s.invites.revoked : expired ? s.invites.expired : s.invites.expires(fmtDay(i.expiresAt, tz, lang))}
                          </p>
                        </div>
                        {active && (
                          <div className="flex flex-wrap items-center gap-2">
                            {link ? <CopyButton text={link} label={s.invites.copyLink} copied={s.invites.copied} /> : <CopyButton text={`/start mod_${i.code}`} label={i.code} copied={s.invites.copied} />}
                            <button type="button" className={BTN_GHOST} disabled={busy === i.id} onClick={() => revoke(i.id)}>{s.invites.revoke}</button>
                          </div>
                        )}
                      </div>
                      {active && !link && <p className="mt-2 text-[11px] text-zinc-500">{s.invites.botMissing}</p>}
                    </Panel>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {!loading && tab === "bonuses" && <ScoutEarnings embedded />}

      <InviteToTourModal
        model={inviteFor}
        tours={data?.tours ?? []}
        onClose={() => setInviteFor(null)}
        onDone={async (text, tone) => {
          setInviteFor(null);
          setMsg({ tone, text });
          await load();
        }}
      />
    </PageShell>
  );
}

function InviteToTourModal({
  model,
  tours,
  onClose,
  onDone,
}: {
  model: ScoutedModel | null;
  tours: OwnTour[];
  onClose: () => void;
  onDone: (text: string, tone: "emerald" | "amber" | "rose") => void;
}) {
  const { s, lang } = useScout();
  const tz = viewerTimezone(null);
  const [tourId, setTourId] = useState("");
  const [message, setMessage] = useState("");
  const [hours, setHours] = useState(48);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyIds = useMemo(() => new Set((model?.tours ?? []).filter((t) => t.own && t.tourId).map((t) => t.tourId as string)), [model]);

  useEffect(() => {
    setTourId(tours.find((t) => !busyIds.has(t.id))?.id ?? "");
    setMessage("");
    setError(null);
  }, [model, tours, busyIds]);

  if (!model) return null;
  const send = async () => {
    if (!tourId) return;
    setSending(true);
    const r = await inviteModelsToTour({ tourId, residentIds: [model.id], message, hours });
    setSending(false);
    if (!r.ok) return setError(scoutError(s, r.code));
    const d = r.data!;
    if (d.invited === 0 && d.skipped.length) return setError(s.blocks[d.skipped[0].reason] ?? s.errors.failed);
    onDone(s.tourInvite.sent(d.invited, d.notified), d.notified < d.invited ? "amber" : "emerald");
  };

  return (
    <Modal open title={s.tourInvite.modalTitle(model.name)} onClose={onClose}>
      {tours.length === 0 ? (
        <Notice tone="amber">{s.tourInvite.noTours}</Notice>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-zinc-500">{s.tourInvite.hint}</p>
          <Field label={s.tourInvite.pickTour}>
            <select className={INPUT} value={tourId} onChange={(e) => setTourId(e.target.value)}>
              {tours.map((t) => (
                <option key={t.id} value={t.id} disabled={busyIds.has(t.id)}>
                  {t.city} · {tourRange(t.departsAt, t.returnsAt, tz, lang)}{busyIds.has(t.id) ? ` · ${s.blocks.already_member}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.tourInvite.message}>
            <textarea className={`${INPUT} min-h-24 py-2.5`} maxLength={500} value={message} placeholder={s.tourInvite.messagePh} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <Field label={s.tourInvite.hours}>
            <select className={INPUT} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {Object.entries(s.tourInvite.hoursOptions).map(([h, label]) => <option key={h} value={h}>{label}</option>)}
            </select>
          </Field>
          {!model.hasTelegram && <Notice tone="zinc">{s.tourInvite.telegramOff}</Notice>}
          {error && <Notice tone="rose">{error}</Notice>}
          <button type="button" className={`${BTN_GOLD} w-full`} disabled={sending || !tourId} onClick={send}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {sending ? s.tourInvite.sending : s.tourInvite.send}
          </button>
        </div>
      )}
    </Modal>
  );
}
