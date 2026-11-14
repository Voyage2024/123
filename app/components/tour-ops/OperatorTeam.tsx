"use client";

/* ──────────────────────────────────────────────────────────────────────
 * «Моя команда (Операторы)» — /partner/team
 *   • заявки из бота (pending) → Одобрить / Отклонить;
 *   • операторы команды → приостановить / вернуть;
 *   • инвайт-ссылки VYO-… → t.me/<бот>?start=op_<код>.
 * owner видит команды всех менеджеров.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Check, Headset, Link2, Loader2, Plus, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, PageHeader, PageShell, Panel, SectionHeader } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { decideOperatorApplication, issueOperatorInvite, revokeOperatorInvite, setOperatorStatus } from "@/app/actions/operator-team";
import { opsError } from "@/lib/tour-ops/i18n";
import { fmtDateTime, fmtDay, viewerTimezone } from "@/lib/tour-ops/time";
import { Chip, CopyButton, Notice, useOps } from "@/app/components/tour-ops/ops-ui";

type App = { id: string; displayName: string; username: string | null; phone: string; timezone: string; experience: string | null; managerId: string; createdAt: string };
type Op = { id: string; name: string; username: string | null; phone: string | null; status: string; managerId: string };
type Invite = { id: string; code: string; note: string | null; status: string; uses: number; maxUses: number; expiresAt: string; managerId: string };

function botLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=op_${code}` : null;
}

export default function OperatorTeam() {
  const { t, lang } = useOps();
  const tz = viewerTimezone(null);
  const [apps, setApps] = useState<App[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "rose" | "emerald" | "amber"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [a, o, i] = await Promise.all([
      supabase.from("operator_applications").select("id,display_name,telegram_username,phone,timezone,experience,manager_id,created_at").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("operator_profiles").select("profile_id,display_name,telegram_username,phone,status,manager_id").order("display_name"),
      supabase.from("operator_invites").select("id,code,note,status,uses,max_uses,expires_at,manager_id").order("created_at", { ascending: false }).limit(30),
    ]);
    setLoading(false);
    if (a.error || o.error || i.error) setMsg({ tone: "rose", text: t.errors.forbidden });
    setApps((a.data ?? []).map((r) => ({ id: r.id, displayName: r.display_name, username: r.telegram_username, phone: r.phone, timezone: r.timezone, experience: r.experience, managerId: r.manager_id, createdAt: r.created_at })));
    setOps((o.data ?? []).map((r) => ({ id: r.profile_id, name: r.display_name, username: r.telegram_username, phone: r.phone, status: r.status, managerId: r.manager_id })));
    setInvites((i.data ?? []).map((r) => ({ id: r.id, code: r.code, note: r.note, status: r.status, uses: r.uses, maxUses: r.max_uses, expiresAt: r.expires_at, managerId: r.manager_id })));
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusy(id);
    const r = await decideOperatorApplication(id, decision);
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    else if (decision === "reject") setMsg({ tone: "emerald", text: t.team.rejected });
    else setMsg({ tone: r.data?.delivered ? "emerald" : "amber", text: r.data?.delivered ? t.team.approved : t.team.approvedNoDelivery });
    await load();
  };

  const toggle = async (op: Op) => {
    setBusy(op.id);
    const r = await setOperatorStatus(op.id, op.status === "active" ? "suspended" : "active");
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    await load();
  };

  const createInvite = async () => {
    setBusy("invite");
    const r = await issueOperatorInvite({ days: 30, maxUses: 10 });
    setBusy(null);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    await load();
  };

  const revoke = async (id: string) => {
    const r = await revokeOperatorInvite(id);
    if (!r.ok) setMsg({ tone: "rose", text: opsError(t, r.code) });
    await load();
  };

  const activeInvites = invites.filter((i) => i.status === "active" && Date.parse(i.expiresAt) > Date.now() && i.uses < i.maxUses);

  return (
    <PageShell>
      <PageHeader eyebrow={t.team.pageEyebrow} title={t.team.pageTitle} subtitle={t.team.pageSubtitle} />
      {msg && <div className="mt-6"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {loading && <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>}

      <section className="mt-8 space-y-3">
        <SectionHeader eyebrow={t.team.pageEyebrow} title={t.team.applications} icon={UserPlus} count={apps.length} />
        {apps.length === 0 && !loading && <p className="text-sm text-zinc-500">{t.team.noApplications}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <Panel key={a.id} className="p-4">
              <p className="text-base text-zinc-50">{a.displayName}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <dt className="text-zinc-500">{t.team.telegram}</dt><dd className="text-zinc-200">{a.username ? `@${a.username}` : "—"}</dd>
                <dt className="text-zinc-500">{t.team.phone}</dt><dd className="text-zinc-200">{a.phone}</dd>
                <dt className="text-zinc-500">{t.team.timezone}</dt><dd className="text-zinc-200">{a.timezone}</dd>
                <dt className="text-zinc-500">{t.team.submitted}</dt><dd className="text-zinc-200">{fmtDateTime(a.createdAt, tz, lang)}</dd>
              </dl>
              {a.experience && <p className="mt-2 whitespace-pre-line text-[12px] text-zinc-400">{t.team.experience}: {a.experience}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" className={BTN_GOLD} disabled={busy === a.id} onClick={() => decide(a.id, "approve")}>
                  {busy === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {t.team.approve}
                </button>
                <button type="button" className={BTN_GHOST} disabled={busy === a.id} onClick={() => decide(a.id, "reject")}><X className="size-3.5" /> {t.team.reject}</button>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-3">
        <SectionHeader eyebrow={t.team.pageEyebrow} title={t.team.operatorsTitle} icon={Headset} count={ops.length} />
        {ops.length === 0 && !loading && <p className="text-sm text-zinc-500">{t.team.noTeam}</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ops.map((o) => (
            <Panel key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-50">{o.name}</p>
                  <p className="text-[12px] text-zinc-500">{[o.username ? `@${o.username}` : null, o.phone].filter(Boolean).join(" · ")}</p>
                </div>
                <Chip className={o.status === "active" ? "border-emerald-400/40 text-emerald-200" : "border-rose-400/40 text-rose-200"}>
                  {o.status === "active" ? t.team.active : t.team.suspended}
                </Chip>
              </div>
              <button type="button" className={`${BTN_GHOST} mt-3`} disabled={busy === o.id} onClick={() => toggle(o)}>
                {o.status === "active" ? t.team.suspend : t.team.activate}
              </button>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-3">
        <SectionHeader
          eyebrow={t.team.pageEyebrow}
          title={t.team.invitesTitle}
          icon={Link2}
          count={activeInvites.length}
          action={<button type="button" className={BTN_GOLD} disabled={busy === "invite"} onClick={createInvite}><Plus className="size-3.5" /> {t.team.createInvite}</button>}
        />
        <p className="text-[13px] text-zinc-400">{t.team.inviteHint}</p>
        {!botLink("VYO-AAAA-AAAA") && <Notice tone="amber">{t.team.botMissing}</Notice>}
        <ul className="space-y-2">
          {invites.map((i) => {
            const live = activeInvites.includes(i);
            const link = botLink(i.code);
            return (
              <li key={i.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 px-4 py-3 ${live ? "" : "opacity-50"}`}>
                <span className="font-mono text-sm text-amber-100">{i.code}</span>
                <span className="text-[12px] text-zinc-500">{t.team.uses(i.uses, i.maxUses)} · {t.team.expires(fmtDay(i.expiresAt, tz, lang))}</span>
                {!live && <span className="text-[12px] text-zinc-500">{t.team.revoked}</span>}
                <span className="flex-1" />
                {live && <CopyButton text={link ?? i.code} label={t.common.copy} copied={t.common.copied} />}
                {live && <button type="button" className={BTN_GHOST} onClick={() => revoke(i.id)}>{t.team.revoke}</button>}
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}
