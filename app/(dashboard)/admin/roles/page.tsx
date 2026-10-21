"use client";

/* ──────────────────────────────────────────────────────────────────────
 * /admin/roles — управление доступом персонала (только владелец).
 *
 * Роли staff, заморозки и баны, Telegram-ссылки восстановления,
 * приглашение сотрудника и закрепление за локациями карты.
 * Доступ к разделу режут middleware и RoleGuard в admin/layout.tsx
 * (lib/rbac: "/admin/roles" → OWNER_ROLES); экшены перепроверяют
 * владельца на сервере.
 *
 * Алиас "@/..." указывает на корень проекта, поэтому экшены, компоненты
 * и контексты импортируются через "@/app/...".
 * ──────────────────────────────────────────────────────────────────── */

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronDown,
  KeyRound,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";

import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import {
  changeStaffRole,
  clearAccountBan,
  createTelegramRecoveryLink,
  getStaffUsers,
  setAccountBan,
  type BanDuration,
  type StaffRecord,
} from "@/app/actions/access-control";
import {
  getStaffMapHubAssignments,
  setMapHubResponsibility,
  type StaffAssignment,
  type StaffMapHub,
} from "@/app/actions/map-locations";
import AddStaffModal, { type AddStaffModalLabels } from "@/app/components/admin/AddStaffModal";
import TelegramRecoveryLinkModal, {
  type RecoveryModalLabels,
} from "@/app/components/admin/TelegramRecoveryLinkModal";

// ---------------------------------------------------------------------------
// Переводы (EN / RU / ES / PT)
// ---------------------------------------------------------------------------

type Dict = Record<string, string>;
type EditableRole = "admin" | "manager" | "resident";
type SlotRole = "manager" | "admin";

