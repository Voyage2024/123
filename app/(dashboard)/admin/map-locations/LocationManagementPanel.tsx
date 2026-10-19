"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronUp, Loader2, Send, UserRound, Users, X } from "lucide-react";
import {
  getMapHubManagementData,
  type MapHubApplication,
  sendMapHubTestNotification,
  setMapHubNotifications,
  setMapHubResponsibility,
  updateMapHubApplicationStatus,
  type MapHubManagementData,
  type MapHubStaff,
} from "@/app/actions/map-locations";

type Lang = "EN" | "RU" | "ES" | "PT";
const COPY: Record<Lang, Record<string, string>> = {
  EN: {
    applications: "Tour applications", loading: "Loading applications…", pending: "Pending review", approved: "Approved", rejected: "Rejected", completed: "Completed", history: "Application history", emptyGroup: "No applications in this section.", noApplications: "No applications for this location yet.", model: "Model", profile: "Profile details", city: "Location", citizenship: "Citizenship", kyc: "Verification level", view: "View profile", hide: "Hide profile", approve: "Approve", reject: "Reject", saveError: "Could not complete the action.", statusSaved: "Application status updated.", manager: "Responsible manager", admin: "Responsible admin", unassigned: "Not assigned", save: "Assign", ownerOnly: "Only the owner can change assignments.", alerts: "Telegram alerts for this location", enabled: "Enabled", disabled: "Disabled", turnOn: "Enable alerts", turnOff: "Disable alerts", sendTest: "Send test notification", testSent: "Test notification sent.", noRecipients: "No responsible person with a linked Telegram ID is assigned.", noTelegram: "Telegram ID not linked", notifySaved: "Notification preference saved.", nameMissing: "Unnamed model", about: "About", smoking: "Smoking", alcohol: "Alcohol", yes: "Yes", no: "No", close: "Close", noStaff: "No staff available for this assignment.", roleOwner: "Owner", roleAdmin: "Admin", roleManager: "Manager",
  },
  RU: {
    applications: "Отклики на тур", loading: "Загрузка заявок…", pending: "Ожидают рассмотрения", approved: "Одобрены", rejected: "Отклонены", completed: "Завершены", history: "История заявок", emptyGroup: "В этом разделе заявок нет.", noApplications: "По этой локации пока нет откликов.", model: "Модель", profile: "Карточка модели", city: "Локация", citizenship: "Гражданство", kyc: "Уровень верификации", view: "Карточка", hide: "Скрыть карточку", approve: "Одобрить", reject: "Отклонить", saveError: "Не удалось выполнить действие.", statusSaved: "Статус заявки обновлён.", manager: "Ответственный менеджер", admin: "Ответственный админ", unassigned: "Не назначен", save: "Назначить", ownerOnly: "Назначения может менять только владелец.", alerts: "Telegram-оповещения по локации", enabled: "Включены", disabled: "Выключены", turnOn: "Включить оповещения", turnOff: "Выключить оповещения", sendTest: "Отправить тестовое уведомление", testSent: "Тестовое уведомление отправлено.", noRecipients: "Не назначен ответственный с подключённым Telegram ID.", noTelegram: "Telegram не подключён", notifySaved: "Настройка оповещений сохранена.", nameMissing: "Без имени", about: "О себе", smoking: "Курение", alcohol: "Алкоголь", yes: "Да", no: "Нет", close: "Закрыть", noStaff: "Нет сотрудников для этого назначения.", roleOwner: "Владелец", roleAdmin: "Админ", roleManager: "Менеджер",
  },
  ES: {
    applications: "Solicitudes para el tour", loading: "Cargando solicitudes…", pending: "Pendientes de revisión", approved: "Aprobadas", rejected: "Rechazadas", completed: "Completadas", history: "Historial de solicitudes", emptyGroup: "No hay solicitudes en esta sección.", noApplications: "Todavía no hay solicitudes para esta ubicación.", model: "Modelo", profile: "Perfil del modelo", city: "Ubicación", citizenship: "Ciudadanía", kyc: "Nivel de verificación", view: "Ver perfil", hide: "Ocultar perfil", approve: "Aprobar", reject: "Rechazar", saveError: "No se pudo completar la acción.", statusSaved: "Estado de la solicitud actualizado.", manager: "Gerente responsable", admin: "Administrador responsable", unassigned: "Sin asignar", save: "Asignar", ownerOnly: "Solo el propietario puede cambiar las asignaciones.", alerts: "Alertas de Telegram para esta ubicación", enabled: "Activadas", disabled: "Desactivadas", turnOn: "Activar alertas", turnOff: "Desactivar alertas", sendTest: "Enviar notificación de prueba", testSent: "Notificación de prueba enviada.", noRecipients: "No hay una persona responsable asignada con Telegram vinculado.", noTelegram: "Telegram no vinculado", notifySaved: "Preferencia de notificaciones guardada.", nameMissing: "Modelo sin nombre", about: "Acerca de", smoking: "Tabaco", alcohol: "Alcohol", yes: "Sí", no: "No", close: "Cerrar", noStaff: "No hay personal disponible para esta asignación.", roleOwner: "Propietario", roleAdmin: "Administrador", roleManager: "Gerente",
  },
  PT: {
    applications: "Candidaturas para o tour", loading: "Carregando candidaturas…", pending: "Aguardando análise", approved: "Aprovadas", rejected: "Rejeitadas", completed: "Concluídas", history: "Histórico de candidaturas", emptyGroup: "Não há candidaturas nesta seção.", noApplications: "Ainda não há candidaturas para esta localização.", model: "Modelo", profile: "Perfil do modelo", city: "Localização", citizenship: "Cidadania", kyc: "Nível de verificação", view: "Ver perfil", hide: "Ocultar perfil", approve: "Aprovar", reject: "Rejeitar", saveError: "Não foi possível concluir a ação.", statusSaved: "Status da candidatura atualizado.", manager: "Gerente responsável", admin: "Administrador responsável", unassigned: "Não atribuído", save: "Atribuir", ownerOnly: "Somente o proprietário pode alterar as atribuições.", alerts: "Alertas do Telegram para esta localização", enabled: "Ativados", disabled: "Desativados", turnOn: "Ativar alertas", turnOff: "Desativar alertas", sendTest: "Enviar notificação de teste", testSent: "Notificação de teste enviada.", noRecipients: "Não há responsável atribuído com Telegram vinculado.", noTelegram: "Telegram não vinculado", notifySaved: "Preferência de notificações salva.", nameMissing: "Modelo sem nome", about: "Sobre", smoking: "Tabagismo", alcohol: "Álcool", yes: "Sim", no: "Não", close: "Fechar", noStaff: "Não há equipe disponível para esta atribuição.", roleOwner: "Proprietário", roleAdmin: "Administrador", roleManager: "Gerente",
  },
};

