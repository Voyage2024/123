"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { Lang } from "@/lib/gamification";
import {
  getEventApplications,
  updateEventApplicationStatus,
  type PartyApplication,
  type PartyApplicationStatus,
  type PartyApplicationSummary,
} from "@/app/(dashboard)/admin/parties/actions";
import { cormorant } from "@/app/components/profile/fonts";

type Props = {
  eventId: string;
  eventTitle: string;
  lang: Lang;
  onClose: () => void;
  onCountsChanged: (eventId: string, summary: PartyApplicationSummary) => void;
};

type Filter = "all" | PartyApplicationStatus;

const COPY: Record<Lang, {
  eyebrow: string; subtitle: string; close: string; refresh: string; loading: string;
  applicants: string; pending: string; approved: string; rejected: string; completed: string;
  all: string; emptyTitle: string; emptyText: string; retry: string; error: string;
  approve: string; reject: string; returnPending: string; applied: string; kyc: string;
  level: string; reliability: string; segmentWorking: string; segmentElite: string;
  profileApproved: string; profilePending: string; completedNotice: string;
  confirmApprove: string; confirmReject: string; confirmPending: string;
  updateError: string; permissionError: string;
}> = {
  en: {
    eyebrow: "Event applications", subtitle: "Review applicants and manage approval status.", close: "Close", refresh: "Refresh", loading: "Loading applications…",
    applicants: "Applicants", pending: "Pending", approved: "Approved", rejected: "Rejected", completed: "Completed",
    all: "All", emptyTitle: "No applications yet", emptyText: "When residents apply, they will appear here.", retry: "Try again", error: "Could not load applications.",
    approve: "Approve", reject: "Reject", returnPending: "Return to pending", applied: "Applied", kyc: "KYC", level: "Level", reliability: "Reliability",
    segmentWorking: "Working", segmentElite: "Elite", profileApproved: "Profile approved", profilePending: "Profile not approved", completedNotice: "Completed application is read-only here.",
    confirmApprove: "Approve this application?", confirmReject: "Reject this application?", confirmPending: "Return this application to pending?", updateError: "Could not update status.", permissionError: "Only admin and owner can manage applications."
  },
  ru: {
    eyebrow: "Заявки на тусовку", subtitle: "Просмотр откликов и управление статусами заявок.", close: "Закрыть", refresh: "Обновить", loading: "Загружаем заявки…",
    applicants: "Участники", pending: "На рассмотрении", approved: "Одобрены", rejected: "Отклонены", completed: "Завершены",
    all: "Все", emptyTitle: "Заявок пока нет", emptyText: "Отклики резидентов появятся здесь.", retry: "Повторить", error: "Не удалось загрузить заявки.",
    approve: "Одобрить", reject: "Отклонить", returnPending: "Вернуть на рассмотрение", applied: "Отклик", kyc: "KYC", level: "Уровень", reliability: "Надёжность",
    segmentWorking: "Working", segmentElite: "Elite", profileApproved: "Профиль одобрен", profilePending: "Профиль не одобрен", completedNotice: "Завершённую заявку здесь нельзя изменить.",
    confirmApprove: "Одобрить эту заявку?", confirmReject: "Отклонить эту заявку?", confirmPending: "Вернуть заявку на рассмотрение?", updateError: "Не удалось изменить статус.", permissionError: "Управлять заявками могут только admin и owner."
  },
  es: {
    eyebrow: "Solicitudes del evento", subtitle: "Revise las solicitudes y gestione su estado.", close: "Cerrar", refresh: "Actualizar", loading: "Cargando solicitudes…",
    applicants: "Solicitantes", pending: "Pendientes", approved: "Aprobadas", rejected: "Rechazadas", completed: "Completadas",
    all: "Todas", emptyTitle: "Aún no hay solicitudes", emptyText: "Las solicitudes de los residentes aparecerán aquí.", retry: "Reintentar", error: "No se pudieron cargar las solicitudes.",
    approve: "Aprobar", reject: "Rechazar", returnPending: "Volver a pendientes", applied: "Enviada", kyc: "KYC", level: "Nivel", reliability: "Fiabilidad",
    segmentWorking: "Working", segmentElite: "Elite", profileApproved: "Perfil aprobado", profilePending: "Perfil no aprobado", completedNotice: "La solicitud completada es de solo lectura aquí.",
    confirmApprove: "¿Aprobar esta solicitud?", confirmReject: "¿Rechazar esta solicitud?", confirmPending: "¿Volver a poner esta solicitud como pendiente?", updateError: "No se pudo actualizar el estado.", permissionError: "Solo admin y owner pueden gestionar solicitudes."
  },
  pt: {
    eyebrow: "Inscrições no evento", subtitle: "Revise os interessados e gerencie o status das inscrições.", close: "Fechar", refresh: "Atualizar", loading: "Carregando inscrições…",
    applicants: "Interessados", pending: "Pendentes", approved: "Aprovados", rejected: "Rejeitados", completed: "Concluídas",
    all: "Todas", emptyTitle: "Ainda não há inscrições", emptyText: "As inscrições dos residentes aparecerão aqui.", retry: "Tentar novamente", error: "Não foi possível carregar as inscrições.",
    approve: "Aprovar", reject: "Rejeitar", returnPending: "Voltar para pendentes", applied: "Enviada", kyc: "KYC", level: "Nível", reliability: "Confiabilidade",
    segmentWorking: "Working", segmentElite: "Elite", profileApproved: "Perfil aprovado", profilePending: "Perfil não aprovado", completedNotice: "A inscrição concluída é somente leitura aqui.",
    confirmApprove: "Aprovar esta inscrição?", confirmReject: "Rejeitar esta inscrição?", confirmPending: "Retornar esta inscrição para pendente?", updateError: "Não foi possível atualizar o status.", permissionError: "Somente admin e owner podem gerenciar inscrições."
  },
};