const LOCALE: Record<Lang, string> = { EN: "en-US", RU: "ru-RU", ES: "es-ES", PT: "pt-BR" };
const BAN_DURATIONS: BanDuration[] = ["24_hours", "1_week", "1_month", "forever"];
const PRESENCE_REFRESH_MS = 60_000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Owner only · Governance", title: "Access management", intro: "Manage staff roles, temporary account freezes and permanent bans. Every change is validated server-side and recorded for audit.", addStaffButton: "Add staff", addStaffTitle: "Invite a staff member", addStaffDescription: "Create an account without sending an email. Share the one-time Telegram link with the new staff member.", staffName: "Full name", staffNamePlaceholder: "Enter full name", staffEmail: "Email address", staffRole: "Role", createStaff: "Create staff account", creatingStaff: "Creating account…", staffInviteReady: "Staff account created", staffInviteReadyDescription: "Send this one-time Telegram link to the staff member. It expires in 15 minutes.", staffInviteLink: "Telegram activation link", staffCreatedRole: "Assigned role", staffErrorAccess: "Only the owner can add staff. Sign in with an owner account and try again.", staffErrorInvalid: "Check the name, email address and selected role.", staffErrorDuplicate: "This email address is already registered in VOYAGE.", staffErrorFailed: "The account could not be created. No invitation link was issued. Try again or inspect server logs.", refresh: "Refresh", directory: "Staff directory", staff: "Club staff", accounts: "accounts", colPerson: "Staff member", colRole: "Role", colStatus: "Access status", colPeriod: "Duration / reason", colActions: "Actions", colPresence: "Presence", online: "Online", neverSeen: "Never seen", lastSeen: "Last seen", restoreAccess: "Restore access", restoreTitle: "Restore Telegram access", restoreDescription: "Send this one-time link to the staff member through a verified channel. It expires in 15 minutes.", restoreExpires: "Link expires at", copyLink: "Copy recovery link", copiedLink: "Link copied", loading: "Loading staff…", noStaff: "No staff members found, or access to the data is unavailable.", noName: "Unnamed user", statusMissing: "Status not provided", roleAdmin: "Administrator", roleManager: "Manager", roleOwner: "Owner", roleResident: "Remove staff role", banned: "Banned", active: "Active", forever: "Forever", noLimits: "No restrictions", noReason: "Reason not provided", liftBan: "Lift ban", ban: "Ban", block: "Block account", ownerNotice: "The owner is shown for location assignments but cannot be banned or demoted here. Administrators cannot ban other staff members.", locationAssignments: "Map locations", assigned: "Assigned", assign: "Assign here", unassign: "Unassign", currentResponsible: "Current responsible", noLocations: "No map locations found.", ownerAsManager: "Assign owner as manager", ownerAsAdmin: "Assign owner as admin", modalTag: "Staff access", modalTitle: "Freeze account", duration: "Ban duration", d24: "24 hours", dWeek: "1 week", dMonth: "1 month", dForever: "Forever", reason: "Reason", reasonPlaceholder: "Describe the reason for restricting access…", cancel: "Cancel", confirmBan: "Confirm ban", close: "Close", successBan: "The ban has been applied.", successUnban: "The ban has been lifted.", successRole: "The role has been updated.", locationSaved: "Location assignment updated.", confirmRemoveRole: "Remove the staff role from {name}? The user will become a resident.", confirmChangeRole: "Change this user’s role to {role}?", confirmUnban: "Lift the ban for {name}?", requestError: "The operation failed. Check access permissions and try again.", status_pending: "Pending", status_approved: "Approved", status_rejected: "Rejected", status_under_review: "Under review", status_submitted: "Submitted", status_draft: "Draft",
  },
  RU: {
    eyebrow: "Только владелец · Управление", title: "Управление доступом", intro: "Роли персонала, временная заморозка и постоянные блокировки. Все изменения проверяются на сервере и записываются в аудит.", addStaffButton: "Добавить сотрудника", addStaffTitle: "Пригласить сотрудника", addStaffDescription: "Создайте аккаунт без отправки письма. Передайте новому сотруднику одноразовую ссылку для подключения Telegram.", staffName: "Имя и фамилия", staffNamePlaceholder: "Введите полное имя", staffEmail: "Email", staffRole: "Роль", createStaff: "Создать аккаунт", creatingStaff: "Создание аккаунта…", staffInviteReady: "Аккаунт сотрудника создан", staffInviteReadyDescription: "Передайте сотруднику эту одноразовую ссылку Telegram. Она действует 15 минут.", staffInviteLink: "Ссылка активации Telegram", staffCreatedRole: "Назначенная роль", staffErrorAccess: "Добавлять сотрудников может только владелец. Войдите под аккаунтом владельца.", staffErrorInvalid: "Проверьте имя, email и выбранную роль.", staffErrorDuplicate: "Этот email уже зарегистрирован в VOYAGE.", staffErrorFailed: "Не удалось создать аккаунт. Ссылка не выдана. Повторите попытку или проверьте серверные логи.", refresh: "Обновить", directory: "Staff directory", staff: "Персонал клуба", accounts: "аккаунтов", colPerson: "Сотрудник", colRole: "Роль", colStatus: "Статус доступа", colPeriod: "Срок / причина", colActions: "Управление", colPresence: "Присутствие", online: "Онлайн", neverSeen: "Ещё не заходил", lastSeen: "Был(а) в сети", restoreAccess: "Восстановить доступ", restoreTitle: "Восстановление доступа Telegram", restoreDescription: "Передайте сотруднику одноразовую ссылку по проверенному каналу. Она действует 15 минут.", restoreExpires: "Ссылка действует до", copyLink: "Скопировать ссылку", copiedLink: "Ссылка скопирована", loading: "Загрузка персонала…", noStaff: "Нет сотрудников или нет доступа к данным.", noName: "Без имени", statusMissing: "Статус не указан", roleAdmin: "Администратор", roleManager: "Менеджер", roleOwner: "Владелец", roleResident: "Снять роль", banned: "Заблокирован", active: "Активен", forever: "Навсегда", noLimits: "Без ограничений", noReason: "Причина не указана", liftBan: "Снять бан", ban: "Бан", block: "Заблокировать", ownerNotice: "Владелец отображается для настройки локаций, но его нельзя заблокировать или понизить на этой странице. Администраторы не могут блокировать других сотрудников.", locationAssignments: "Локации карты", assigned: "Назначен", assign: "Назначить", unassign: "Отвязать", currentResponsible: "Текущий ответственный", noLocations: "Локации карты не найдены.", ownerAsManager: "Назначить владельца менеджером", ownerAsAdmin: "Назначить владельца админом", modalTag: "Доступ персонала", modalTitle: "Заморозить аккаунт", duration: "Срок блокировки", d24: "24 часа", dWeek: "1 неделя", dMonth: "1 месяц", dForever: "Навсегда", reason: "Причина", reasonPlaceholder: "Опишите причину ограничения доступа…", cancel: "Отмена", confirmBan: "Подтвердить блокировку", close: "Закрыть", successBan: "Блокировка установлена.", successUnban: "Блокировка снята.", successRole: "Роль обновлена.", locationSaved: "Привязка локации обновлена.", confirmRemoveRole: "Снять персональную роль у {name}? Пользователь станет резидентом.", confirmChangeRole: "Изменить роль пользователя на «{role}»?", confirmUnban: "Снять блокировку с {name}?", requestError: "Не удалось выполнить операцию. Проверьте права доступа и повторите попытку.", status_pending: "Ожидает", status_approved: "Одобрено", status_rejected: "Отклонено", status_under_review: "На проверке", status_submitted: "Отправлено", status_draft: "Черновик",
  },
  ES: {
    eyebrow: "Solo propietario · Gobernanza", title: "Gestión de acceso", intro: "Gestiona los roles del personal, las suspensiones temporales y los bloqueos permanentes. Cada cambio se valida en el servidor y queda registrado para auditoría.", addStaffButton: "Añadir empleado", addStaffTitle: "Invitar a un miembro del equipo", addStaffDescription: "Crea una cuenta sin enviar correos. Comparte con el nuevo empleado el enlace de un solo uso para vincular Telegram.", staffName: "Nombre completo", staffNamePlaceholder: "Introduce el nombre completo", staffEmail: "Correo electrónico", staffRole: "Rol", createStaff: "Crear cuenta", creatingStaff: "Creando cuenta…", staffInviteReady: "Cuenta creada", staffInviteReadyDescription: "Envía este enlace de Telegram al empleado. Es de un solo uso y caduca en 15 minutos.", staffInviteLink: "Enlace de activación de Telegram", staffCreatedRole: "Rol asignado", staffErrorAccess: "Solo el propietario puede añadir empleados. Inicia sesión con una cuenta de propietario.", staffErrorInvalid: "Revisa el nombre, el correo y el rol seleccionado.", staffErrorDuplicate: "Este correo ya está registrado en VOYAGE.", staffErrorFailed: "No se pudo crear la cuenta. No se generó ningún enlace. Inténtalo de nuevo o revisa los registros del servidor.", refresh: "Actualizar", directory: "Directorio del personal", staff: "Equipo del club", accounts: "cuentas", colPerson: "Empleado", colRole: "Rol", colStatus: "Estado de acceso", colPeriod: "Duración / motivo", colActions: "Acciones", colPresence: "Presencia", online: "En línea", neverSeen: "Sin visitas", lastSeen: "Última visita", restoreAccess: "Restaurar acceso", restoreTitle: "Restaurar acceso a Telegram", restoreDescription: "Envía este enlace de un solo uso por un canal verificado. Caduca en 15 minutos.", restoreExpires: "El enlace caduca", copyLink: "Copiar enlace", copiedLink: "Enlace copiado", loading: "Cargando personal…", noStaff: "No se encontraron empleados o los datos no están disponibles.", noName: "Usuario sin nombre", statusMissing: "Estado no indicado", roleAdmin: "Administrador", roleManager: "Gerente", roleOwner: "Propietario", roleResident: "Quitar rol de personal", banned: "Bloqueado", active: "Activo", forever: "Indefinido", noLimits: "Sin restricciones", noReason: "Motivo no indicado", liftBan: "Retirar bloqueo", ban: "Bloquear", block: "Bloquear cuenta", ownerNotice: "El propietario aparece para asignar ubicaciones, pero no puede bloquearse ni degradarse aquí. Los administradores no pueden bloquear a otros empleados.", locationAssignments: "Ubicaciones del mapa", assigned: "Asignado", assign: "Asignar aquí", unassign: "Desvincular", currentResponsible: "Responsable actual", noLocations: "No se encontraron ubicaciones.", ownerAsManager: "Asignar propietario como gerente", ownerAsAdmin: "Asignar propietario como administrador", modalTag: "Acceso del personal", modalTitle: "Suspender cuenta", duration: "Duración del bloqueo", d24: "24 horas", dWeek: "1 semana", dMonth: "1 mes", dForever: "Indefinido", reason: "Motivo", reasonPlaceholder: "Describe el motivo de la restricción de acceso…", cancel: "Cancelar", confirmBan: "Confirmar bloqueo", close: "Cerrar", successBan: "Se ha aplicado el bloqueo.", successUnban: "Se ha retirado el bloqueo.", successRole: "Se ha actualizado el rol.", locationSaved: "Se ha actualizado la asignación de ubicación.", confirmRemoveRole: "¿Quitar el rol de personal a {name}? El usuario pasará a ser residente.", confirmChangeRole: "¿Cambiar el rol de este usuario a {role}?", confirmUnban: "¿Retirar el bloqueo de {name}?", requestError: "No se pudo completar la operación. Comprueba los permisos e inténtalo de nuevo.", status_pending: "Pendiente", status_approved: "Aprobado", status_rejected: "Rechazado", status_under_review: "En revisión", status_submitted: "Enviado", status_draft: "Borrador",
  },
  PT: {
    eyebrow: "Somente proprietário · Governança", title: "Gestão de acesso", intro: "Gerencie funções da equipe, suspensões temporárias e bloqueios permanentes. Cada alteração é validada no servidor e registrada para auditoria.", addStaffButton: "Adicionar colaborador", addStaffTitle: "Convidar colaborador", addStaffDescription: "Crie uma conta sem enviar e-mail. Compartilhe com o novo colaborador o link único para vincular o Telegram.", staffName: "Nome completo", staffNamePlaceholder: "Digite o nome completo", staffEmail: "E-mail", staffRole: "Função", createStaff: "Criar conta", creatingStaff: "Criando conta…", staffInviteReady: "Conta criada", staffInviteReadyDescription: "Envie este link do Telegram ao colaborador. Ele é de uso único e expira em 15 minutos.", staffInviteLink: "Link de ativação do Telegram", staffCreatedRole: "Função atribuída", staffErrorAccess: "Somente o proprietário pode adicionar colaboradores. Entre com uma conta do proprietário.", staffErrorInvalid: "Confira o nome, o e-mail e a função selecionada.", staffErrorDuplicate: "Este e-mail já está cadastrado no VOYAGE.", staffErrorFailed: "Não foi possível criar a conta. Nenhum link foi emitido. Tente novamente ou verifique os logs do servidor.", refresh: "Atualizar", directory: "Diretório da equipe", staff: "Equipe do clube", accounts: "contas", colPerson: "Colaborador", colRole: "Função", colStatus: "Status de acesso", colPeriod: "Duração / motivo", colActions: "Ações", colPresence: "Presença", online: "Online", neverSeen: "Sem visitas", lastSeen: "Última visita", restoreAccess: "Restaurar acesso", restoreTitle: "Restaurar acesso ao Telegram", restoreDescription: "Envie este link de uso único por um canal verificado. Expira em 15 minutos.", restoreExpires: "O link expira em", copyLink: "Copiar link", copiedLink: "Link copiado", loading: "Carregando equipe…", noStaff: "Nenhum colaborador encontrado ou os dados estão indisponíveis.", noName: "Usuário sem nome", statusMissing: "Status não informado", roleAdmin: "Administrador", roleManager: "Gerente", roleOwner: "Proprietário", roleResident: "Remover função da equipe", banned: "Bloqueado", active: "Ativo", forever: "Permanente", noLimits: "Sem restrições", noReason: "Motivo não informado", liftBan: "Remover bloqueio", ban: "Bloquear", block: "Bloquear conta", ownerNotice: "O proprietário aparece para atribuir localizações, mas não pode ser bloqueado ou rebaixado aqui. Administradores não podem bloquear outros colaboradores.", locationAssignments: "Localizações do mapa", assigned: "Atribuído", assign: "Atribuir aqui", unassign: "Desvincular", currentResponsible: "Responsável atual", noLocations: "Nenhuma localização encontrada.", ownerAsManager: "Atribuir proprietário como gerente", ownerAsAdmin: "Atribuir proprietário como administrador", modalTag: "Acesso da equipe", modalTitle: "Suspender conta", duration: "Duração do bloqueio", d24: "24 horas", dWeek: "1 semana", dMonth: "1 mês", dForever: "Permanente", reason: "Motivo", reasonPlaceholder: "Descreva o motivo da restrição de acesso…", cancel: "Cancelar", confirmBan: "Confirmar bloqueio", close: "Fechar", successBan: "O bloqueio foi aplicado.", successUnban: "O bloqueio foi removido.", successRole: "A função foi atualizada.", locationSaved: "A atribuição da localização foi atualizada.", confirmRemoveRole: "Remover a função da equipe de {name}? O usuário passará a ser residente.", confirmChangeRole: "Alterar a função deste usuário para {role}?", confirmUnban: "Remover o bloqueio de {name}?", requestError: "Não foi possível concluir a operação. Verifique suas permissões e tente novamente.", status_pending: "Pendente", status_approved: "Aprovado", status_rejected: "Rejeitado", status_under_review: "Em análise", status_submitted: "Enviado", status_draft: "Rascunho",
  },
};

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

