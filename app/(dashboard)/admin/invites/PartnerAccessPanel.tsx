"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · INVITATIONS — доступ партнёров (якорь #partners)
 * app/(dashboard)/admin/invites/PartnerAccessPanel.tsx
 *
 * Владелец: выпускает коды VYP-XXXX-XXXX и ссылки
 *   https://t.me/<bot>?start=partner_<CODE> — по ним партнёр регистрируется
 *   в боте и сразу получает кабинет; отзывает неиспользованные коды.
 * Владелец и админ: заявки партнёров без кода — «Одобрить» создаёт аккаунт
 *   manager и шлёт логин и пароль в Telegram, «Отклонить» — короткий ответ.
 * Те же кнопки приходят владельцу в бот (padm:ok / padm:no).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Copy, KeyRound, Loader2, Plus, RefreshCw, UserPlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import {
  approvePartnerApplication,
  issuePartnerInvite,
  rejectPartnerApplication,
  revokePartnerInvite,
} from "@/app/actions/partner-access";

type InviteRow = { id: string; code: string; note: string | null; status: string; created_at: string; expires_at: string; used_at: string | null };
type ApplicationRow = {
  id: string;
  telegram_username: string | null;
  language: string;
  display_name: string;
  regions: string;
  contact: string;
  email: string;
  status: string;
  created_at: string;
};

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  refresh: string;
  invitesTitle: string;
  notePlaceholder: string;
  days: string;
  issue: string;
  noInvites: string;
  copy: string;
  copied: string;
  revoke: string;
  noBot: string;
  status: Record<"sealed" | "used" | "revoked" | "expired", string>;
  until: (d: string) => string;
  appsTitle: string;
  fields: { regions: string; contact: string; email: string };
  noApps: string;
  approve: string;
  reject: string;
  rejectNote: string;
  provisioning: string;
  approved: (delivered: boolean) => string;
  rejected: string;
  loadFailed: string;
};

const T: Record<Lang, Dict> = {
  RU: {
    eyebrow: "Партнёры",
    title: "Доступ партнёров",
    subtitle: "Коды владельца открывают кабинет сразу. Заявки без кода ждут решения здесь или в Telegram.",
    refresh: "Обновить",
    invitesTitle: "Партнёрские коды",
    notePlaceholder: "Кому код (необязательно)",
    days: "дней",
    issue: "Выпустить код",
    noInvites: "Кодов пока нет.",
    copy: "Скопировать ссылку",
    copied: "Скопировано",
    revoke: "Отозвать",
    noBot: "Задайте NEXT_PUBLIC_BOT_USERNAME, чтобы получить ссылку. Код можно ввести командой /partner КОД.",
    status: { sealed: "Активен", used: "Использован", revoked: "Отозван", expired: "Истёк" },
    until: (d) => `до ${d}`,
    appsTitle: "Заявки из бота",
    fields: { regions: "Направления", contact: "О себе и контакт", email: "Email" },
    noApps: "Новых заявок нет.",
    approve: "Одобрить",
    reject: "Отклонить",
    rejectNote: "Причина (увидит только команда)",
    provisioning: "Создаётся аккаунт…",
    approved: (sent) => (sent ? "Кабинет открыт, логин и пароль отправлены в Telegram." : "Кабинет открыт, но Telegram не доставил пароль — выдайте его вручную."),
    rejected: "Заявка отклонена.",
    loadFailed: "Не удалось загрузить партнёрские данные. Примените миграцию 20261022091000.",
  },
  EN: {
    eyebrow: "Partners",
    title: "Partner access",
    subtitle: "Owner codes open the cabinet instantly. Applications without a code wait for a decision here or in Telegram.",
    refresh: "Refresh",
    invitesTitle: "Partner codes",
    notePlaceholder: "Who is it for (optional)",
    days: "days",
    issue: "Issue code",
    noInvites: "No codes yet.",
    copy: "Copy link",
    copied: "Copied",
    revoke: "Revoke",
    noBot: "Set NEXT_PUBLIC_BOT_USERNAME to get a link. The code also works as /partner CODE.",
    status: { sealed: "Active", used: "Used", revoked: "Revoked", expired: "Expired" },
    until: (d) => `until ${d}`,
    appsTitle: "Bot applications",
    fields: { regions: "Regions", contact: "Bio and contact", email: "Email" },
    noApps: "No new applications.",
    approve: "Approve",
    reject: "Reject",
    rejectNote: "Reason (team only)",
    provisioning: "Creating account…",
    approved: (sent) => (sent ? "Cabinet opened, login and password sent via Telegram." : "Cabinet opened, but Telegram did not deliver the password — issue it manually."),
    rejected: "Application rejected.",
    loadFailed: "Couldn’t load partner data. Apply migration 20261022091000.",
  },
  ES: {
    eyebrow: "Socios",
    title: "Acceso de socios",
    subtitle: "Los códigos del propietario abren el panel al instante. Las solicitudes sin código esperan decisión aquí o en Telegram.",
    refresh: "Actualizar",
    invitesTitle: "Códigos de socio",
    notePlaceholder: "Para quién (opcional)",
    days: "días",
    issue: "Emitir código",
    noInvites: "Aún no hay códigos.",
    copy: "Copiar enlace",
    copied: "Copiado",
    revoke: "Revocar",
    noBot: "Configura NEXT_PUBLIC_BOT_USERNAME para obtener el enlace. El código también sirve con /partner CÓDIGO.",
    status: { sealed: "Activo", used: "Usado", revoked: "Revocado", expired: "Caducado" },
    until: (d) => `hasta ${d}`,
    appsTitle: "Solicitudes del bot",
    fields: { regions: "Regiones", contact: "Bio y contacto", email: "Email" },
    noApps: "No hay solicitudes nuevas.",
    approve: "Aprobar",
    reject: "Rechazar",
    rejectNote: "Motivo (solo equipo)",
    provisioning: "Creando cuenta…",
    approved: (sent) => (sent ? "Panel abierto, acceso enviado por Telegram." : "Panel abierto, pero Telegram no entregó la contraseña: envíala manualmente."),
    rejected: "Solicitud rechazada.",
    loadFailed: "No se pudieron cargar los datos de socios. Aplica la migración 20261022091000.",
  },
  PT: {
    eyebrow: "Parceiros",
    title: "Acesso de parceiros",
    subtitle: "Códigos do proprietário abrem o painel na hora. Pedidos sem código aguardam decisão aqui ou no Telegram.",
    refresh: "Atualizar",
    invitesTitle: "Códigos de parceiro",
    notePlaceholder: "Para quem (opcional)",
    days: "dias",
    issue: "Emitir código",
    noInvites: "Ainda não há códigos.",
    copy: "Copiar link",
    copied: "Copiado",
    revoke: "Revogar",
    noBot: "Defina NEXT_PUBLIC_BOT_USERNAME para obter o link. O código também funciona com /partner CÓDIGO.",
    status: { sealed: "Ativo", used: "Usado", revoked: "Revogado", expired: "Expirado" },
    until: (d) => `até ${d}`,
    appsTitle: "Pedidos do bot",
    fields: { regions: "Regiões", contact: "Bio e contato", email: "Email" },
    noApps: "Nenhum pedido novo.",
    approve: "Aprovar",
    reject: "Recusar",
    rejectNote: "Motivo (só a equipe)",
    provisioning: "Criando conta…",
    approved: (sent) => (sent ? "Painel aberto, acesso enviado pelo Telegram." : "Painel aberto, mas o Telegram não entregou a senha — envie manualmente."),
    rejected: "Pedido recusado.",
    loadFailed: "Não foi possível carregar os dados de parceiros. Aplique a migração 20261022091000.",
  },
};

