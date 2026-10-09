"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · OVERVIEW — интерфейс
 * app/(dashboard)/admin/directory/AdminOverviewClient.tsx
 *
 * Верхний ряд: резиденты · ждут KYC · предстоящие тусовки.
 * Нижний ряд: недавние одобрения (applications) · ближайшие тусовки.
 * Ссылки в справочник и на тусовки — только owner/admin (у менеджера
 * этих разделов нет); заявки резидентов — всему персоналу.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { ArrowUpRight, CalendarDays, Clock3, GlassWater, LayoutDashboard, MapPin, RefreshCw, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeLang, type Lang } from "@/lib/gamification";
import { initials } from "@/lib/memberCards";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
});

/* ── Данные ───────────────────────────────────────────────────────── */

export type Approval = {
  id: string;
  profileId: string | null;
  name: string | null;
  avatarUrl: string | null;
  hub: string | null;
  tour: string | null;
  at: string | null;
};

export type Party = { id: string; title: string; region: string | null; startsAt: string | null; createdAt: string | null };

export type OverviewData = {
  residents: number;
  kycPending: number;
  kycTracked: boolean;
  partiesUpcoming: number;
  partiesDated: boolean;
  approvals: Approval[];
  parties: Party[];
  warnings: string[];
  generatedAt: string;
};

/* ── Тексты ───────────────────────────────────────────────────────── */

const TEXT = {
  en: {
    eyebrow: "Voyage · Console",
    title: "Club overview",
    asOf: (d: string) => `As of ${d}`,
    refresh: "Refresh",
    residents: "Residents",
    residentsHint: "members with the resident role",
    kyc: "Awaiting KYC",
    kycHint: "KYC below level 3 or status pending",
    kycHintNoLevel: "status pending",
    parties: "Upcoming parties",
    partiesHint: "active and not yet past",
    partiesHintNoDate: "active parties",
    open: "Open",
    approvalsTitle: "Recent approvals",
    approvalsAll: "All applications",
    approvalsEmpty: "No approved applications yet — they'll appear here as soon as a manager approves one.",
    partiesTitle: "Upcoming parties",
    partiesAll: "Manage parties",
    partiesEmpty: "No active parties. Add the first one in “Manage parties”.",
    noName: "No name",
    created: (d: string) => `added ${d}`,
    note: "Some data is unavailable",
    locale: "en-GB",
  },
  ru: {
    eyebrow: "Voyage · Консоль",
    title: "Обзор клуба",
    asOf: (d: string) => `Сводка на ${d}`,
    refresh: "Обновить",
    residents: "Резиденты",
    residentsHint: "участницы с ролью резидента",
    kyc: "Ждут подтверждения KYC",
    kycHint: "KYC ниже 3-го уровня или статус pending",
    kycHintNoLevel: "статус pending",
    parties: "Предстоящие тусовки",
    partiesHint: "активные и ещё не прошедшие",
    partiesHintNoDate: "активные тусовки",
    open: "Открыть",
    approvalsTitle: "Недавние одобрения",
    approvalsAll: "Все заявки",
    approvalsEmpty: "Одобренных заявок пока нет — они появятся здесь, как только менеджер одобрит первую.",
    partiesTitle: "Ближайшие тусовки",
    partiesAll: "Управление тусовками",
    partiesEmpty: "Активных тусовок нет. Добавьте первую в «Управлении тусовками».",
    noName: "Без имени",
    created: (d: string) => `добавлена ${d}`,
    note: "Часть данных недоступна",
    locale: "ru-RU",
  },
  es: {
    eyebrow: "Voyage · Consola",
    title: "Resumen del club",
    asOf: (d: string) => `Datos al ${d}`,
    refresh: "Actualizar",
    residents: "Residentes",
    residentsHint: "miembros con rol de residente",
    kyc: "KYC por confirmar",
    kycHint: "KYC por debajo del nivel 3 o estado pending",
    kycHintNoLevel: "estado pending",
    parties: "Próximas fiestas",
    partiesHint: "activas y aún por celebrarse",
    partiesHintNoDate: "fiestas activas",
    open: "Abrir",
    approvalsTitle: "Aprobaciones recientes",
    approvalsAll: "Todas las solicitudes",
    approvalsEmpty: "Aún no hay solicitudes aprobadas; aparecerán aquí en cuanto un gerente apruebe la primera.",
    partiesTitle: "Próximas fiestas",
    partiesAll: "Gestionar fiestas",
    partiesEmpty: "No hay fiestas activas. Añade la primera en «Gestionar fiestas».",
    noName: "Sin nombre",
    created: (d: string) => `añadida ${d}`,
    note: "Algunos datos no están disponibles",
    locale: "es-ES",
  },
  pt: {
    eyebrow: "Voyage · Console",
    title: "Visão geral do clube",
    asOf: (d: string) => `Resumo de ${d}`,
    refresh: "Atualizar",
    residents: "Residentes",
    residentsHint: "membros com papel de residente",
    kyc: "KYC aguardando confirmação",
    kycHint: "KYC abaixo do nível 3 ou status pending",
    kycHintNoLevel: "status pending",
    parties: "Próximas festas",
    partiesHint: "ativas e ainda por acontecer",
    partiesHintNoDate: "festas ativas",
    open: "Abrir",
    approvalsTitle: "Aprovações recentes",
    approvalsAll: "Todas as solicitações",
    approvalsEmpty: "Ainda não há solicitações aprovadas — elas aparecem aqui assim que um gerente aprovar a primeira.",
    partiesTitle: "Próximas festas",
    partiesAll: "Gerenciar festas",
    partiesEmpty: "Nenhuma festa ativa. Adicione a primeira em “Gerenciar festas”.",
    noName: "Sem nome",
    created: (d: string) => `adicionada ${d}`,
    note: "Alguns dados não estão disponíveis",
    locale: "pt-BR",
  },
} satisfies Record<Lang, Record<string, unknown>>;

