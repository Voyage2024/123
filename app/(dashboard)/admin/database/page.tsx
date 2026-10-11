"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  LoaderCircle,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from "lucide-react";
import {
  clearAccountBan,
  getResidentRegistry,
  setAccountBan,
  type BanDuration,
  type ResidentRecord,
} from "@/app/actions/access-control";

type Dict = Record<string, string>;
const PAGE_SIZE = 50;
const LOCALE: Record<Lang, string> = { EN: "en-US", RU: "ru-RU", ES: "es-ES", PT: "pt-BR" };
const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "God Mode · Private Registry", title: "Full database", intro: "Private resident registry. Sensitive contact details are available only to club leadership.", countLabel: "Residents in registry", searchPlaceholder: "Name, email or Telegram ID…", clearSearch: "Clear search", ownerAdminOnly: "Owner / admin only",
    hResident: "Resident", hContact: "Telegram / Email", hWallet: "USDT wallet", hSegment: "Segment", hRanking: "Ranking / Reliability", hKyc: "KYC", hAccess: "Access", hActions: "Actions", loading: "Loading registry…", empty: "No residents found.", unnamed: "Name not provided", missingLocation: "Location not provided", emailMissing: "Email not provided", points: "pts", reliability: "Reliability", banned: "Banned", active: "Active", forever: "Forever", noReason: "No reason provided", clearBan: "Lift ban", ban: "Ban", page: "Page", of: "of", showing: "Showing", previous: "Previous", next: "Next",
    accessControl: "Access control", modalTitle: "Ban resident", duration: "Ban duration", d24: "24 hours", dWeek: "1 week", dMonth: "1 month", dForever: "Forever", reason: "Ban reason", reasonPlaceholder: "Describe the violation of club rules…", cancel: "Cancel", confirmBan: "Confirm ban", banSet: "The ban has been applied.", banRemoved: "The ban has been lifted.", confirmUnban: "Lift the ban for profile “{name}”?", requestError: "The operation failed. Check your permissions and try again.", status_pending: "Pending", status_approved: "Approved", status_rejected: "Rejected", status_under_review: "Under review", status_submitted: "Submitted", status_draft: "Draft", status_active: "Active", status_blocked: "Blocked", segment_working: "Working", segment_elite: "Elite", circle_voyager: "Voyager", circle_resident: "Resident", circle_preferred: "Preferred", circle_inner_circle: "Inner Circle", circle_private_circle: "Private Circle", circle_black_circle: "Black Circle", close: "Close",
  },
  RU: {
    eyebrow: "God Mode · Приватный реестр", title: "Полная база", intro: "Закрытый реестр резиденток. Чувствительные контактные данные доступны только руководству клуба.", countLabel: "Резиденток в реестре", searchPlaceholder: "Имя, email или Telegram ID…", clearSearch: "Очистить поиск", ownerAdminOnly: "Только owner / admin",
    hResident: "Резидентка", hContact: "Telegram / Email", hWallet: "Кошелёк USDT", hSegment: "Сегмент", hRanking: "Рейтинг / Надёжность", hKyc: "KYC", hAccess: "Доступ", hActions: "Действия", loading: "Загрузка реестра…", empty: "Резидентки не найдены.", unnamed: "Без ФИО", missingLocation: "Локация не указана", emailMissing: "Email не указан", points: "балл.", reliability: "Надёжность", banned: "Заблокирован", active: "Активен", forever: "Навсегда", noReason: "Причина не указана", clearBan: "Снять бан", ban: "Бан", page: "Страница", of: "из", showing: "Показано", previous: "Назад", next: "Далее",
    accessControl: "Управление доступом", modalTitle: "Заблокировать резидентку", duration: "Срок блокировки", d24: "24 часа", dWeek: "1 неделя", dMonth: "1 месяц", dForever: "Навсегда", reason: "Причина блокировки", reasonPlaceholder: "Опишите нарушение правил клуба…", cancel: "Отмена", confirmBan: "Подтвердить бан", banSet: "Блокировка установлена.", banRemoved: "Блокировка снята.", confirmUnban: "Снять блокировку с профиля «{name}»?", requestError: "Не удалось выполнить операцию. Проверьте права доступа и повторите попытку.", status_pending: "Ожидает", status_approved: "Одобрено", status_rejected: "Отклонено", status_under_review: "На проверке", status_submitted: "Отправлено", status_draft: "Черновик", status_active: "Активен", status_blocked: "Заблокирован", segment_working: "Working", segment_elite: "Elite", circle_voyager: "Voyager", circle_resident: "Resident", circle_preferred: "Preferred", circle_inner_circle: "Inner Circle", circle_private_circle: "Private Circle", circle_black_circle: "Black Circle", close: "Закрыть",
  },
  ES: {
    eyebrow: "God Mode · Registro privado", title: "Base de datos completa", intro: "Registro privado de residentes. Los datos de contacto sensibles solo están disponibles para la dirección del club.", countLabel: "Residentes en el registro", searchPlaceholder: "Nombre, email o ID de Telegram…", clearSearch: "Borrar búsqueda", ownerAdminOnly: "Solo propietario / admin",
    hResident: "Residente", hContact: "Telegram / Email", hWallet: "Monedero USDT", hSegment: "Segmento", hRanking: "Ranking / Fiabilidad", hKyc: "KYC", hAccess: "Acceso", hActions: "Acciones", loading: "Cargando registro…", empty: "No se encontraron residentes.", unnamed: "Nombre no disponible", missingLocation: "Ubicación no indicada", emailMissing: "Email no indicado", points: "pts", reliability: "Fiabilidad", banned: "Bloqueado", active: "Activo", forever: "Indefinido", noReason: "Sin motivo indicado", clearBan: "Retirar bloqueo", ban: "Bloquear", page: "Página", of: "de", showing: "Mostrando", previous: "Anterior", next: "Siguiente",
    accessControl: "Control de acceso", modalTitle: "Bloquear residente", duration: "Duración del bloqueo", d24: "24 horas", dWeek: "1 semana", dMonth: "1 mes", dForever: "Indefinido", reason: "Motivo del bloqueo", reasonPlaceholder: "Describe la infracción de las reglas del club…", cancel: "Cancelar", confirmBan: "Confirmar bloqueo", banSet: "Se ha aplicado el bloqueo.", banRemoved: "Se ha retirado el bloqueo.", confirmUnban: "¿Retirar el bloqueo del perfil “{name}”?", requestError: "No se pudo completar la operación. Comprueba los permisos e inténtalo de nuevo.", status_pending: "Pendiente", status_approved: "Aprobado", status_rejected: "Rechazado", status_under_review: "En revisión", status_submitted: "Enviado", status_draft: "Borrador", status_active: "Activo", status_blocked: "Bloqueado", segment_working: "Working", segment_elite: "Elite", circle_voyager: "Voyager", circle_resident: "Resident", circle_preferred: "Preferred", circle_inner_circle: "Inner Circle", circle_private_circle: "Private Circle", circle_black_circle: "Black Circle", close: "Cerrar",
  },
  PT: {
    eyebrow: "God Mode · Registro privado", title: "Base de dados completa", intro: "Registro privado de residentes. Os dados de contato confidenciais estão disponíveis apenas para a direção do clube.", countLabel: "Residentes no registro", searchPlaceholder: "Nome, email ou ID do Telegram…", clearSearch: "Limpar busca", ownerAdminOnly: "Somente proprietário / admin",
    hResident: "Residente", hContact: "Telegram / Email", hWallet: "Carteira USDT", hSegment: "Segmento", hRanking: "Ranking / Confiabilidade", hKyc: "KYC", hAccess: "Acesso", hActions: "Ações", loading: "Carregando registro…", empty: "Nenhum residente encontrado.", unnamed: "Nome não informado", missingLocation: "Localização não informada", emailMissing: "Email não informado", points: "pts", reliability: "Confiabilidade", banned: "Bloqueado", active: "Ativo", forever: "Permanente", noReason: "Motivo não informado", clearBan: "Remover bloqueio", ban: "Bloquear", page: "Página", of: "de", showing: "Exibindo", previous: "Anterior", next: "Próxima",
    accessControl: "Controle de acesso", modalTitle: "Bloquear residente", duration: "Duração do bloqueio", d24: "24 horas", dWeek: "1 semana", dMonth: "1 mês", dForever: "Permanente", reason: "Motivo do bloqueio", reasonPlaceholder: "Descreva a violação das regras do clube…", cancel: "Cancelar", confirmBan: "Confirmar bloqueio", banSet: "O bloqueio foi aplicado.", banRemoved: "O bloqueio foi removido.", confirmUnban: "Remover o bloqueio do perfil “{name}”?", requestError: "Não foi possível concluir a operação. Verifique suas permissões e tente novamente.", status_pending: "Pendente", status_approved: "Aprovado", status_rejected: "Rejeitado", status_under_review: "Em análise", status_submitted: "Enviado", status_draft: "Rascunho", status_active: "Ativo", status_blocked: "Bloqueado", segment_working: "Working", segment_elite: "Elite", circle_voyager: "Voyager", circle_resident: "Resident", circle_preferred: "Preferred", circle_inner_circle: "Inner Circle", circle_private_circle: "Private Circle", circle_black_circle: "Black Circle", close: "Fechar",
  },
};

