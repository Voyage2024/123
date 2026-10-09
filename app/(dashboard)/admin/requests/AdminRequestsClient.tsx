"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · MEMBERSHIP REQUESTS — заявки на вступление с главной («Запросить приглашение»)
 * app/(dashboard)/admin/requests/AdminRequestsClient.tsx
 *
 * Не путать с /admin/applications — там отбор резидентов в туры (таблица applications).
 *
 * Список «холодных» заявок (без ключа-приглашения): новые сверху,
 * Instagram / портфолио / Telegram / WhatsApp открываются в новой вкладке,
 * «Одобрить» и «Отклонить» сразу меняют статус в guest_applications.
 * После решения — уведомление с «Отменить» (статус возвращается).
 *
 * Права проверяет база: читать и менять статус могут только owner/admin
 * (RLS + club_is_admin(), миграция 20261011_guest_applications.sql).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  AlertTriangle,
  AtSign,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Inbox,
  Link2,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeLang, type Lang } from "@/lib/gamification";
import { contactLinks, hostOf, instagramUrl, type ApplicationStatus, type GuestApplication } from "@/lib/guestApplications";

// Шрифт объявлен один раз и экспортируется — page.tsx берёт его отсюда.
export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

/* ══════════════════════════════════════════════════════════════════
 * i18n
 * ══════════════════════════════════════════════════════════════════ */

const LOCALES: Record<Lang, string> = { en: "en-US", ru: "ru-RU", es: "es-ES", pt: "pt-BR" };

const en = {
  eyebrow: "Voyage · Admin",
  title: "Membership Requests",
  subtitle:
    "Requests from the website — candidates without an invitation key. The club committee decides who receives an invitation.",
  refresh: "Refresh",
  loading: "Loading applications…",
  loadFailed: "Failed to load applications",
  refreshFailed: "Failed to refresh — showing the last loaded version",
  retry: "Retry",
  networkError: "Network error",
  migrationHint: "It looks like the guest_applications migration hasn't been applied in Supabase yet.",
  live: "Live",
  offline: "Offline",
  noAccessTitle: "Owner and administrators only",
  noAccessBody: "Applications to the club are reviewed by the club's owner and administrators.",
  backToConsole: "Back to the console",
  statPending: "Awaiting review",
  statWeek: "New this week",
  statApproved: "Approved",
  statRejected: "Rejected",
  keyApplications: (n: number) => `Key applications awaiting review: ${n}`,
  keyApplicationsLink: "Invitations",
  // фильтры
  tabs: { pending: "New", approved: "Approved", rejected: "Rejected", all: "All" } as Record<
    ApplicationStatus | "all",
    string
  >,
  searchPlaceholder: "Name, Instagram or contact…",
  searchAria: "Search applications",
  // карточка
  isNew: "New",
  received: (d: string) => `Received ${d}`,
  instagram: "Instagram",
  portfolio: "Portfolio",
  contact: "Contact",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  copy: "Copy",
  copied: "Copied",
  about: "About",
  noAbout: "No statement provided.",
  showMore: "Show more",
  showLess: "Show less",
  formLanguage: "Form language",
  approve: "Approve",
  reject: "Reject",
  reconsider: "Back to review",
  statusApproved: "Approved",
  statusRejected: "Rejected",
  statusPending: "Awaiting review",
  decided: (d: string, by: string | null) => (by ? `${d} · ${by}` : d),
  // уведомления
  toastApproved: (n: string) => `${n} — approved`,
  toastRejected: (n: string) => `${n} — rejected`,
  toastPending: (n: string) => `${n} — back to review`,
  undo: "Undo",
  errForbidden: "Owner and administrators only — no permission for this action.",
  errGeneric: "The status couldn't be changed. Try again.",
  // пусто
  emptyPending: "No new applications",
  emptyPendingNote: "New requests from the website appear here on their own.",
  emptyOther: "Nothing here yet",
  noResults: "No applications match the search.",
};

type Dict = typeof en;