export type OverviewText = (typeof TEXT)["en"];

export function useOverviewI18n() {
  const ctx: unknown = useLanguage();
  const lang = normalizeLang(ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).lang : ctx);
  return { lang, t: TEXT[lang] as OverviewText };
}

/* ── Оформление ───────────────────────────────────────────────────── */

const STYLES = `
.ov-root { container-type: inline-size; }
.ov-stats { display: grid; gap: .9rem; grid-template-columns: minmax(0, 1fr); }
.ov-lists { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 640px) { .ov-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (min-width: 860px) { .ov-lists { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
`;

function relTime(iso: string | null, locale: string) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function dateLabel(iso: string | null, locale: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(locale, { day: "numeric", month: "long" }) : null;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  openLabel,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  href: string | null;
  openLabel: string;
  accent?: boolean;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent ? "border-amber-200/30 bg-amber-200/[0.07] text-amber-200" : "border-zinc-800 bg-zinc-900/60 text-zinc-400"}`}>
          <Icon size={18} strokeWidth={1.4} aria-hidden />
        </span>
        {href && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600 transition-colors group-hover:text-amber-200/80">
            {openLabel}
            <ArrowUpRight size={12} aria-hidden />
          </span>
        )}
      </span>
      <span className={`${cormorant.className} mt-5 block text-5xl font-medium leading-none lining-nums tabular-nums ${accent ? "text-amber-100" : "text-zinc-50"}`}>{value}</span>
      <span className="mt-3 block text-sm text-zinc-200">{label}</span>
      <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
    </>
  );
  const cls = `group relative block overflow-hidden rounded-2xl border p-5 transition-colors ${
    accent ? "border-amber-200/25 bg-gradient-to-br from-amber-200/[0.06] via-zinc-950 to-zinc-950" : "border-zinc-800/70 bg-zinc-900/40"
  } ${href ? "hover:border-amber-200/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, icon: Icon, link, children }: { title: string; icon: LucideIcon; link: { href: string; label: string } | null; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-zinc-800/70 bg-zinc-900/30">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-800/60 px-5 py-4">
        <h2 className="flex min-w-0 items-center gap-2.5">
          <Icon size={16} strokeWidth={1.4} className="shrink-0 text-amber-200/70" aria-hidden />
          <span className={`${cormorant.className} truncate text-xl font-medium text-zinc-50`}>{title}</span>
        </h2>
        {link && (
          <Link href={link.href} className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-amber-200">
            {link.label}
            <ArrowUpRight size={12} aria-hidden />
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm leading-relaxed text-zinc-500">{text}</p>;
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700/60 bg-zinc-900">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-medium text-zinc-400">{initials(name)}</span>
      )}
    </span>
  );
}