const STATUS_CLASS: Record<PartyApplicationStatus, string> = {
  pending: "border-amber-200/25 bg-amber-200/[0.07] text-amber-100",
  approved: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200",
  rejected: "border-rose-400/20 bg-rose-400/[0.05] text-rose-200",
  completed: "border-zinc-700 bg-zinc-800/70 text-zinc-300",
};

export default function PartyApplicationsDialog({ eventId, eventTitle, lang, onClose, onCountsChanged }: Props) {
  const t = COPY[lang];
  const [rows, setRows] = useState<PartyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEventApplications(eventId);
      if (result.ok) {
        setRows(result.data);
        setError(null);
        onCountsChanged(eventId, countRows(result.data));
      } else {
        setError(/admin|owner|permission|роль|прав|42501/i.test(result.error) ? t.permissionError : t.error);
      }
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [eventId, onCountsChanged, t.error]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && busyId === null) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busyId, onClose]);

  const filteredRows = useMemo(() => filter === "all" ? rows : rows.filter((row) => row.status === filter), [filter, rows]);
  const summary = useMemo(() => countRows(rows), [rows]);

  async function updateStatus(row: PartyApplication, status: Exclude<PartyApplicationStatus, "completed">) {
    const confirmText = status === "approved" ? t.confirmApprove : status === "rejected" ? t.confirmReject : t.confirmPending;
    if (!window.confirm(`${confirmText}\n\n${row.full_name}`)) return;
    setBusyId(row.id);
    setMutationError(null);
    try {
      const result = await updateEventApplicationStatus(eventId, row.id, status);
      if (!result.ok) {
        const message = /admin|owner|permission|роль|прав|42501/i.test(result.error) ? t.permissionError : t.updateError;
        setMutationError(message);
        return;
      }
      const nextRows = rows.map((item) => item.id === row.id ? { ...item, status, updated_at: result.data.updated_at } : item);
      setRows(nextRows);
      onCountsChanged(eventId, countRows(nextRows));
    } catch {
      setMutationError(t.updateError);
    } finally {
      setBusyId(null);
    }
  }

  const labelForStatus = (status: PartyApplicationStatus) => t[status];
  const filterItems: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: t.all, count: summary.total },
    { key: "pending", label: t.pending, count: summary.pending },
    { key: "approved", label: t.approved, count: summary.approved },
    { key: "rejected", label: t.rejected, count: summary.rejected },
    { key: "completed", label: t.completed, count: summary.completed },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId === null) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`${t.applicants}: ${eventTitle}`} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-amber-200/20 bg-zinc-950 shadow-2xl shadow-black/70 sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{t.eyebrow}</p>
            <h2 className={`${cormorant.className} mt-1 truncate text-3xl text-amber-100`}>{eventTitle}</h2>
            <p className="mt-1 text-xs text-zinc-500">{t.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => void load()} disabled={loading || busyId !== null} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-zinc-400 transition hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-50" aria-label={t.refresh} title={t.refresh}><RefreshCw size={15} className={loading ? "animate-spin" : ""}/></button>
            <button type="button" onClick={onClose} disabled={busyId !== null} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-zinc-500 transition hover:text-zinc-100 disabled:opacity-50" aria-label={t.close}><X size={16}/></button>
          </div>
        </header>

        <div className="border-b border-zinc-800/70 px-5 py-4 sm:px-7">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {filterItems.map((item) => (
              <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-xl border px-3 py-2 text-left transition ${filter === item.key ? "border-amber-200/30 bg-amber-200/[0.07] text-amber-100" : "border-zinc-800 bg-zinc-900/35 text-zinc-500 hover:text-zinc-200"}`}>
                <span className="block text-[10px]">{item.label}</span><span className="mt-1 block font-mono text-lg tabular-nums">{item.count}</span>
              </button>
            ))}
          </div>
          {!loading && <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-600"><Users size={12}/>{t.applicants}: {summary.total} <span>·</span> {t.approved}: {summary.approved}</div>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {mutationError && <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-3 text-xs text-rose-200"><AlertTriangle size={14} className="mt-0.5 shrink-0"/>{mutationError}</div>}
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500"><Loader2 size={17} className="animate-spin text-amber-200"/>{t.loading}</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.035] p-8 text-center"><AlertTriangle size={24} className="mx-auto text-rose-200"/><p className="mt-3 text-sm text-rose-100">{error || t.error}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-200">{t.retry}</button></div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-zinc-500"><Users size={22}/></span><h3 className={`${cormorant.className} mt-4 text-2xl text-zinc-200`}>{rows.length === 0 ? t.emptyTitle : t.all === filter ? t.emptyTitle : `${t.all}: 0`}</h3><p className="mt-1 text-xs text-zinc-600">{t.emptyText}</p></div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredRows.map((row) => {
                const busy = busyId === row.id;
                return <article key={row.id} className="rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/65 to-zinc-950/80 p-4 transition-colors hover:border-zinc-700/80 sm:p-5">
                  <div className="flex items-start gap-3">
                    {row.avatar_url ? <img src={row.avatar_url} alt={row.full_name} className="h-16 w-16 shrink-0 rounded-2xl border border-amber-200/15 object-cover"/> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-600"><CircleUserRound size={27}/></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className={`${cormorant.className} break-words text-xl text-zinc-100`}>{row.full_name}</h3><span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider ${STATUS_CLASS[row.status]}`}>{labelForStatus(row.status)}</span></div>
                      {row.email && <p className="mt-0.5 break-all text-[11px] text-zinc-500">{row.email}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.segment && <span className="rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-300">{row.segment === "elite" ? t.segmentElite : t.segmentWorking}</span>}
                        <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-300"><ShieldCheck size={10}/>{t.kyc} {Math.max(0, row.kyc_level ?? 0)}/3</span>
                        {row.level !== null && <span className="rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-300">{t.level} {row.level}</span>}
                        {row.reliability !== null && <span className="rounded-lg border border-zinc-800 bg-black/15 px-2 py-1 text-[9px] text-zinc-400">{t.reliability} {row.reliability}%</span>}
                        {row.profile_status && <span className={`rounded-lg border px-2 py-1 text-[9px] ${row.profile_status === "approved" ? "border-emerald-400/20 text-emerald-200" : "border-amber-200/20 text-amber-100"}`}>{row.profile_status === "approved" ? t.profileApproved : t.profilePending}</span>}
                      </div>
                      <p className="mt-3 text-[10px] text-zinc-600">{t.applied}: {new Date(row.created_at).toLocaleString(lang === "ru" ? "ru-RU" : lang === "es" ? "es-ES" : lang === "pt" ? "pt-BR" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  {row.status === "completed" ? (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-zinc-800 bg-black/15 px-3 py-2.5 text-[11px] text-zinc-500"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-zinc-400"/>{t.completedNotice}</div>
                  ) : (
                    <div className="mt-4 grid gap-2 border-t border-zinc-800/70 pt-4 sm:grid-cols-2">
                      {row.status !== "approved" && <button type="button" disabled={busy || busyId !== null} onClick={() => void updateStatus(row, "approved")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-xs text-emerald-200 transition hover:bg-emerald-400/[0.12] disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin"/> : <Check size={13} />}{t.approve}</button>}
                      {row.status !== "rejected" && <button type="button" disabled={busy || busyId !== null} onClick={() => void updateStatus(row, "rejected")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] px-3 py-2.5 text-xs text-rose-200 transition hover:bg-rose-400/[0.1] disabled:opacity-50"><XCircle size={13}/>{t.reject}</button>}
                      {row.status !== "pending" && <button type="button" disabled={busy || busyId !== null} onClick={() => void updateStatus(row, "pending")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/35 px-3 py-2.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"><Clock3 size={13}/>{t.returnPending}</button>}
                    </div>
                  )}
                </article>;
              })}
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-zinc-800/80 px-5 py-3 text-[10px] text-zinc-600 sm:px-7">
          <span>{t.applicants}: {summary.total}</span><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-zinc-400 transition hover:text-zinc-100">{t.close}</button>
        </footer>
      </section>
    </div>
  );
}

function countRows(rows: Array<{ status: string }>): PartyApplicationSummary {
  const result: PartyApplicationSummary = { total: rows.length, pending: 0, approved: 0, rejected: 0, completed: 0 };
  for (const row of rows) {
    if (row.status === "pending" || row.status === "approved" || row.status === "rejected" || row.status === "completed") result[row.status] += 1;
  }
  return result;
}