const LOCALE: Record<Lang, string> = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-BR" };
const BOT = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
const BOT_OK = /^[A-Za-z0-9_]{5,32}$/.test(BOT);
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30";
const BTN = `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const deepLink = (code: string) => (BOT_OK ? `https://t.me/${BOT}?start=partner_${code}` : null);

export default function PartnerAccessPanel({ isOwner }: { isOwner: boolean }) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.RU;
  const date = (iso: string) => new Intl.DateTimeFormat(LOCALE[lang] ?? "ru-RU", { day: "numeric", month: "short" }).format(new Date(iso));

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState(14);
  const [copied, setCopied] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [appsRes, invitesRes] = await Promise.all([
      supabase
        .from("partner_applications")
        .select("id,telegram_username,language,display_name,regions,contact,email,status,created_at")
        .in("status", ["pending", "provisioning"])
        .order("created_at", { ascending: true })
        .limit(100),
      isOwner
        ? supabase.from("partner_invites").select("id,code,note,status,created_at,expires_at,used_at").order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] as InviteRow[], error: null }),
    ]);
    setLoadError(Boolean(appsRes.error || invitesRes.error));
    if (!appsRes.error) setApps((appsRes.data ?? []) as ApplicationRow[]);
    if (!invitesRes.error) setInvites((invitesRes.data ?? []) as InviteRow[]);
    setLoading(false);
  }, [isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async (code: string) => {
    const link = deepLink(code);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      setNotice({ tone: "error", text: link });
    }
  };

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>, success?: string) => {
    setBusy(key);
    setNotice(null);
    const result = await action();
    setBusy(null);
    if (!result.ok) setNotice({ tone: "error", text: result.error ?? "Error" });
    else if (success) setNotice({ tone: "ok", text: success });
    await load();
    return result.ok;
  };

  const issue = async () => {
    setBusy("issue");
    setNotice(null);
    const result = await issuePartnerInvite(note, days);
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    setNote("");
    setNotice({ tone: "ok", text: result.data.link ?? `${result.data.code} — ${t.noBot}` });
    await load();
  };

  const statusOf = (row: InviteRow): keyof Dict["status"] =>
    row.status === "sealed" && Date.parse(row.expires_at) < Date.now() ? "expired" : (row.status as keyof Dict["status"]);

  return (
    <section id="partners" className="mt-10 scroll-mt-24 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-600">{t.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-medium text-zinc-50">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t.subtitle}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className={`${BTN} border-zinc-800 text-zinc-400 hover:text-zinc-200`}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {t.refresh}
        </button>
      </div>

      {loadError && <p className="mt-4 text-xs text-amber-200/80">{t.loadFailed}</p>}
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-4 break-all rounded-lg border px-3 py-2 text-xs ${
            notice.tone === "error" ? "border-red-500/30 bg-red-950/30 text-red-200" : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
          }`}
        >
          {notice.text}
        </p>
      )}

      {isOwner && (
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <KeyRound size={15} className="text-amber-200/70" />
            {t.invitesTitle}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder={t.notePlaceholder}
              className={`min-w-[12rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 ${FOCUS}`}
            />
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className={`w-16 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 ${FOCUS}`}
              />
              {t.days}
            </label>
            <button type="button" onClick={() => void issue()} disabled={busy !== null} className={`${BTN} border-amber-200/40 bg-amber-200 font-semibold text-zinc-950 hover:bg-amber-100`}>
              {busy === "issue" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {t.issue}
            </button>
          </div>
          {!BOT_OK && <p className="mt-2 text-[11px] text-zinc-500">{t.noBot}</p>}

          {invites.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-600">{t.noInvites}</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/70">
              {invites.map((row) => {
                const st = statusOf(row);
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-sm tracking-wider text-amber-100">{row.code}</span>
                    <span className={`text-[10px] uppercase tracking-[0.18em] ${st === "sealed" ? "text-emerald-300" : "text-zinc-500"}`}>{t.status[st]}</span>
                    <span className="text-xs text-zinc-500">{st === "sealed" ? t.until(date(row.expires_at)) : date(row.used_at ?? row.created_at)}</span>
                    {row.note && <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{row.note}</span>}
                    {st === "sealed" && (
                      <span className="ml-auto flex gap-2">
                        {BOT_OK && (
                          <button type="button" onClick={() => void copyLink(row.code)} className={`${BTN} border-zinc-700 text-zinc-300 hover:text-white`}>
                            {copied === row.code ? <Check size={13} /> : <Copy size={13} />}
                            {copied === row.code ? t.copied : t.copy}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void run(`revoke:${row.id}`, () => revokePartnerInvite(row.id))}
                          className={`${BTN} border-red-500/30 text-red-300 hover:bg-red-500/10`}
                        >
                          {busy === `revoke:${row.id}` ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                          {t.revoke}
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="mt-8">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <UserPlus size={15} className="text-amber-200/70" />
          {t.appsTitle}
          {apps.length > 0 && <span className="rounded-full bg-amber-200/15 px-2 text-[11px] text-amber-100">{apps.length}</span>}
        </h3>
        {apps.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-600">{t.noApps}</p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {apps.map((app) => (
              <li key={app.id} className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-medium text-zinc-50">{app.display_name}</p>
                  <p className="text-xs text-zinc-500">
                    {app.telegram_username ? `@${app.telegram_username} · ` : ""}
                    {app.language} · {date(app.created_at)}
                  </p>
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div><dt className="inline text-zinc-500">{t.fields.regions}: </dt><dd className="inline whitespace-pre-wrap text-zinc-300">{app.regions}</dd></div>
                  <div><dt className="inline text-zinc-500">{t.fields.contact}: </dt><dd className="inline whitespace-pre-wrap text-zinc-300">{app.contact}</dd></div>
                  <div><dt className="inline text-zinc-500">{t.fields.email}: </dt><dd className="inline text-zinc-300">{app.email}</dd></div>
                </dl>
                {app.status === "provisioning" ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                    <Loader2 size={13} className="animate-spin" />
                    {t.provisioning}
                  </p>
                ) : rejecting === app.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      maxLength={500}
                      placeholder={t.rejectNote}
                      className={`min-w-[10rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 ${FOCUS}`}
                    />
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={async () => {
                        const ok = await run(`reject:${app.id}`, () => rejectPartnerApplication(app.id, rejectNote), t.rejected);
                        if (ok) {
                          setRejecting(null);
                          setRejectNote("");
                        }
                      }}
                      className={`${BTN} border-red-500/30 text-red-300 hover:bg-red-500/10`}
                    >
                      {busy === `reject:${app.id}` ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      {t.reject}
                    </button>
                    <button type="button" onClick={() => setRejecting(null)} className={`${BTN} border-zinc-800 text-zinc-400`}>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(`approve:${app.id}`, async () => {
                          const r = await approvePartnerApplication(app.id);
                          if (r.ok) setNotice({ tone: "ok", text: t.approved(r.data.delivered) });
                          return r.ok ? { ok: true } : r;
                        })
                      }
                      className={`${BTN} border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10`}
                    >
                      {busy === `approve:${app.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      {t.approve}
                    </button>
                    <button type="button" disabled={busy !== null} onClick={() => setRejecting(app.id)} className={`${BTN} border-zinc-700 text-zinc-300 hover:text-white`}>
                      <X size={13} />
                      {t.reject}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