const ru: Dict = {
  eyebrow: "Voyage · Admin",
  title: "Заявки на вступление",
  subtitle: "Запросы с сайта — кандидатки без ключа-приглашения. Комитет клуба решает, кто получит приглашение.",
  refresh: "Обновить",
  loading: "Загружаем заявки…",
  loadFailed: "Не удалось загрузить заявки",
  refreshFailed: "Не удалось обновить — показана последняя загруженная версия",
  retry: "Повторить",
  networkError: "Ошибка сети",
  migrationHint: "Похоже, миграция guest_applications ещё не применена в Supabase.",
  live: "Live",
  offline: "Offline",
  noAccessTitle: "Только для владельца и администраторов",
  noAccessBody: "Заявки на вступление в клуб рассматривают владелец и администраторы.",
  backToConsole: "Вернуться в консоль",
  statPending: "На рассмотрении",
  statWeek: "Новых за неделю",
  statApproved: "Одобрено",
  statRejected: "Отклонено",
  keyApplications: (n) => `Анкет по ключам ждут решения: ${n}`,
  keyApplicationsLink: "Приглашения",
  tabs: { pending: "Новые", approved: "Одобренные", rejected: "Отклонённые", all: "Все" },
  searchPlaceholder: "Имя, Instagram или контакт…",
  searchAria: "Поиск по заявкам",
  isNew: "Новая",
  received: (d) => `Получена ${d}`,
  instagram: "Instagram",
  portfolio: "Портфолио",
  contact: "Контакт",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  copy: "Скопировать",
  copied: "Скопировано",
  about: "О себе",
  noAbout: "Без рассказа о себе.",
  showMore: "Показать полностью",
  showLess: "Свернуть",
  formLanguage: "Язык анкеты",
  approve: "Одобрить",
  reject: "Отклонить",
  reconsider: "Вернуть на рассмотрение",
  statusApproved: "Одобрена",
  statusRejected: "Отклонена",
  statusPending: "На рассмотрении",
  decided: (d, by) => (by ? `${d} · ${by}` : d),
  toastApproved: (n) => `${n} — одобрена`,
  toastRejected: (n) => `${n} — отклонена`,
  toastPending: (n) => `${n} — снова на рассмотрении`,
  undo: "Отменить",
  errForbidden: "Только для владельца и администраторов — нет прав на это действие.",
  errGeneric: "Не удалось изменить статус. Попробуйте ещё раз.",
  emptyPending: "Новых заявок нет",
  emptyPendingNote: "Новые запросы с сайта появятся здесь сами.",
  emptyOther: "Здесь пока пусто",
  noResults: "По запросу ничего не найдено.",
};

const es: Dict = {
  eyebrow: "Voyage · Admin",
  title: "Solicitudes de ingreso",
  subtitle:
    "Solicitudes desde la web: candidatas sin llave de invitación. El comité del club decide quién recibe una invitación.",
  refresh: "Actualizar",
  loading: "Cargando solicitudes…",
  loadFailed: "No se pudieron cargar las solicitudes",
  refreshFailed: "No se pudo actualizar: se muestra la última versión cargada",
  retry: "Reintentar",
  networkError: "Error de red",
  migrationHint: "Parece que la migración guest_applications aún no se aplicó en Supabase.",
  live: "Live",
  offline: "Offline",
  noAccessTitle: "Solo para el propietario y los administradores",
  noAccessBody: "Las solicitudes de ingreso las revisan el propietario del club y los administradores.",
  backToConsole: "Volver a la consola",
  statPending: "En revisión",
  statWeek: "Nuevas esta semana",
  statApproved: "Aprobadas",
  statRejected: "Rechazadas",
  keyApplications: (n) => `Solicitudes con llave pendientes: ${n}`,
  keyApplicationsLink: "Invitaciones",
  tabs: { pending: "Nuevas", approved: "Aprobadas", rejected: "Rechazadas", all: "Todas" },
  searchPlaceholder: "Nombre, Instagram o contacto…",
  searchAria: "Buscar solicitudes",
  isNew: "Nueva",
  received: (d) => `Recibida el ${d}`,
  instagram: "Instagram",
  portfolio: "Portafolio",
  contact: "Contacto",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  copy: "Copiar",
  copied: "Copiado",
  about: "Sobre ella",
  noAbout: "Sin texto de presentación.",
  showMore: "Ver todo",
  showLess: "Ver menos",
  formLanguage: "Idioma del formulario",
  approve: "Aprobar",
  reject: "Rechazar",
  reconsider: "Volver a revisión",
  statusApproved: "Aprobada",
  statusRejected: "Rechazada",
  statusPending: "En revisión",
  decided: (d, by) => (by ? `${d} · ${by}` : d),
  toastApproved: (n) => `${n}: aprobada`,
  toastRejected: (n) => `${n}: rechazada`,
  toastPending: (n) => `${n}: de nuevo en revisión`,
  undo: "Deshacer",
  errForbidden: "Solo para el propietario y los administradores: sin permiso para esta acción.",
  errGeneric: "No se pudo cambiar el estado. Inténtelo de nuevo.",
  emptyPending: "No hay solicitudes nuevas",
  emptyPendingNote: "Las nuevas solicitudes de la web aparecerán aquí solas.",
  emptyOther: "Aquí aún no hay nada",
  noResults: "Ninguna solicitud coincide con la búsqueda.",
};