function displayName(row: StaffRecord) {
  return row.full_name || row.email || row.id;
}

function isActiveBan(row: StaffRecord) {
  if (row.ban_permanent || row.banned_until === "infinity") return true;
  if (!row.banned_until) return false;
  const timestamp = Date.parse(row.banned_until);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function dateLabel(value: string | null, locale: string, forever: string) {
  if (!value) return "—";
  if (value === "infinity") return forever;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  const timestamp = Date.parse(lastSeenAt);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -60_000 && age < ONLINE_WINDOW_MS;
}

function durationLabel(value: BanDuration, t: Dict) {
  if (value === "24_hours") return t.d24;
  if (value === "1_week") return t.dWeek;
  if (value === "1_month") return t.dMonth;
  return t.dForever;
}

function statusLabel(status: string | null, t: Dict) {
  if (!status) return t.statusMissing;
  return t[`status_${status.toLowerCase()}`] ?? status.replaceAll("_", " ");
}

/** Какие слоты локации показываем сотруднику: владелец может занять оба. */
function slotRolesFor(role: StaffRecord["role"]): SlotRole[] {
  if (role === "owner") return ["manager", "admin"];
  return role === "manager" ? ["manager"] : ["admin"];
}

function canTakeSlot(role: StaffRecord["role"], slot: SlotRole) {
  return role === "owner" || role === slot;
}

// ---------------------------------------------------------------------------
// Страница
// ---------------------------------------------------------------------------

export default function RoleManagementPage() {
  const { lang } = useLanguage();
  const { role: viewerRole, loading: authLoading } = useAuth();
  const t = T[lang] ?? T.EN;
  const locale = LOCALE[lang] ?? LOCALE.EN;
  const isOwner = viewerRole === "owner";

  const [rows, setRows] = useState<StaffRecord[]>([]);
  const [locationData, setLocationData] = useState<{ hubs: StaffMapHub[]; assignments: StaffAssignment[] }>({
    hubs: [],
    assignments: [],
  });
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [locationWorking, setLocationWorking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [banTarget, setBanTarget] = useState<StaffRecord | null>(null);
  const [duration, setDuration] = useState<BanDuration>("24_hours");
  const [reason, setReason] = useState("");
  const [recovery, setRecovery] = useState<{ link: string; expiresAt: string; profileName: string } | null>(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const [result, locationsResult] = await Promise.all([getStaffUsers(), getStaffMapHubAssignments()]);
    if (!result.ok) {
      setError(t.requestError);
      setRows([]);
    } else {
      setRows(result.rows);
    }
    if (!locationsResult.ok) setError(t.requestError);
    else setLocationData({ hubs: locationsResult.hubs, assignments: locationsResult.assignments });
    setLoading(false);
  }, [t]);

  // Грузим данные, только когда сессия проверена и это владелец:
  // иначе экшены всё равно вернут отказ, а пользователь увидит ошибку.
  useEffect(() => {
    if (authLoading || !isOwner) return;
    // Async loader owns loading and error state for this query lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [authLoading, isOwner, load]);

  // Держим присутствие сотрудников актуальным, пока экран открыт.
  useEffect(() => {
    if (authLoading || !isOwner) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, PRESENCE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [authLoading, isOwner, load]);

  // ── Роли ────────────────────────────────────────────────────────────────

  const onRoleChange = async (row: StaffRecord, nextRole: EditableRole) => {
    if (row.role === nextRole) return;
    const message = nextRole === "resident"
      ? t.confirmRemoveRole.replace("{name}", displayName(row))
      : t.confirmChangeRole.replace("{role}", nextRole === "admin" ? t.roleAdmin : t.roleManager);
    if (!window.confirm(message)) return;

    setWorkingId(row.id);
    setError(null);
    const result = await changeStaffRole(row.id, nextRole);
    if (!result.ok) {
      setError(t.requestError);
    } else {
      setNotice(t.successRole);
      await load();
    }
    setWorkingId(null);
  };

  // ── Локации карты ───────────────────────────────────────────────────────

  const changeStaffLocation = async (row: StaffRecord, hubId: string, assignmentRole: SlotRole) => {
    const existing = locationData.assignments.find(
      (item) => item.hub_id === hubId && item.assignment_role === assignmentRole,
    );
    const currentForPerson = existing?.profile_id === row.id;
    if (!currentForPerson && existing) {
      const holder = rows.find((person) => person.id === existing.profile_id)?.full_name || existing.profile_id;
      if (!window.confirm(`${t.currentResponsible}: ${holder}. ${t.assign}?`)) return;
    }

    setLocationWorking(`${row.id}:${hubId}:${assignmentRole}`);
    setError(null);
    setNotice(null);
    const result = await setMapHubResponsibility({
      hubId,
      assignmentRole,
      profileId: currentForPerson ? null : row.id,
    });
    if (!result.ok) {
      setError(t.requestError);
    } else {
      setNotice(t.locationSaved);
      const refreshed = await getStaffMapHubAssignments();
      if (refreshed.ok) setLocationData({ hubs: refreshed.hubs, assignments: refreshed.assignments });
    }
    setLocationWorking(null);
  };

  const mapHubLabel = (hub: StaffMapHub) => {
    const name = hub.name;
    if (name && typeof name === "object") return name[lang] || name.EN || hub.id;
    return typeof name === "string" && name.trim() ? name : hub.id;
  };

  // ── Баны ────────────────────────────────────────────────────────────────

  const openBan = (row: StaffRecord) => {
    setBanTarget(row);
    setDuration("24_hours");
    setReason("");
  };

  const closeBan = () => {
    if (!workingId) setBanTarget(null);
  };

  const submitBan = async () => {
    if (!banTarget) return;
    setWorkingId(banTarget.id);
    setError(null);
    const result = await setAccountBan(banTarget.id, duration, reason);
    if (!result.ok) {
      setError(t.requestError);
    } else {
      setNotice(t.successBan);
      setBanTarget(null);
      setReason("");
      await load();
    }
    setWorkingId(null);
  };

  const unban = async (row: StaffRecord) => {
    if (!window.confirm(t.confirmUnban.replace("{name}", displayName(row)))) return;
    setWorkingId(row.id);
    setError(null);
    const result = await clearAccountBan(row.id);
    if (!result.ok) {
      setError(t.requestError);
    } else {
      setNotice(t.successUnban);
      await load();
    }
    setWorkingId(null);
  };

  // ── Восстановление доступа через Telegram ───────────────────────────────

  const recoverAccess = async (row: StaffRecord) => {
    setWorkingId(row.id);
    setError(null);
    const result = await createTelegramRecoveryLink(row.id);
    if (!result.ok) {
      setError(result.error || t.requestError);
    } else {
      setRecovery({ link: result.link, expiresAt: result.expiresAt, profileName: result.profileName });
      setNotice(`${t.restoreAccess}: ${result.profileName}`);
    }
    setWorkingId(null);
  };

  // ── Подписи для модалок ─────────────────────────────────────────────────

  const recoveryLabels: RecoveryModalLabels = {
    title: t.restoreTitle,
    description: t.restoreDescription,
    expires: t.restoreExpires,
    copy: t.copyLink,
    copied: t.copiedLink,
    close: t.close,
  };

  const addStaffLabels: AddStaffModalLabels = {
    title: t.addStaffTitle,
    description: t.addStaffDescription,
    fullName: t.staffName,
    fullNamePlaceholder: t.staffNamePlaceholder,
    email: t.staffEmail,
    role: t.staffRole,
    roleAdmin: t.roleAdmin,
    roleManager: t.roleManager,
    submit: t.createStaff,
    creating: t.creatingStaff,
    cancel: t.cancel,
    close: t.close,
    successTitle: t.staffInviteReady,
    successDescription: t.staffInviteReadyDescription,
    linkLabel: t.staffInviteLink,
    expires: t.restoreExpires,
    copy: t.copyLink,
    copied: t.copiedLink,
    createdRole: t.staffCreatedRole,
    errors: {
      access: t.staffErrorAccess,
      invalid: t.staffErrorInvalid,
      duplicate: t.staffErrorDuplicate,
      failed: t.staffErrorFailed,
    },
  };

  const showSpinner = authLoading || (isOwner && loading);

  // ── Разметка ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-7 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/55 to-zinc-950 p-7 sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-200/[0.05] blur-[90px]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65">
              <KeyRound size={13} /> {t.eyebrow}
            </p>
            <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{t.intro}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddStaffOpen(true)}
              disabled={!isOwner}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/[0.07] px-4 py-3 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-200/45 hover:bg-amber-200/[0.11] disabled:opacity-40"
            >
              <UserPlus size={14} /> {t.addStaffButton}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={showSpinner || !isOwner}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-zinc-700/80 bg-black/15 px-4 py-3 text-xs text-zinc-300 transition-colors hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-40"
            >
              <RefreshCw size={14} className={showSpinner ? "animate-spin" : ""} /> {t.refresh}
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200/90">
          <span className="flex items-center gap-2"><Check size={14} />{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}><X size={14} /></button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
        <div className="flex flex-col gap-2 border-b border-zinc-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">{t.directory}</p>
            <h2 className="mt-1 font-serif text-xl text-zinc-100">{t.staff}</h2>
          </div>
          <span className="w-fit rounded-full border border-zinc-700/70 bg-black/15 px-3 py-1 text-xs tabular-nums text-zinc-400">
            {rows.length} {t.accounts}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="bg-black/20">
              <tr className="border-b border-zinc-800/80 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                <th className="px-5 py-4">{t.colPerson}</th>
                <th className="px-5 py-4">{t.colRole}</th>
                <th className="px-5 py-4">{t.colStatus}</th>
                <th className="px-5 py-4">{t.colPresence}</th>
                <th className="px-5 py-4">{t.colPeriod}</th>
                <th className="px-5 py-4">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {showSpinner ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-zinc-500">
                    <LoaderCircle size={17} className="mr-2 inline animate-spin text-amber-100/70" />{t.loading}
                  </td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-zinc-500">{t.noStaff}</td>
                </tr>
              ) : rows.map((row) => {
                const banned = isActiveBan(row);
                const busy = workingId === row.id;
                const expanded = expandedStaffId === row.id;

                return (
                  <Fragment key={row.id}>
                    <tr className="align-top transition-colors hover:bg-white/[0.015]">
                      {/* Сотрудник */}
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setExpandedStaffId((current) => (current === row.id ? null : row.id))}
                          aria-expanded={expanded}
                          className="flex items-center gap-2 text-left text-sm font-medium text-zinc-200 transition-colors hover:text-amber-100"
                        >
                          <span>{row.full_name?.trim() || t.noName}</span>
                          <ChevronDown size={13} className={`text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                        <p className="mt-1 text-xs text-zinc-600">{row.email || row.id}</p>
                        <p className="mt-1 text-[10px] text-zinc-700">{statusLabel(row.status, t)}</p>
                      </td>

                      {/* Роль */}
                      <td className="px-5 py-4">
                        {row.role === "owner" ? (
                          <span className="inline-flex items-center rounded-lg border border-amber-200/20 bg-amber-200/[0.05] px-3 py-2 text-xs text-amber-100">
                            {t.roleOwner}
                          </span>
                        ) : (
                          <label className="relative inline-flex items-center">
                            <select
                              aria-label={t.colRole}
                              value={row.role}
                              onChange={(event) => void onRoleChange(row, event.target.value as EditableRole)}
                              disabled={busy}
                              className="appearance-none rounded-lg border border-zinc-700/70 bg-zinc-950 px-3 py-2 pr-8 text-xs text-zinc-200 outline-none transition-colors hover:border-amber-200/25 focus:border-amber-200/30 disabled:opacity-50"
                            >
                              <option value="admin">{t.roleAdmin}</option>
                              <option value="manager">{t.roleManager}</option>
                              <option value="resident">{t.roleResident}</option>
                            </select>
                            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-zinc-600" />
                          </label>
                        )}
                      </td>

                      {/* Статус доступа */}
                      <td className="px-5 py-4">
                        {banned ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/30 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-rose-200">
                            <Ban size={11} /> {t.banned}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-emerald-200/80">
                            <ShieldCheck size={11} /> {t.active}
                          </span>
                        )}
                      </td>

                      {/* Присутствие */}
                      <td className="px-5 py-4">
                        {isOnline(row.last_seen_at) ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-emerald-200">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" />
                            {t.online}
                          </span>
                        ) : (
                          <p className="min-w-[150px] text-[11px] leading-5 text-zinc-500">
                            {row.last_seen_at ? `${t.lastSeen}: ${dateLabel(row.last_seen_at, locale, t.forever)}` : t.neverSeen}
                          </p>
                        )}
                      </td>

                      {/* Срок / причина */}
                      <td className="max-w-[250px] px-5 py-4">
                        <p className="text-xs text-zinc-300">
                          {!banned ? t.noLimits : row.ban_permanent ? t.forever : dateLabel(row.banned_until, locale, t.forever)}
                        </p>
                        {banned && (
                          <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-zinc-600" title={row.ban_reason ?? undefined}>
                            {row.ban_reason || t.noReason}
                          </p>
                        )}
                      </td>

                      {/* Действия */}
                      <td className="px-5 py-4">
                        {row.role === "owner" ? (
                          <span className="text-xs text-zinc-700">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {banned ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void unban(row)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 px-3 py-2 text-[10px] text-zinc-300 transition-colors hover:border-emerald-500/30 hover:text-emerald-200 disabled:opacity-40"
                              >
                                {busy ? <LoaderCircle size={12} className="animate-spin" /> : <UnlockKeyhole size={12} />} {t.liftBan}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openBan(row)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-950/15 px-3 py-2 text-[10px] text-rose-200/85 transition-colors hover:border-rose-400/40 hover:bg-rose-950/30 disabled:opacity-40"
                              >
                                <Ban size={12} /> {t.block}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void recoverAccess(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2 text-[10px] text-amber-100/85 transition-colors hover:border-amber-200/40 hover:bg-amber-200/[0.08] disabled:opacity-40"
                            >
                              <KeyRound size={12} /> {t.restoreAccess}
                            </button>
                            {busy && (
                              <span className="flex items-center text-zinc-600">
                                <LoaderCircle size={12} className="animate-spin" />
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Раскрывающаяся строка: локации карты */}
                    {expanded && (
                      <tr className="bg-black/15">
                        <td colSpan={6} className="px-5 py-5">
                          <div className="max-w-5xl">
                            <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
                              <MapPin size={13} /> {t.locationAssignments}
                            </div>
                            {!locationData.hubs.length ? (
                              <p className="text-xs text-zinc-600">{t.noLocations}</p>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {locationData.hubs.map((hub) => (
                                  <div key={hub.id} className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                                    <p className="text-xs font-medium text-zinc-200">{mapHubLabel(hub)}</p>
                                    <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-zinc-600">{hub.region || hub.id}</p>
                                    <div className="mt-3 space-y-2">
                                      {slotRolesFor(row.role).map((slot) => {
                                        const assignment = locationData.assignments.find(
                                          (item) => item.hub_id === hub.id && item.assignment_role === slot,
                                        );
                                        const assignedHere = assignment?.profile_id === row.id;
                                        const currentPerson = rows.find((person) => person.id === assignment?.profile_id);
                                        const slotKey = `${row.id}:${hub.id}:${slot}`;
                                        return (
                                          <div key={slot} className="flex items-center justify-between gap-2">
                                            <span className="min-w-0 text-[10px] text-zinc-500">
                                              {slot === "manager" ? t.roleManager : t.roleAdmin}
                                              {assignment && !assignedHere ? ` · ${currentPerson?.full_name || assignment.profile_id}` : ""}
                                            </span>
                                            {canTakeSlot(row.role, slot) && (
                                              <button
                                                type="button"
                                                disabled={locationWorking !== null}
                                                onClick={() => void changeStaffLocation(row, hub.id, slot)}
                                                className={`shrink-0 rounded-md border px-2 py-1.5 text-[9px] transition-colors disabled:opacity-40 ${
                                                  assignedHere
                                                    ? "border-amber-200/25 bg-amber-200/[0.06] text-amber-100"
                                                    : "border-zinc-700/70 text-zinc-400 hover:border-amber-200/25 hover:text-amber-100"
                                                }`}
                                              >
                                                {locationWorking === slotKey && <LoaderCircle size={11} className="inline animate-spin" />}
                                                {assignedHere ? t.unassign : t.assign}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-zinc-800/70 px-5 py-3 text-[10px] leading-5 text-zinc-600">{t.ownerNotice}</div>
      </section>

      {addStaffOpen && (
        <AddStaffModal
          labels={addStaffLabels}
          onClose={() => setAddStaffOpen(false)}
          onCreated={() => { void load(true); }}
        />
      )}

      {recovery && (
        <TelegramRecoveryLinkModal
          link={recovery.link}
          expiresAt={recovery.expiresAt}
          profileName={recovery.profileName}
          labels={recoveryLabels}
          onClose={() => setRecovery(null)}
        />
      )}

      {banTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeBan(); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-ban-title"
            className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-7"
          >
            <button
              type="button"
              onClick={closeBan}
              disabled={!!workingId}
              className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-40"
              aria-label={t.close}
            >
              <X size={17} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-950/25 text-rose-200">
              <UserCog size={18} />
            </div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-200/70">{t.modalTag}</p>
            <h2 id="staff-ban-title" className="mt-2 font-serif text-2xl text-zinc-50">{t.modalTitle}</h2>
            <p className="mt-2 text-sm text-zinc-500">{displayName(banTarget)}</p>

            <p className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{t.duration}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {BAN_DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value)}
                  aria-pressed={duration === value}
                  className={`rounded-xl border px-3 py-3 text-xs transition-colors ${
                    duration === value
                      ? "border-amber-200/35 bg-amber-200/[0.07] text-amber-100"
                      : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  {durationLabel(value, t)}
                </button>
              ))}
            </div>

            <label htmlFor="staff-ban-reason" className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t.reason}
            </label>
            <textarea
              id="staff-ban-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={4}
              placeholder={t.reasonPlaceholder}
              className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm leading-6 text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-amber-200/25"
            />
            <div className="mt-1 text-right text-[10px] text-zinc-700">{reason.length}/500</div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeBan}
                disabled={!!workingId}
                className="rounded-xl border border-zinc-800 px-4 py-3 text-xs text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void submitBan()}
                disabled={!reason.trim() || !!workingId}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-950/50 px-5 py-3 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {workingId ? <LoaderCircle size={14} className="animate-spin" /> : <Ban size={14} />} {t.confirmBan}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
