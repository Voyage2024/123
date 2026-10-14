"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  LoaderCircle,
  KeyRound,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from "lucide-react";
import {
  clearAccountBan,
  createTelegramRecoveryLink,
  getResidentRegistry,
  setAccountBan,
  type BanDuration,
  type ResidentRecord,
} from "@/app/actions/access-control";
import TelegramRecoveryLinkModal, { type RecoveryModalLabels } from "@/app/components/admin/TelegramRecoveryLinkModal";

type DatabaseText = {
  eyebrow: string; title: string; subtitle: string; countResidents: string; searchPlaceholder: string;
  clearSearch: string; staffOnly: string; close: string; openProfile: (name: string) => string;
  colResident: string; colContacts: string; colWallet: string; colSegment: string; colRanking: string; colKyc: string; colPresence: string; colAccess: string; colActions: string;
  loading: string; noResidents: string; noName: string; noLocation: string; noEmail: string; noWallet: string;
  points: string; reliability: string; online: string; lastSeen: (date: string) => string; neverSeen: string;
  blocked: string; active: string; forever: string; noReason: string; liftBan: string; ban: string; restoreAccess: string;
  page: (page: number, total: number, shown: number, count: number) => string; previous: string; next: string;
  banSuccess: string; unbanSuccess: string; recoveryCreated: string; confirmUnban: (name: string) => string;
  modalTag: string; banTitle: string; banDuration: string; d24: string; dWeek: string; dMonth: string; dForever: string;
  banReason: string; banReasonPlaceholder: string; cancel: string; confirmBan: string;
  operationFailed: string; recoveryLabels: RecoveryModalLabels;
  segmentElite: string; segmentWorking: string; circleDefault: string;
  statusLabels: Record<string, string>;
  locale: string;
};