const pt: Dict = {
  eyebrow: "Voyage · Admin",
  title: "Pedidos de adesão",
  subtitle: "Pedidos do site — candidatas sem chave de convite. O comitê do clube decide quem recebe um convite.",
  refresh: "Atualizar",
  loading: "Carregando inscrições…",
  loadFailed: "Falha ao carregar as inscrições",
  refreshFailed: "Falha ao atualizar — exibindo a última versão carregada",
  retry: "Tentar de novo",
  networkError: "Erro de rede",
  migrationHint: "Parece que a migração guest_applications ainda não foi aplicada no Supabase.",
  live: "Live",
  offline: "Offline",
  noAccessTitle: "Só para o proprietário e administradores",
  noAccessBody: "As inscrições ao clube são analisadas pelo proprietário e pelos administradores.",
  backToConsole: "Voltar ao console",
  statPending: "Em análise",
  statWeek: "Novas na semana",
  statApproved: "Aprovadas",
  statRejected: "Recusadas",
  keyApplications: (n) => `Candidaturas por chave aguardando: ${n}`,
  keyApplicationsLink: "Convites",
  tabs: { pending: "Novas", approved: "Aprovadas", rejected: "Recusadas", all: "Todas" },
  searchPlaceholder: "Nome, Instagram ou contato…",
  searchAria: "Buscar inscrições",
  isNew: "Nova",
  received: (d) => `Recebida em ${d}`,
  instagram: "Instagram",
  portfolio: "Portfólio",
  contact: "Contato",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  copy: "Copiar",
  copied: "Copiado",
  about: "Sobre ela",
  noAbout: "Sem texto de apresentação.",
  showMore: "Ver tudo",
  showLess: "Ver menos",
  formLanguage: "Idioma do formulário",
  approve: "Aprovar",
  reject: "Recusar",
  reconsider: "Voltar para análise",
  statusApproved: "Aprovada",
  statusRejected: "Recusada",
  statusPending: "Em análise",
  decided: (d, by) => (by ? `${d} · ${by}` : d),
  toastApproved: (n) => `${n} — aprovada`,
  toastRejected: (n) => `${n} — recusada`,
  toastPending: (n) => `${n} — de volta para análise`,
  undo: "Desfazer",
  errForbidden: "Só para o proprietário e administradores — sem permissão para esta ação.",
  errGeneric: "Não foi possível mudar o status. Tente novamente.",
  emptyPending: "Nenhuma inscrição nova",
  emptyPendingNote: "Novos pedidos do site aparecem aqui sozinhos.",
  emptyOther: "Ainda não há nada aqui",
  noResults: "Nenhuma inscrição corresponde à busca.",
};

const T: Record<Lang, Dict> = { en, ru, es, pt };

/** Словарь + форматтеры для текущего языка. Экспортируется для page.tsx. */
export function useRequestsI18n() {
  const ctx: unknown = useLanguage();
  const raw = ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).lang : ctx;
  const lang = normalizeLang(raw);
  const locale = LOCALES[lang];
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dtf = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  return { lang, t: T[lang], nf, dtf };
}

type I18n = ReturnType<typeof useRequestsI18n>;

/* ══════════════════════════════════════════════════════════════════
 * Типы и оформление
 * ══════════════════════════════════════════════════════════════════ */