/* ── Страница ─────────────────────────────────────────────────────── */

export default function AdminOverviewClient({
  data,
  canManage,
  refreshing = false,
  onRefresh,
}: {
  data: OverviewData;
  /** owner/admin: справочник и тусовки открываются по клику */
  canManage: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { t } = useOverviewI18n();
  const asOf = useMemo(
    () => new Date(data.generatedAt).toLocaleString(t.locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    [data.generatedAt, t.locale],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <style>{STYLES}</style>
      <div className="ov-root relative mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-amber-200/70">
              <LayoutDashboard size={14} strokeWidth={1.4} aria-hidden />
              {t.eyebrow}
            </p>
            <h1 className={`${cormorant.className} mt-3 text-4xl font-medium tracking-wide text-zinc-50 sm:text-5xl`}>{t.title}</h1>
            <p className="mt-2 text-sm text-zinc-500">{t.asOf(asOf)}</p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-60"
            >
              <RefreshCw size={13} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} aria-hidden />
              {t.refresh}
            </button>
          )}
        </header>

        <div className="ov-stats">
          <StatCard icon={Users} label={t.residents} value={data.residents} hint={t.residentsHint} href={canManage ? "/admin" : null} openLabel={t.open} />
          <StatCard
            icon={ShieldCheck}
            label={t.kyc}
            value={data.kycPending}
            hint={data.kycTracked ? t.kycHint : t.kycHintNoLevel}
            href={canManage ? "/admin?kyc=pending" : null}
            openLabel={t.open}
            accent={data.kycPending > 0}
          />
          <StatCard
            icon={GlassWater}
            label={t.parties}
            value={data.partiesUpcoming}
            hint={data.partiesDated ? t.partiesHint : t.partiesHintNoDate}
            href={canManage ? "/admin/parties" : null}
            openLabel={t.open}
          />
        </div>

        <div className="ov-lists mt-8">
          <Panel title={t.approvalsTitle} icon={ShieldCheck} link={{ href: "/admin/applications", label: t.approvalsAll }}>
            {data.approvals.length === 0 ? (
              <Empty text={t.approvalsEmpty} />
            ) : (
              <ul className="divide-y divide-zinc-800/50">
                {data.approvals.map((a) => {
                  const name = a.name ?? t.noName;
                  const place = [a.hub, a.tour].filter(Boolean).join(" · ");
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Avatar src={a.avatarUrl} name={name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-zinc-100">{name}</p>
                        {place && (
                          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-zinc-500">
                            <MapPin size={11} className="shrink-0" aria-hidden />
                            <span className="truncate">{place}</span>
                          </p>
                        )}
                      </div>
                      {a.at && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
                          <Clock3 size={11} aria-hidden />
                          {relTime(a.at, t.locale)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={t.partiesTitle} icon={GlassWater} link={canManage ? { href: "/admin/parties", label: t.partiesAll } : null}>
            {data.parties.length === 0 ? (
              <Empty text={t.partiesEmpty} />
            ) : (
              <ul className="divide-y divide-zinc-800/50">
                {data.parties.map((p) => {
                  const date = dateLabel(p.startsAt, t.locale);
                  const added = !p.startsAt ? relTime(p.createdAt, t.locale) : null;
                  return (
                    <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.04] text-amber-200/80">
                        {date ? <CalendarDays size={16} strokeWidth={1.4} aria-hidden /> : <GlassWater size={16} strokeWidth={1.4} aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`${cormorant.className} truncate text-lg font-medium leading-tight text-zinc-50`}>{p.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                          {p.region && (
                            <span className="inline-flex items-center gap-1 uppercase tracking-[0.12em] text-amber-200/70">
                              <MapPin size={11} aria-hidden />
                              {p.region}
                            </span>
                          )}
                          {date && <span>{date}</span>}
                          {added && <span>{t.created(added)}</span>}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {canManage && data.warnings.length > 0 && (
          <p className="mt-6 text-[11px] text-zinc-600">
            {t.note}: {data.warnings.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}