function durationLabel(value: BanDuration, t: Dict) {
  return value === "24_hours" ? t.d24 : value === "1_week" ? t.dWeek : value === "1_month" ? t.dMonth : t.dForever;
}
function statusLabel(value: string | null, t: Dict) {
  if (!value) return "—";
  return t[`status_${value.toLowerCase()}`] ?? value.replaceAll("_", " ");
}
function circleLabel(value: string | null, t: Dict) {
  if (!value) return t.circle_voyager;
  return t[`circle_${value.toLowerCase()}`] ?? value.replaceAll("_", " ");
}
function segmentLabel(value: string | null, t: Dict) {
  return t[`segment_${(value || "working").toLowerCase()}`] ?? value ?? "Working";
}

function banActive(row: ResidentRecord) {
  if (row.ban_permanent || row.banned_until === "infinity") return true;
  if (!row.banned_until) return false;
  const until = Date.parse(row.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

function dateLabel(value: string | null, locale: string, foreverLabel: string) {
  if (!value || value === "infinity") return value === "infinity" ? foreverLabel : "—";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function FullDatabasePage() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [rows, setRows] = useState<ResidentRecord[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<ResidentRecord | null>(null);
  const [duration, setDuration] = useState<BanDuration>("24_hours");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getResidentRegistry(page, search);
    if (!result.ok) {
      setError(t.requestError);
      setRows([]);
      setCount(0);
    } else {
      setRows(result.rows);
      setCount(result.count);
    }
    setLoading(false);
  }, [page, search, t]);

  // The asynchronous loader owns loading/error state for this query lifecycle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submitBan = async () => {
    if (!banTarget) return;
    setWorking(true);
    setError(null);
    const result = await setAccountBan(banTarget.id, duration, reason);
    if (!result.ok) {
      setError(t.requestError);
    } else {
      setNotice(t.banSet);
      setBanTarget(null);
      setReason("");
      await load();
    }
    setWorking(false);
  };

  const unban = async (row: ResidentRecord) => {
    const accepted = window.confirm(t.confirmUnban.replace("{name}", row.full_name || row.name || row.id));
    if (!accepted) return;
    setWorking(true);
    setError(null);
    const result = await clearAccountBan(row.id);
    if (!result.ok) setError(t.requestError);
    else {
      setNotice(t.banRemoved);
      await load();
    }
    setWorking(false);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-7 sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-200/[0.05] blur-[90px]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65"><Database size={13} /> {t.eyebrow}</p>
            <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{t.intro}</p>
          </div>
          <div className="rounded-xl border border-zinc-700/70 bg-black/20 px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-600">{t.countLabel}</p>
            <p className="mt-1 font-serif text-2xl tabular-nums text-zinc-100">{count.toLocaleString(LOCALE[lang])}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/45 px-4 py-3 transition-colors focus-within:border-amber-200/25">
          <Search size={16} className="shrink-0 text-zinc-600" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder={t.searchPlaceholder}
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          {search && <button type="button" onClick={() => { setSearch(""); setPage(0); }} className="text-zinc-600 transition-colors hover:text-zinc-200" aria-label={t.clearSearch}><X size={15} /></button>}
        </label>
        <div className="flex items-center gap-2 text-xs text-zinc-600"><ShieldCheck size={14} className="text-amber-100/55" /> {t.ownerAdminOnly}</div>
      </div>

      {notice && <div className="flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200/90"><span className="flex items-center gap-2"><Check size={14} />{notice}</span><button onClick={() => setNotice(null)} aria-label={t.close}><X size={14} /></button></div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-left">
            <thead className="bg-black/20">
              <tr className="border-b border-zinc-800/80 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                <th className="px-4 py-4">{t.hResident}</th>
                <th className="px-4 py-4">{t.hContact}</th>
                <th className="px-4 py-4">{t.hWallet}</th>
                <th className="px-4 py-4">{t.hSegment}</th>
                <th className="px-4 py-4">{t.hRanking}</th>
                <th className="px-4 py-4">{t.hKyc}</th>
                <th className="px-4 py-4">{t.hAccess}</th>
                <th className="px-4 py-4">{t.hActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500"><LoaderCircle size={18} className="mr-2 inline animate-spin text-amber-100/70" />{t.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-500">{t.empty}</td></tr>
              ) : rows.map((row) => {
                const active = banActive(row);
                return (
                  <tr key={row.id} className="align-top transition-colors hover:bg-white/[0.015]">
                    <td className="max-w-[230px] px-4 py-4">
                      <p className="truncate text-sm font-medium text-zinc-200">{row.full_name?.trim() || row.name?.trim() || t.unnamed}</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-700" title={row.id}>{row.id.slice(0, 8)}…</p>
                      <p className="mt-1 text-[10px] text-zinc-600">{row.location || t.missingLocation}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-4">
                      <p className="truncate text-xs text-zinc-300" title={row.telegram_id ?? undefined}>{row.telegram_id || "—"}</p>
                      <p className="mt-1 truncate text-[11px] text-zinc-600" title={row.email ?? undefined}>{row.email || t.emailMissing}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-4"><p className="break-all font-mono text-[10px] leading-5 text-zinc-400" title={row.usdt_wallet ?? undefined}>{row.usdt_wallet || "—"}</p></td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] ${row.segment === "elite" ? "border-amber-200/25 bg-amber-200/[0.07] text-amber-100" : "border-zinc-700/70 bg-zinc-800/50 text-zinc-400"}`}>{segmentLabel(row.segment, t)}</span>
                      <p className="mt-2 text-[10px] text-zinc-600">{circleLabel(row.circle, t)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm tabular-nums text-zinc-200">{row.influence_index ?? row.tour_points ?? 0} <span className="text-[10px] text-zinc-600">{t.points}</span></p>
                      <p className="mt-1 text-[11px] tabular-nums text-zinc-500">{t.reliability} {Number(row.reliability ?? 100).toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-4"><span className="text-xs tabular-nums text-zinc-300">{row.kyc_level ?? 0}/3</span><p className="mt-1 text-[10px] text-zinc-600">{statusLabel(row.status, t)}</p></td>
                    <td className="max-w-[200px] px-4 py-4">
                      {active ? <><span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/30 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-rose-200"><Ban size={11} /> {t.banned}</span><p className="mt-2 text-[10px] text-zinc-500">{row.ban_permanent ? t.forever : dateLabel(row.banned_until, LOCALE[lang], t.forever)}</p><p className="mt-1 line-clamp-2 text-[10px] text-zinc-600" title={row.ban_reason ?? undefined}>{row.ban_reason || t.noReason}</p></> : <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-emerald-200/80"><Check size={11} /> {t.active}</span>}
                    </td>
                    <td className="px-4 py-4">
                      {active ? <button disabled={working} onClick={() => void unban(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 px-3 py-2 text-[10px] text-zinc-300 transition-all hover:border-emerald-500/30 hover:text-emerald-200 disabled:opacity-50"><UnlockKeyhole size={12} /> {t.clearBan}</button> : <button disabled={working} onClick={() => { setBanTarget(row); setDuration("24_hours"); setReason(""); setError(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-950/15 px-3 py-2 text-[10px] text-rose-200/85 transition-all hover:border-rose-400/40 hover:bg-rose-950/30 disabled:opacity-50"><Ban size={12} /> {t.ban}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-zinc-800/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] tracking-wide text-zinc-600">{t.page} {page + 1} {t.of} {totalPages} · {t.showing} {rows.length} {t.of} {count}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-30"><ChevronLeft size={14} /> {t.previous}</button>
            <button type="button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-30">{t.next} <ChevronRight size={14} /></button>
          </div>
        </footer>
      </section>

      {banTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setBanTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ban-modal-title" className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-7">
            <button type="button" onClick={() => setBanTarget(null)} disabled={working} className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-40" aria-label={t.close}><X size={17} /></button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-950/25 text-rose-200"><Ban size={18} /></div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-200/70">{t.accessControl}</p>
            <h2 id="ban-modal-title" className="mt-2 font-serif text-2xl text-zinc-50">{t.modalTitle}</h2>
            <p className="mt-2 text-sm text-zinc-500">{banTarget.full_name || banTarget.name || banTarget.id}</p>

            <label className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{t.duration}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["24_hours", "1_week", "1_month", "forever"] as BanDuration[]).map((value) => <button type="button" key={value} onClick={() => setDuration(value)} className={`rounded-xl border px-3 py-3 text-xs transition-colors ${duration === value ? "border-amber-200/35 bg-amber-200/[0.07] text-amber-100" : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"}`}>{durationLabel(value, t)}</button>)}
            </div>

            <label htmlFor="ban-reason" className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{t.reason}</label>
            <textarea id="ban-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder={t.reasonPlaceholder} className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm leading-6 text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-amber-200/25" />
            <div className="mt-1 text-right text-[10px] text-zinc-700">{reason.length}/500</div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setBanTarget(null)} disabled={working} className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40">{t.cancel}</button>
              <button type="button" onClick={() => void submitBan()} disabled={working || !reason.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-950/50 px-5 py-3 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40">{working ? <LoaderCircle size={14} className="animate-spin" /> : <Clock3 size={14} />} {t.confirmBan}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