export type ApplicationsFilter = ApplicationStatus | "all";

export type AdminRequestsProps = {
  applications: GuestApplication[];
  /** id → имя: кто принял решение */
  reviewers: Record<string, string>;
  defaultFilter?: ApplicationsFilter;
  /** статус изменён — патч строки сразу, затем страница перечитает данные */
  onChanged?: (id: string, patch: Partial<GuestApplication>) => void;
};

/** раскладка карточки по ширине контента (у дашборда сайдбар), а не окна */
const APPLICATIONS_CSS = `
.app-list { container: app-list / inline-size }
.app-card { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr) }
@container app-list (min-width: 46rem) {
  .app-card { grid-template-columns: minmax(0, 1fr) 13rem; gap: 2rem }
  .app-actions { border-left: 1px solid rgba(39, 39, 42, 0.8); padding-left: 1.75rem; border-top: 0 !important; padding-top: 0 !important }
}
`;

const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30";
const DAY_MS = 86_400_000;
const ABOUT_PREVIEW = 260;

const STATUS_PILL: Record<ApplicationStatus, { cls: string; icon: LucideIcon }> = {
  pending: { cls: "border-amber-200/30 bg-amber-200/[0.05] text-amber-200", icon: Clock },
  approved: { cls: "border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-200/90", icon: Check },
  rejected: { cls: "border-zinc-700 text-zinc-500", icon: X },
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

function LinkChip({
  href,
  icon: Icon,
  label,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-amber-200/30 hover:text-amber-100 ${FOCUS}`}
    >
      <Icon size={14} strokeWidth={1.6} className="shrink-0 text-zinc-500 group-hover:text-amber-200/80" aria-hidden />
      <span className="truncate">{label}</span>
      {detail && <span className="truncate text-xs text-zinc-500">{detail}</span>}
      <ExternalLink
        size={12}
        strokeWidth={1.6}
        className="shrink-0 text-zinc-600 group-hover:text-amber-200/70"
        aria-hidden
      />
    </a>
  );
}

function Empty({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 text-zinc-600">
        <Icon size={20} strokeWidth={1.3} aria-hidden />
      </span>
      <p className={`${cormorant.className} mt-4 text-2xl text-zinc-200`}>{title}</p>
      {note && <p className="mt-2 text-sm text-zinc-500">{note}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Карточка заявки
 * ══════════════════════════════════════════════════════════════════ */

function ApplicationCard({
  app,
  reviewer,
  busy,
  error,
  i18n,
  now,
  onDecide,
}: {
  app: GuestApplication;
  reviewer: string | null;
  busy: boolean;
  error: string | null;
  i18n: I18n;
  now: number;
  onDecide: (app: GuestApplication, status: ApplicationStatus) => void;
}) {
  const { t, dtf } = i18n;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const links = contactLinks(app.contact);
  const fresh = app.status === "pending" && now - Date.parse(app.createdAt) < DAY_MS;
  const longAbout = (app.about?.length ?? 0) > ABOUT_PREVIEW;
  const about = app.about && longAbout && !expanded ? `${app.about.slice(0, ABOUT_PREVIEW).trimEnd()}…` : app.about;
  const pill = STATUS_PILL[app.status];

  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(app.contact);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* без буфера обмена — контакт виден на карточке */
    }
  };

  return (
    <li
      className={`rounded-2xl border bg-zinc-900/40 p-5 transition-colors sm:p-6 ${fresh ? "border-amber-200/20" : "border-zinc-800/80"}`}
    >
      <div className="app-card">
        <div className="min-w-0 space-y-5">
          {/* кто */}
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900 text-sm font-medium tracking-wide text-zinc-400">
              {initials(app.fullName) || "·"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className={`${cormorant.className} break-words text-2xl font-medium leading-tight text-zinc-50`}>
                  {app.fullName}
                </p>
                {fresh && (
                  <span className="rounded-full bg-amber-200 px-2 py-px text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-950">
                    {t.isNew}
                  </span>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                <span>{t.received(dtf.format(new Date(app.createdAt)))}</span>
                {app.lang && (
                  <>
                    <span aria-hidden>·</span>
                    <span title={t.formLanguage} className="font-mono uppercase tracking-[0.15em] text-zinc-400">
                      {app.lang}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* ссылки и контакты */}
          <div className="flex flex-wrap gap-2">
            {app.handle ? (
              <LinkChip href={instagramUrl(app.handle)} icon={AtSign} label={`@${app.handle}`} detail={t.instagram} />
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400">
                <AtSign size={14} strokeWidth={1.6} aria-hidden />
                {app.instagram}
              </span>
            )}
            {app.portfolioUrl && (
              <LinkChip href={app.portfolioUrl} icon={Link2} label={t.portfolio} detail={hostOf(app.portfolioUrl)} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/30 py-1 pl-3 pr-1 text-sm text-zinc-300">
              <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{t.contact}</span>
              <span className="truncate font-mono text-[13px] text-zinc-200">{app.contact}</span>
              <button
                type="button"
                onClick={() => void copyContact()}
                title={copied ? t.copied : t.copy}
                aria-label={copied ? t.copied : t.copy}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 ${FOCUS}`}
              >
                {copied ? (
                  <Check size={13} strokeWidth={1.8} className="text-amber-200" />
                ) : (
                  <Copy size={13} strokeWidth={1.6} />
                )}
              </button>
            </span>
            {links.telegram && <LinkChip href={links.telegram} icon={Send} label={t.telegram} />}
            {links.whatsapp && <LinkChip href={links.whatsapp} icon={MessageCircle} label={t.whatsapp} />}
          </div>

          {/* о себе */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{t.about}</p>
            {about ? (
              <p className="mt-2 whitespace-pre-line break-words border-l border-amber-200/20 pl-4 text-sm leading-relaxed text-zinc-300">
                {about}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-zinc-600">{t.noAbout}</p>
            )}
            {longAbout && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={`mt-2 rounded text-xs text-amber-200/70 transition-colors hover:text-amber-100 ${FOCUS}`}
              >
                {expanded ? t.showLess : t.showMore}
              </button>
            )}
          </div>
        </div>

        {/* решение */}
        <div className="app-actions flex flex-col justify-center gap-2.5 border-t border-zinc-800/80 pt-5">
          {app.status === "pending" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(app, "approved")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-200 px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
              >
                {busy ? (
                  <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Check size={15} strokeWidth={1.8} />
                )}
                {t.approve}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(app, "rejected")}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-sm text-zinc-300 transition-colors hover:border-red-400/30 hover:text-red-200 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
              >
                <X size={15} strokeWidth={1.6} />
                {t.reject}
              </button>
            </>
          ) : (
            <>
              <span
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${pill.cls}`}
              >
                <pill.icon size={13} strokeWidth={1.7} aria-hidden />
                {app.status === "approved" ? t.statusApproved : t.statusRejected}
              </span>
              {app.reviewedAt && (
                <p className="text-center text-[11px] text-zinc-500">
                  {t.decided(dtf.format(new Date(app.reviewedAt)), reviewer)}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(app, "pending")}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`}
              >
                {busy ? (
                  <Loader2 size={13} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Undo2 size={13} strokeWidth={1.6} />
                )}
                {t.reconsider}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs text-red-300/90">
              <AlertTriangle size={13} strokeWidth={1.6} className="mt-px shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Главный компонент
 * ══════════════════════════════════════════════════════════════════ */

type Toast = { text: string; undo?: { app: GuestApplication; status: ApplicationStatus } } | null;

export default function AdminRequestsClient({
  applications,
  reviewers,
  defaultFilter,
  onChanged,
}: AdminRequestsProps) {
  const i18n = useRequestsI18n();
  const { t, nf } = i18n;

  const [filter, setFilter] = useState<ApplicationsFilter>(defaultFilter ?? "pending");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // «Новая» гаснет через сутки — пересчитываем раз в минуту
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(id);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<ApplicationsFilter, number> = { pending: 0, approved: 0, rejected: 0, all: applications.length };
    for (const a of applications) c[a.status]++;
    return c;
  }, [applications]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return applications
      .filter((a) => filter === "all" || a.status === filter)
      .filter(
        (a) => !q || [a.fullName, a.instagram, a.handle ?? "", a.contact].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        filter === "pending"
          ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
          : Date.parse(b.reviewedAt ?? b.createdAt) - Date.parse(a.reviewedAt ?? a.createdAt),
      );
  }, [applications, filter, query]);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const decide = useCallback(
    async (app: GuestApplication, status: ApplicationStatus, fromUndo = false) => {
      const previous = app.status;
      setBusyId(app.id);
      setErrors((e) => {
        const next = { ...e };
        delete next[app.id];
        return next;
      });
      try {
        const { data, error } = await supabase
          .from("guest_applications")
          .update({ status })
          .eq("id", app.id)
          .select("id, status, reviewed_at, reviewed_by");
        const row = (data ?? [])[0] as
          { status: ApplicationStatus; reviewed_at: string | null; reviewed_by: string | null } | undefined;
        if (error || !row) {
          console.error("[Requests Admin] Update error:", error ?? "no row (RLS)");
          const forbidden = !row || error?.code === "42501";
          setErrors((e) => ({ ...e, [app.id]: forbidden ? t.errForbidden : t.errGeneric }));
          return;
        }
        onChanged?.(app.id, { status: row.status, reviewedAt: row.reviewed_at, reviewedBy: row.reviewed_by });
        if (fromUndo) {
          setToast(null);
        } else {
          const text =
            status === "approved"
              ? t.toastApproved(app.fullName)
              : status === "rejected"
                ? t.toastRejected(app.fullName)
                : t.toastPending(app.fullName);
          showToast({ text, undo: { app: { ...app, status }, status: previous } });
        }
      } catch (e) {
        console.error("[Requests Admin] Update exception:", e);
        setErrors((er) => ({ ...er, [app.id]: t.errGeneric }));
      } finally {
        setBusyId(null);
      }
    },
    [t, onChanged, showToast],
  );

  const filters: ApplicationsFilter[] = ["pending", "approved", "rejected", "all"];

  let list: ReactNode;
  if (applications.length === 0 || (rows.length === 0 && !query.trim())) {
    list =
      filter === "pending" ? (
        <Empty icon={Inbox} title={t.emptyPending} note={t.emptyPendingNote} />
      ) : (
        <Empty icon={Inbox} title={t.emptyOther} />
      );
  } else if (rows.length === 0) {
    list = <Empty icon={Search} title={t.noResults} />;
  } else {
    list = (
      <ul className="app-list space-y-4">
        {rows.map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            reviewer={app.reviewedBy ? (reviewers[app.reviewedBy] ?? null) : null}
            busy={busyId === app.id}
            error={errors[app.id] ?? null}
            i18n={i18n}
            now={now}
            onDecide={(a, s) => void decide(a, s)}
          />
        ))}
      </ul>
    );
  }

  return (
    <>
      <style>{APPLICATIONS_CSS}</style>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label={t.title}
          className="flex flex-[1_1_24rem] gap-1 overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1"
        >
          {filters.map((f) => {
            const active = filter === f;
            const hot = f === "pending" && counts.pending > 0;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${FOCUS} ${
                  active
                    ? "bg-zinc-900 text-amber-200 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.14)]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.tabs[f]}
                <span
                  className={`font-mono text-[10px] ${
                    hot
                      ? "rounded-full bg-amber-200 px-1.5 py-px text-zinc-950"
                      : active
                        ? "text-amber-200/60"
                        : "text-zinc-600"
                  }`}
                >
                  {nf.format(counts[f])}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative min-w-0 flex-[1_1_14rem]">
          <Search
            size={15}
            strokeWidth={1.6}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-200/20"
          />
        </label>
      </div>

      {list}

      <p aria-live="polite" className="sr-only">
        {toast?.text ?? ""}
      </p>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-amber-200/20 bg-zinc-900/95 py-2.5 pl-4 pr-2 text-sm text-zinc-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur">
            <Check size={15} strokeWidth={1.8} className="shrink-0 text-amber-200" aria-hidden />
            <span className="min-w-0">{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => toast.undo && void decide(toast.undo.app, toast.undo.status, true)}
                className={`ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-200/10 ${FOCUS}`}
              >
                <Undo2 size={13} strokeWidth={1.6} />
                {t.undo}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