const translations: Record<Lang, DatabaseText> = {
  EN: {
    eyebrow: 'God Mode · Private Registry', title: 'Full Database', subtitle: 'Private resident registry. Sensitive contact details are available only to club leadership.', countResidents: 'Residents in registry',
    searchPlaceholder: 'Name, email or Telegram ID…', clearSearch: 'Clear search', staffOnly: 'Owners / admins only', close: 'Close', openProfile: (name) => `Open profile for ${name}`,
    colResident: 'Resident', colContacts: 'Telegram / email', colWallet: 'USDT wallet', colSegment: 'Segment', colRanking: 'Ranking / reliability', colKyc: 'KYC', colPresence: 'Presence', colAccess: 'Access', colActions: 'Actions',
    loading: 'Loading registry…', noResidents: 'No residents found.', noName: 'Unnamed resident', noLocation: 'Location not provided', noEmail: 'Email not provided', noWallet: 'Not provided',
    points: 'pts', reliability: 'Reliability', online: 'Online', lastSeen: (date) => `Last seen: ${date}`, neverSeen: 'Never visited',
    blocked: 'Blocked', active: 'Active', forever: 'Forever', noReason: 'No reason provided', liftBan: 'Lift ban', ban: 'Ban', restoreAccess: 'Restore access',
    page: (page, total, shown, count) => `Page ${page} of ${total} · Showing ${shown} of ${count}`, previous: 'Previous', next: 'Next',
    banSuccess: 'The ban has been applied.', unbanSuccess: 'The ban has been lifted.', recoveryCreated: 'A one-time recovery link was created. It expires in 15 minutes.',
    confirmUnban: (name) => `Lift the ban for “${name}”?`, modalTag: 'Access control', banTitle: 'Ban resident', banDuration: 'Ban duration', d24: '24 hours', dWeek: '1 week', dMonth: '1 month', dForever: 'Forever',
    banReason: 'Reason for ban', banReasonPlaceholder: 'Describe the club rule violation…', cancel: 'Cancel', confirmBan: 'Confirm ban', operationFailed: 'The operation failed. Please try again.',
    recoveryLabels: { title: 'Restore Telegram access', description: 'Send this one-time link to the user through a verified channel. It expires in 15 minutes.', expires: 'Link expires at', copy: 'Copy recovery link', copied: 'Link copied', close: 'Close' },    segmentElite: 'Elite', segmentWorking: 'Working', circleDefault: 'Voyager',
    statusLabels: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', submitted: 'Submitted', under_review: 'Under review', in_review: 'In review', active: 'Active', banned: 'Blocked', blocked: 'Blocked', inactive: 'Inactive', draft: 'Draft', verified: 'Verified', passed: 'Passed', completed: 'Completed', declined: 'Declined', suspended: 'Suspended' }, locale: 'en-GB',
  },
  RU: {
    eyebrow: 'God Mode · Закрытый реестр', title: 'Полная база', subtitle: 'Закрытый реестр резиденток. Чувствительные контактные данные доступны только руководству клуба.', countResidents: 'Резиденток в реестре',
    searchPlaceholder: 'Имя, email или Telegram ID…', clearSearch: 'Очистить поиск', staffOnly: 'Только владелец и администраторы', close: 'Закрыть', openProfile: (name) => `Открыть профиль ${name}`,
    colResident: 'Резидентка', colContacts: 'Telegram / email', colWallet: 'Кошелёк USDT', colSegment: 'Сегмент', colRanking: 'Рейтинг / надёжность', colKyc: 'KYC', colPresence: 'Присутствие', colAccess: 'Доступ', colActions: 'Действия',
    loading: 'Загрузка реестра…', noResidents: 'Резиденты не найдены.', noName: 'Без имени', noLocation: 'Локация не указана', noEmail: 'Email не указан', noWallet: 'Не указано',
    points: 'балл.', reliability: 'Надёжность', online: 'Онлайн', lastSeen: (date) => `Был(а) в сети: ${date}`, neverSeen: 'Ещё не заходил(а)',
    blocked: 'Заблокирован', active: 'Активен', forever: 'Навсегда', noReason: 'Без причины', liftBan: 'Снять бан', ban: 'Бан', restoreAccess: 'Восстановить доступ',
    page: (page, total, shown, count) => `Страница ${page} из ${total} · Показано ${shown} из ${count}`, previous: 'Назад', next: 'Далее',
    banSuccess: 'Блокировка установлена.', unbanSuccess: 'Блокировка снята.', recoveryCreated: 'Одноразовая ссылка восстановления создана; она действует 15 минут.',
    confirmUnban: (name) => `Снять блокировку с профиля «${name}»?`, modalTag: 'Контроль доступа', banTitle: 'Заблокировать резидентку', banDuration: 'Срок блокировки', d24: '24 часа', dWeek: '1 неделя', dMonth: '1 месяц', dForever: 'Навсегда',
    banReason: 'Причина блокировки', banReasonPlaceholder: 'Опишите нарушение правил клуба…', cancel: 'Отмена', confirmBan: 'Подтвердить бан', operationFailed: 'Не удалось выполнить операцию. Повторите попытку.',
    recoveryLabels: { title: 'Восстановление доступа Telegram', description: 'Передайте эту одноразовую ссылку пользователю по проверенному каналу. Она действует 15 минут.', expires: 'Ссылка действует до', copy: 'Скопировать ссылку', copied: 'Ссылка скопирована', close: 'Закрыть' },
    segmentElite: 'Elite', segmentWorking: 'Рабочий', circleDefault: 'Voyager',
    statusLabels: { pending: 'Ожидает', approved: 'Одобрено', rejected: 'Отклонено', submitted: 'Отправлено', under_review: 'На проверке', in_review: 'На проверке', active: 'Активен', banned: 'Заблокирован', blocked: 'Заблокирован', inactive: 'Неактивен', draft: 'Черновик', verified: 'Подтверждён', passed: 'Пройден', completed: 'Завершён', declined: 'Отклонён', suspended: 'Приостановлен' }, locale: 'ru-RU',
  },
  ES: {
    eyebrow: 'God Mode · Registro privado', title: 'Base de datos', subtitle: 'Registro privado de residentes. Solo la dirección del club puede ver los datos de contacto confidenciales.', countResidents: 'Residentes en el registro',
    searchPlaceholder: 'Nombre, email o ID de Telegram…', clearSearch: 'Borrar búsqueda', staffOnly: 'Solo propietario y administradores', close: 'Cerrar', openProfile: (name) => `Abrir perfil de ${name}`,
    colResident: 'Residente', colContacts: 'Telegram / email', colWallet: 'Cartera USDT', colSegment: 'Segmento', colRanking: 'Ranking / fiabilidad', colKyc: 'KYC', colPresence: 'Presencia', colAccess: 'Acceso', colActions: 'Acciones',
    loading: 'Cargando registro…', noResidents: 'No se encontraron residentes.', noName: 'Residente sin nombre', noLocation: 'Ubicación no indicada', noEmail: 'Email no indicado', noWallet: 'No indicado',
    points: 'pts', reliability: 'Fiabilidad', online: 'En línea', lastSeen: (date) => `Última visita: ${date}`, neverSeen: 'Sin visitas',
    blocked: 'Bloqueado', active: 'Activo', forever: 'Indefinido', noReason: 'Motivo no indicado', liftBan: 'Retirar bloqueo', ban: 'Bloquear', restoreAccess: 'Restaurar acceso',
    page: (page, total, shown, count) => `Página ${page} de ${total} · Mostrando ${shown} de ${count}`, previous: 'Anterior', next: 'Siguiente',
    banSuccess: 'Se ha aplicado el bloqueo.', unbanSuccess: 'Se ha retirado el bloqueo.', recoveryCreated: 'Se creó un enlace de recuperación de un solo uso. Caduca en 15 minutos.',
    confirmUnban: (name) => `¿Retirar el bloqueo de «${name}»?`, modalTag: 'Control de acceso', banTitle: 'Bloquear residente', banDuration: 'Duración del bloqueo', d24: '24 horas', dWeek: '1 semana', dMonth: '1 mes', dForever: 'Indefinido',
    banReason: 'Motivo del bloqueo', banReasonPlaceholder: 'Describe la infracción de las normas del club…', cancel: 'Cancelar', confirmBan: 'Confirmar bloqueo', operationFailed: 'No se pudo completar la operación. Inténtalo de nuevo.',
    recoveryLabels: { title: 'Restaurar acceso a Telegram', description: 'Envía este enlace de un solo uso al usuario por un canal verificado. Caduca en 15 minutos.', expires: 'El enlace caduca', copy: 'Copiar enlace de recuperación', copied: 'Enlace copiado', close: 'Cerrar' },
    segmentElite: 'Elite', segmentWorking: 'Trabajo', circleDefault: 'Voyager',
    statusLabels: { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', submitted: 'Enviado', under_review: 'En revisión', in_review: 'En revisión', active: 'Activo', banned: 'Bloqueado', blocked: 'Bloqueado', inactive: 'Inactivo', draft: 'Borrador', verified: 'Verificado', passed: 'Superado', completed: 'Completado', declined: 'Rechazado', suspended: 'Suspendido' }, locale: 'es-ES',
  },
  PT: {
    eyebrow: 'God Mode · Registro privado', title: 'Banco de dados', subtitle: 'Registro privado de residentes. Os dados de contato confidenciais estão disponíveis apenas para a direção do clube.', countResidents: 'Residentes no registro',
    searchPlaceholder: 'Nome, email ou ID do Telegram…', clearSearch: 'Limpar busca', staffOnly: 'Somente proprietário e administradores', close: 'Fechar', openProfile: (name) => `Abrir perfil de ${name}`,
    colResident: 'Residente', colContacts: 'Telegram / email', colWallet: 'Carteira USDT', colSegment: 'Segmento', colRanking: 'Ranking / confiabilidade', colKyc: 'KYC', colPresence: 'Presença', colAccess: 'Acesso', colActions: 'Ações',
    loading: 'Carregando registro…', noResidents: 'Nenhum residente encontrado.', noName: 'Residente sem nome', noLocation: 'Localização não informada', noEmail: 'Email não informado', noWallet: 'Não informado',
    points: 'pts', reliability: 'Confiabilidade', online: 'Online', lastSeen: (date) => `Última visita: ${date}`, neverSeen: 'Sem visitas',
    blocked: 'Bloqueado', active: 'Ativo', forever: 'Permanente', noReason: 'Motivo não informado', liftBan: 'Remover bloqueio', ban: 'Bloquear', restoreAccess: 'Restaurar acesso',
    page: (page, total, shown, count) => `Página ${page} de ${total} · Exibindo ${shown} de ${count}`, previous: 'Anterior', next: 'Próxima',
    banSuccess: 'O bloqueio foi aplicado.', unbanSuccess: 'O bloqueio foi removido.', recoveryCreated: 'Um link de recuperação de uso único foi criado. Expira em 15 minutos.',
    confirmUnban: (name) => `Remover o bloqueio de “${name}”?`, modalTag: 'Controle de acesso', banTitle: 'Bloquear residente', banDuration: 'Duração do bloqueio', d24: '24 horas', dWeek: '1 semana', dMonth: '1 mês', dForever: 'Permanente',
    banReason: 'Motivo do bloqueio', banReasonPlaceholder: 'Descreva a violação das regras do clube…', cancel: 'Cancelar', confirmBan: 'Confirmar bloqueio', operationFailed: 'Não foi possível concluir a operação. Tente novamente.',
    recoveryLabels: { title: 'Restaurar acesso ao Telegram', description: 'Envie este link de uso único ao usuário por um canal verificado. Expira em 15 minutos.', expires: 'O link expira em', copy: 'Copiar link de recuperação', copied: 'Link copiado', close: 'Fechar' },
    segmentElite: 'Elite', segmentWorking: 'Trabalho', circleDefault: 'Voyager',
    statusLabels: { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', submitted: 'Enviado', under_review: 'Em análise', in_review: 'Em análise', active: 'Ativo', banned: 'Bloqueado', blocked: 'Bloqueado', inactive: 'Inativo', draft: 'Rascunho', verified: 'Verificado', passed: 'Concluído', completed: 'Concluído', declined: 'Rejeitado', suspended: 'Suspenso' }, locale: 'pt-BR',
  },
};

const PAGE_SIZE = 50;
function banActive(row: ResidentRecord) {
  if (row.ban_permanent || row.banned_until === "infinity") return true;
  if (!row.banned_until) return false;
  const until = Date.parse(row.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

function isOnline(lastSeenAt: string | null) {
  if (!lastSeenAt) return false;
  const timestamp = Date.parse(lastSeenAt);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -60_000 && age < 5 * 60 * 1000;
}

function dateLabel(value: string | null, t: DatabaseText) {
  if (!value || value === "infinity") return value === "infinity" ? t.forever : "—";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString(t.locale, { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

function statusLabel(value: string | null, t: DatabaseText) {
  if (!value) return "—";
  const key = value.toLowerCase().replaceAll(" ", "_");
  return t.statusLabels[key] ?? value.replaceAll("_", " ");
}

export default function FullDatabasePage() {
  const { lang } = useLanguage();
  const t = translations[lang] ?? translations.EN;
  const durationOptions: { value: BanDuration; label: string }[] = [
    { value: "24_hours", label: t.d24 },
    { value: "1_week", label: t.dWeek },
    { value: "1_month", label: t.dMonth },
    { value: "forever", label: t.dForever },
  ];
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
  const [recovery, setRecovery] = useState<{ link: string; expiresAt: string; profileName: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const result = await getResidentRegistry(page, search);
    if (!result.ok) {
      setError(t.operationFailed);
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

  // Refresh presence data while the admin leaves the registry open, without flashing the table.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const submitBan = async () => {
    if (!banTarget) return;
    setWorking(true);
    setError(null);
    const result = await setAccountBan(banTarget.id, duration, reason);
    if (!result.ok) {
      setError(t.operationFailed);
    } else {
      setNotice(t.banSuccess);
      setBanTarget(null);
      setReason("");
      await load();
    }
    setWorking(false);
  };

  const unban = async (row: ResidentRecord) => {
    const accepted = window.confirm(t.confirmUnban(row.full_name || row.name || row.id));
    if (!accepted) return;
    setWorking(true);
    setError(null);
    const result = await clearAccountBan(row.id);
    if (!result.ok) setError(t.operationFailed);
    else {
      setNotice(t.unbanSuccess);
      await load();
    }
    setWorking(false);
  };

  const recoverAccess = async (row: ResidentRecord) => {
    setWorking(true);
    setError(null);
    const result = await createTelegramRecoveryLink(row.id);
    if (!result.ok) {
      setError(t.operationFailed);
    } else {
      setRecovery({ link: result.link, expiresAt: result.expiresAt, profileName: result.profileName });
      setNotice(t.recoveryCreated);
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
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{t.subtitle}</p>
          </div>
          <div className="rounded-xl border border-zinc-700/70 bg-black/20 px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-600">{t.countResidents}</p>
            <p className="mt-1 font-serif text-2xl tabular-nums text-zinc-100">{count.toLocaleString(t.locale)}</p>
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
        <div className="flex items-center gap-2 text-xs text-zinc-600"><ShieldCheck size={14} className="text-amber-100/55" /> {t.staffOnly}</div>
      </div>

      {notice && <div className="flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200/90"><span className="flex items-center gap-2"><Check size={14} />{notice}</span><button onClick={() => setNotice(null)} aria-label={t.close}><X size={14} /></button></div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1420px] border-collapse text-left">
            <thead className="bg-black/20">
              <tr className="border-b border-zinc-800/80 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                <th className="px-4 py-4">{t.colResident}</th>
                <th className="px-4 py-4">{t.colContacts}</th>
                <th className="px-4 py-4">{t.colWallet}</th>
                <th className="px-4 py-4">{t.colSegment}</th>
                <th className="px-4 py-4">{t.colRanking}</th>
                <th className="px-4 py-4">{t.colKyc}</th>
                <th className="px-4 py-4">{t.colPresence}</th>
                <th className="px-4 py-4">{t.colAccess}</th>
                <th className="px-4 py-4">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-zinc-500"><LoaderCircle size={18} className="mr-2 inline animate-spin text-amber-100/70" />{t.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-sm text-zinc-500">{t.noResidents}</td></tr>
              ) : rows.map((row) => {
                const active = banActive(row);
                return (
                  <tr key={row.id} className="align-top transition-colors hover:bg-white/[0.015]">
                    <td className="max-w-[270px] px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {row.resolved_avatar_url ? <Link href={`/admin/database/${row.id}`} aria-label={t.openProfile(row.full_name || row.name || row.id)} className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50"><img src={row.resolved_avatar_url} alt="" className="h-10 w-10 rounded-full border border-amber-200/20 object-cover transition-opacity hover:opacity-80" /></Link> : <Link href={`/admin/database/${row.id}`} aria-label={t.openProfile(row.full_name || row.name || row.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-medium text-amber-100/75 transition-colors hover:border-amber-200/35">{(row.full_name?.trim() || row.name?.trim() || "?").slice(0, 1).toUpperCase()}</Link>}
                        <div className="min-w-0">
                          <Link href={`/admin/database/${row.id}`} className="block truncate text-sm font-medium text-zinc-200 transition-colors hover:text-amber-100">{row.full_name?.trim() || row.name?.trim() || t.noName}</Link>
                          <p className="mt-1 font-mono text-[10px] text-zinc-700" title={row.id}>{row.id.slice(0, 8)}…</p>
                          <p className="mt-1 text-[10px] text-zinc-600">{row.location || t.noLocation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-4">
                      <p className="truncate text-xs text-zinc-300" title={row.telegram_id ?? undefined}>{row.telegram_id || "—"}</p>
                      <p className="mt-1 truncate text-[11px] text-zinc-600" title={row.email ?? undefined}>{row.email || t.noEmail}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-4"><p className="break-all font-mono text-[10px] leading-5 text-zinc-400" title={row.usdt_wallet ?? undefined}>{row.usdt_wallet || t.noWallet}</p></td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] ${row.segment === "elite" ? "border-amber-200/25 bg-amber-200/[0.07] text-amber-100" : "border-zinc-700/70 bg-zinc-800/50 text-zinc-400"}`}>{row.segment === "elite" ? t.segmentElite : row.segment === "working" ? t.segmentWorking : row.segment || t.segmentWorking}</span>
                      <p className="mt-2 text-[10px] text-zinc-600">{row.circle || t.circleDefault}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm tabular-nums text-zinc-200">{row.influence_index ?? row.tour_points ?? 0} <span className="text-[10px] text-zinc-600">{t.points}</span></p>
                      <p className="mt-1 text-[11px] tabular-nums text-zinc-500">{t.reliability} {Number(row.reliability ?? 100).toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-4"><span className="text-xs tabular-nums text-zinc-300">{row.kyc_level ?? 0}/3</span><p className="mt-1 text-[10px] text-zinc-600">{statusLabel(row.status, t)}</p></td>
                    <td className="px-4 py-4">{isOnline(row.last_seen_at) ? <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" />{t.online}</span> : <p className="min-w-[145px] text-[11px] leading-5 text-zinc-500">{row.last_seen_at ? t.lastSeen(dateLabel(row.last_seen_at, t)) : t.neverSeen}</p>}</td>
                    <td className="max-w-[200px] px-4 py-4">
                      {active ? <><span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/30 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-rose-200"><Ban size={11} /> {t.blocked}</span><p className="mt-2 text-[10px] text-zinc-500">{row.ban_permanent ? t.forever : dateLabel(row.banned_until, t)}</p><p className="mt-1 line-clamp-2 text-[10px] text-zinc-600" title={row.ban_reason ?? undefined}>{row.ban_reason || t.noReason}</p></> : <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-emerald-200/80"><Check size={11} /> {t.active}</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {active ? <button disabled={working} onClick={() => void unban(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 px-3 py-2 text-[10px] text-zinc-300 transition-all hover:border-emerald-500/30 hover:text-emerald-200 disabled:opacity-50"><UnlockKeyhole size={12} /> {t.liftBan}</button> : <button disabled={working} onClick={() => { setBanTarget(row); setDuration("24_hours"); setReason(""); setError(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-950/15 px-3 py-2 text-[10px] text-rose-200/85 transition-all hover:border-rose-400/40 hover:bg-rose-950/30 disabled:opacity-50"><Ban size={12} /> {t.ban}</button>}
                        <button type="button" disabled={working} onClick={() => void recoverAccess(row)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2 text-[10px] text-amber-100/85 transition-colors hover:border-amber-200/40 hover:bg-amber-200/[0.08] disabled:opacity-40"><KeyRound size={12} /> {t.restoreAccess}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-zinc-800/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] tracking-wide text-zinc-600">{t.page(page + 1, totalPages, rows.length, count)}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-30"><ChevronLeft size={14} /> {t.previous}</button>
            <button type="button" disabled={(page + 1) * PAGE_SIZE >= count || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-30">{t.next} <ChevronRight size={14} /></button>
          </div>
        </footer>
      </section>

      {recovery && <TelegramRecoveryLinkModal link={recovery.link} expiresAt={recovery.expiresAt} profileName={recovery.profileName} labels={t.recoveryLabels} onClose={() => setRecovery(null)} />}

      {banTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setBanTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ban-modal-title" className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 p-6 shadow-2xl shadow-black/60 sm:p-7">
            <button type="button" onClick={() => setBanTarget(null)} disabled={working} className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 disabled:opacity-40" aria-label={t.close}><X size={17} /></button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-950/25 text-rose-200"><Ban size={18} /></div>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-200/70">{t.modalTag}</p>
            <h2 id="ban-modal-title" className="mt-2 font-serif text-2xl text-zinc-50">{t.banTitle}</h2>
            <p className="mt-2 text-sm text-zinc-500">{banTarget.full_name || banTarget.name || banTarget.id}</p>

            <label className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{t.banDuration}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {durationOptions.map((option) => <button type="button" key={option.value} onClick={() => setDuration(option.value)} className={`rounded-xl border px-3 py-3 text-xs transition-colors ${duration === option.value ? "border-amber-200/35 bg-amber-200/[0.07] text-amber-100" : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"}`}>{option.label}</button>)}
            </div>

            <label htmlFor="ban-reason" className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{t.banReason}</label>
            <textarea id="ban-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder={t.banReasonPlaceholder} className="mt-2 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm leading-6 text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-amber-200/25" />
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