function formatStatus(status: string, t: Record<string, string>) {
  if (status === "pending") return t.pending;
  if (status === "approved") return t.approved;
  if (status === "rejected") return t.rejected;
  if (status === "completed") return t.completed;
  return status;
}

export default function LocationManagementPanel({
  hubId,
  lang,
  isOwner,
}: {
  hubId: string;
  lang: Lang;
  isOwner: boolean;
}) {
  const t = COPY[lang] ?? COPY.EN;
  const [data, setData] = useState<MapHubManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getMapHubManagementData(hubId);
    if (result.ok) {
      setData(result);
      setError("");
    } else {
      setData(null);
      setError(t.saveError);
    }
    setLoading(false);
  }, [hubId, t.saveError]);

  useEffect(() => { void load(); }, [load]);

  const runStatus = async (applicationId: string, status: "approved" | "rejected") => {
    setWorking(applicationId); setError(""); setNotice("");
    const result = await updateMapHubApplicationStatus(applicationId, status);
    if (!result.ok) setError(t.saveError);
    else { setNotice(t.statusSaved); await load(); }
    setWorking(null);
  };

  const saveAssignment = async (role: "manager" | "admin", profileId: string) => {
    setWorking(`${role}-assignment`); setError(""); setNotice("");
    const result = await setMapHubResponsibility({ hubId, assignmentRole: role, profileId: profileId || null });
    if (!result.ok) setError(t.saveError);
    else { setNotice(t.statusSaved); await load(); }
    setWorking(null);
  };

  const toggleNotifications = async () => {
    if (!data) return;
    setWorking("notifications"); setError(""); setNotice("");
    const enabled = !data.notificationsEnabled;
    const result = await setMapHubNotifications({ hubId, enabled });
    if (!result.ok) setError(t.saveError);
    else { setData((current) => current ? { ...current, notificationsEnabled: enabled } : current); setNotice(t.notifySaved); }
    setWorking(null);
  };

  const sendTest = async () => {
    setWorking("test"); setError(""); setNotice("");
    const result = await sendMapHubTestNotification(hubId);
    if (!result.ok) setError(result.reason === "no_recipients" ? t.noRecipients : t.saveError);
    else setNotice(t.testSent);
    setWorking(null);
  };

  const assignments = data?.assignments ?? [];
  const assignedId = (role: "manager" | "admin") => assignments.find((item) => item.assignment_role === role)?.profile_id ?? "";
  const pendingCount = data?.applications.filter((item) => item.status === "pending").length ?? 0;
  const approvedCount = data?.applications.filter((item) => item.status === "approved").length ?? 0;

  const renderApplication = (application: MapHubApplication) => {
    const person = application.profile;
    const name = person?.full_name?.trim() || person?.name?.trim() || t.nameMissing;
    const isPending = application.status === "pending";
    const isApproved = application.status === "approved";
    const isExpanded = expandedProfile === application.id;
    const busy = working === application.id;
    return (
      <article key={application.id} className="rounded-xl border border-zinc-800/70 bg-zinc-950/45 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {person?.resolved_avatar_url ? <img src={person.resolved_avatar_url} alt={name} className="h-14 w-14 shrink-0 rounded-xl border border-amber-200/15 object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-600"><UserRound size={22} /></div>}
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100">{name}</p>
              <p className="mt-1 break-all text-[10px] text-zinc-500">{person?.email || "—"}</p>
              <p className="mt-1 text-[10px] text-zinc-600">{new Date(application.created_at).toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "ES" ? "es-ES" : lang === "PT" ? "pt-BR" : "en-US")}{person?.segment ? ` · ${person.segment}` : ""}{person?.level ? ` · LVL ${person.level}` : ""}{person?.reliability !== null && person?.reliability !== undefined ? ` · ${person.reliability}%` : ""}</p>
              <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] ${isApproved ? "border-emerald-500/20 bg-emerald-950/25 text-emerald-200" : application.status === "rejected" ? "border-rose-500/20 bg-rose-950/20 text-rose-200" : "border-amber-200/20 bg-amber-200/[0.04] text-amber-100"}`}>{formatStatus(application.status, t)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setExpandedProfile(isExpanded ? null : application.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/70 px-3 py-2 text-[10px] text-zinc-300 transition-colors hover:border-amber-200/25 hover:text-amber-100">{isExpanded ? <ChevronUp size={12} /> : <UserRound size={12} />}{isExpanded ? t.hide : t.view}</button>
            {isPending ? <button type="button" disabled={working !== null} onClick={() => void runStatus(application.id, "approved")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-950/40 disabled:opacity-40">{busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{t.approve}</button> : null}
            {(isPending || isApproved) ? <button type="button" disabled={working !== null} onClick={() => void runStatus(application.id, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-[10px] text-rose-200 transition-colors hover:bg-rose-950/40 disabled:opacity-40"><X size={12} />{t.reject}</button> : null}
          </div>
        </div>
        {isExpanded && person ? <div className="mt-4 grid gap-2 border-t border-zinc-800/60 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.city}</p><p className="mt-1 text-xs text-zinc-300">{person.location || "—"}</p></div>
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.citizenship}</p><p className="mt-1 text-xs text-zinc-300">{person.citizenship || "—"}</p></div>
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.kyc}</p><p className="mt-1 text-xs text-zinc-300">{person.kyc_level ?? 0}</p></div>
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.smoking}</p><p className="mt-1 text-xs text-zinc-300">{person.smoking ? t.yes : t.no}</p></div>
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.alcohol}</p><p className="mt-1 text-xs text-zinc-300">{person.alcohol ? t.yes : t.no}</p></div>
          <div className="rounded-lg bg-black/20 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.profile}</p><p className="mt-1 text-xs text-zinc-300">{person.birth_date || "—"}{person.height ? ` · ${person.height} cm` : ""}{person.weight ? ` · ${person.weight} kg` : ""}{person.measurements ? ` · ${person.measurements}` : ""}</p></div>
          {person.about ? <div className="rounded-lg bg-black/20 p-3 sm:col-span-2 lg:col-span-3"><p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">{t.about}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-300">{person.about}</p></div> : null}
        </div> : null}
      </article>
    );
  };

  const applicationGroups = data ? [
    { key: "pending", label: t.pending, applications: data.applications.filter((item) => item.status === "pending") },
    { key: "approved", label: t.approved, applications: data.applications.filter((item) => item.status === "approved") },
    { key: "history", label: t.history, applications: data.applications.filter((item) => item.status !== "pending" && item.status !== "approved") },
  ].filter((group) => group.key !== "history" || group.applications.length > 0) : [];

  return (
    <section className="mt-5 border-t border-zinc-800/70 pt-5" aria-label={t.applications}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/85"><Users size={14} /> {t.applications}</h3>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-2.5 py-1 text-amber-100">{pendingCount} {t.pending}</span>
          <span className="rounded-full border border-emerald-500/15 bg-emerald-950/20 px-2.5 py-1 text-emerald-200">{approvedCount} {t.approved}</span>
        </div>
      </div>

      {loading ? <div className="flex items-center gap-2 py-6 text-xs text-zinc-500"><Loader2 size={14} className="animate-spin" /> {t.loading}</div> : !data ? null : (
        <>
          <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-950/45 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-200">{t.alerts}</p>
                <p className={`mt-1 text-[10px] ${data.notificationsEnabled ? "text-emerald-200/80" : "text-zinc-500"}`}>{data.notificationsEnabled ? t.enabled : t.disabled}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={working !== null} onClick={() => void toggleNotifications()} className="rounded-lg border border-zinc-700/80 px-3 py-2 text-[10px] text-zinc-300 transition-colors hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-40">
                  {working === "notifications" ? <Loader2 size={12} className="inline animate-spin" /> : null} {data.notificationsEnabled ? t.turnOff : t.turnOn}
                </button>
                <button type="button" disabled={working !== null} onClick={() => void sendTest()} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/20 bg-amber-200/[0.05] px-3 py-2 text-[10px] text-amber-100 transition-colors hover:bg-amber-200/[0.1] disabled:opacity-40"><Send size={12} /> {working === "test" ? <Loader2 size={12} className="animate-spin" /> : null} {t.sendTest}</button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(["manager", "admin"] as const).map((role) => {
              const options = data.staff.filter((person) => person.role === role || person.role === "owner");
              const label = role === "manager" ? t.manager : t.admin;
              const selection = assignedId(role);
              const assigned = data.staff.find((person) => person.id === selection);
              return <div key={role} className="rounded-xl border border-zinc-800/70 bg-zinc-950/35 p-3.5">
                <label className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</label>
                {isOwner ? <div className="mt-2 flex gap-2">
                  <select aria-label={label} value={selection} onChange={(event) => void saveAssignment(role, event.target.value)} disabled={working !== null} className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-amber-200/30 disabled:opacity-50">
                    <option value="">{t.unassigned}</option>
                    {options.map((person) => <option key={person.id} value={person.id}>{person.full_name?.trim() || person.name?.trim() || person.email || person.id} · {person.role === "owner" ? t.roleOwner : person.role === "admin" ? t.roleAdmin : t.roleManager}{person.telegram_id ? "" : ` · ${t.noTelegram}`}</option>)}
                  </select>
                  {working === `${role}-assignment` ? <Loader2 size={14} className="mt-2.5 animate-spin text-amber-100" /> : null}
                </div> : <p className="mt-2 text-xs text-zinc-300">{assigned ? assigned.full_name || assigned.name || assigned.email || assigned.id : t.unassigned}</p>}
                {!options.length && isOwner ? <p className="mt-2 text-[10px] text-zinc-600">{t.noStaff}</p> : null}
              </div>;
            })}
          </div>

          <div className="mt-4 space-y-5">
            {!data.applications.length ? <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-600">{t.noApplications}</p> : applicationGroups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{group.label}</h4>
                  <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500">{group.applications.length}</span>
                </div>
                {group.applications.length ? <div className="space-y-3">{group.applications.map(renderApplication)}</div> : <p className="rounded-lg border border-dashed border-zinc-800/70 px-3 py-4 text-center text-[10px] text-zinc-600">{t.emptyGroup}</p>}
              </section>
            ))}
          </div>
        </>
      )}
      {notice ? <p role="status" className="mt-3 text-xs text-emerald-200"><Check size={13} className="mr-1 inline" />{notice}</p> : null}
      {error ? <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p> : null}
    </section>
  );
}
