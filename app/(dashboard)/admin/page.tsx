"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Database,
  Fingerprint,
  KeyRound,
  MapPinned,
  ShieldCheck,
  Users,
  WalletCards,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";


type Dict = Record<string, string>;
type StaffRole = "owner" | "admin" | "manager";
type QueueProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  kyc_level: number | null;
  created_at: string | null;
};
type Counts = { profiles: number | null; residents: number | null; tours: number | null; kyc: number | null };

const T: Record<Lang, Dict> = {
  EN: {
    owner: "Owner", admin: "Administrator", manager: "Manager", greeting: "Welcome, {name}. Review club performance and access key controls.",
    ownerEyebrow: "Founder access · Level 01", commandCenter: "Command Center", systemOverview: "System overview", clubIntelligence: "Club intelligence", platformOverview: "Platform overview", supabaseData: "Live Supabase data",
    totalProfiles: "Total profiles", allAccounts: "All platform accounts", residents: "Residents", residentAccounts: "Accounts with resident role", activeTours: "Active tours", visibleTours: "Not hidden or deleted", pendingKyc: "Pending KYC", verificationBelow: "Verification level below 3", metricsError: "Some metrics could not be loaded. Check Supabase access policies for profiles and tours.",
    governance: "Governance", clubManagement: "Club management", roleAccess: "Roles & access", roleDescription: "Staff, role changes, temporary and permanent bans.", fullDatabase: "Full database", databaseDescription: "Private resident registry and sensitive contact information.", faceControl: "Face Control", faceDescription: "Verification, profile review and access moderation.", toursParties: "Tours & events", eventsDescription: "Schedule and manage global events.", gamification: "Gamification", gamificationDescription: "Influence Index, club levels, stamps and achievements.", operationsSummary: "Operations overview", operationsDescription: "Recent approvals, applications and upcoming events.",
    verificationQueue: "Verification queue", awaitingVerification: "Awaiting verification", openFaceControl: "Open Face Control", noName: "Unnamed resident", noQueue: "No residents match the selected criteria, or the data is unavailable.",
    operationsEyebrow: "Operations · Admin", operationsPanel: "Operations dashboard", operationsIntro: "{name}, here are the profiles awaiting review and shortcuts to moderation.", reviewProfiles: "Review profiles, documents and access decisions.", searchResidents: "Search residents and manage account access.", applications: "Applications", applicationsDescription: "Review tour and destination requests.", kycModeration: "KYC moderation", profilesUnderReview: "Profiles under review", check: "Review", kycLoadError: "Unable to load the KYC queue. Check the profiles read policy.", emptyQueue: "The review queue is empty.",
    managerEyebrow: "Manager workspace", managerPanel: "Operations workspace", managerIntro: "{name}, choose a destination, application or current operational task.", tourApplications: "Tour applications", tourApplicationsDescription: "Process requests for destinations assigned to you.", myLocations: "My locations", locationsDescription: "Open your assigned destinations and related tasks.",
    loading: "Loading dashboard…", profileCheckError: "Unable to verify your profile.", noAccess: "You do not have access to this page.", status_pending: "Pending", status_approved: "Approved", status_rejected: "Rejected", status_under_review: "Under review", status_submitted: "Submitted", status_draft: "Draft",
  },
  RU: {
    owner: "Владелец", admin: "Администратор", manager: "Менеджер", greeting: "Добро пожаловать, {name}. Здесь собраны состояние клуба и ключевые точки управления.",
    ownerEyebrow: "Доступ основателя · Уровень 01", commandCenter: "Командный центр", systemOverview: "Обзор системы", clubIntelligence: "Аналитика клуба", platformOverview: "Обзор платформы", supabaseData: "Актуальные данные Supabase",
    totalProfiles: "Всего профилей", allAccounts: "Все учётные записи платформы", residents: "Резидентки", residentAccounts: "Профили с ролью resident", activeTours: "Активные туры", visibleTours: "Не скрыты и не удалены", pendingKyc: "Ожидают KYC", verificationBelow: "Уровень верификации ниже 3", metricsError: "Не все метрики удалось загрузить. Проверьте права Supabase/RLS для профилей и туров.",
    governance: "Управление", clubManagement: "Управление клубом", roleAccess: "Роли и доступ", roleDescription: "Персонал, смена ролей, временные и постоянные баны.", fullDatabase: "Полная база", databaseDescription: "Приватный реестр резиденток и доступ к чувствительным данным.", faceControl: "Face Control", faceDescription: "Верификация, проверка анкет и модерация доступа.", toursParties: "Туры и тусовки", eventsDescription: "Расписание и управление глобальными мероприятиями.", gamification: "Геймификация", gamificationDescription: "Индекс влияния, уровни клуба, штампы и достижения.", operationsSummary: "Операционная сводка", operationsDescription: "Недавние одобрения, заявки и предстоящие мероприятия.",
    verificationQueue: "Очередь верификации", awaitingVerification: "Ожидают верификацию", openFaceControl: "Открыть Face Control", noName: "Без имени", noQueue: "Нет резиденток в очереди по выбранному критерию или данные недоступны.",
    operationsEyebrow: "Операции · Администратор", operationsPanel: "Операционная панель", operationsIntro: "{name}, здесь собраны анкеты на проверке и быстрые переходы к модерации.", reviewProfiles: "Проверка анкет, документов и решений по доступу.", searchResidents: "Поиск резиденток и управление доступом.", applications: "Заявки", applicationsDescription: "Модерация запросов на туры и рабочие направления.", kycModeration: "Модерация KYC", profilesUnderReview: "Анкеты на проверке", check: "Проверить", kycLoadError: "Не удалось загрузить очередь KYC. Проверьте политику чтения profiles.", emptyQueue: "Очередь пуста.",
    managerEyebrow: "Рабочее пространство менеджера", managerPanel: "Рабочая панель", managerIntro: "{name}, выберите направление, заявку или текущую операционную задачу.", tourApplications: "Заявки на туры", tourApplicationsDescription: "Обрабатывайте запросы в доступных вам направлениях.", myLocations: "Мои локации", locationsDescription: "Откройте назначенные направления и связанные задачи.",
    loading: "Загрузка панели…", profileCheckError: "Не удалось проверить профиль.", noAccess: "У вас нет доступа к этой странице.", status_pending: "Ожидает", status_approved: "Одобрено", status_rejected: "Отклонено", status_under_review: "На проверке", status_submitted: "Отправлено", status_draft: "Черновик",
  },
  ES: {
    owner: "Propietario", admin: "Administrador", manager: "Gerente", greeting: "Te damos la bienvenida, {name}. Consulta el estado del club y sus controles principales.",
    ownerEyebrow: "Acceso fundador · Nivel 01", commandCenter: "Centro de mando", systemOverview: "Resumen del sistema", clubIntelligence: "Inteligencia del club", platformOverview: "Resumen de la plataforma", supabaseData: "Datos actuales de Supabase",
    totalProfiles: "Perfiles totales", allAccounts: "Todas las cuentas de la plataforma", residents: "Residentes", residentAccounts: "Cuentas con rol de residente", activeTours: "Tours activos", visibleTours: "No ocultos ni eliminados", pendingKyc: "KYC pendiente", verificationBelow: "Nivel de verificación inferior a 3", metricsError: "No se pudieron cargar algunas métricas. Comprueba las políticas de acceso de Supabase para perfiles y tours.",
    governance: "Gobernanza", clubManagement: "Gestión del club", roleAccess: "Roles y acceso", roleDescription: "Personal, cambios de rol y bloqueos temporales o permanentes.", fullDatabase: "Base de datos completa", databaseDescription: "Registro privado de residentes y datos de contacto sensibles.", faceControl: "Face Control", faceDescription: "Verificación, revisión de perfiles y moderación de acceso.", toursParties: "Tours y eventos", eventsDescription: "Calendario y gestión de eventos globales.", gamification: "Gamificación", gamificationDescription: "Índice de influencia, niveles del club, sellos y logros.", operationsSummary: "Resumen operativo", operationsDescription: "Aprobaciones recientes, solicitudes y próximos eventos.",
    verificationQueue: "Cola de verificación", awaitingVerification: "Pendientes de verificación", openFaceControl: "Abrir Face Control", noName: "Residente sin nombre", noQueue: "No hay residentes que coincidan con los criterios o los datos no están disponibles.",
    operationsEyebrow: "Operaciones · Admin", operationsPanel: "Panel operativo", operationsIntro: "{name}, aquí tienes los perfiles pendientes de revisión y accesos rápidos a la moderación.", reviewProfiles: "Revisar perfiles, documentos y decisiones de acceso.", searchResidents: "Buscar residentes y administrar el acceso a las cuentas.", applications: "Solicitudes", applicationsDescription: "Moderar solicitudes de tours y destinos de trabajo.", kycModeration: "Moderación KYC", profilesUnderReview: "Perfiles en revisión", check: "Revisar", kycLoadError: "No se pudo cargar la cola KYC. Comprueba la política de lectura de profiles.", emptyQueue: "La cola de revisión está vacía.",
    managerEyebrow: "Espacio del gerente", managerPanel: "Espacio operativo", managerIntro: "{name}, elige un destino, una solicitud o una tarea operativa.", tourApplications: "Solicitudes de tours", tourApplicationsDescription: "Gestiona solicitudes de destinos asignados.", myLocations: "Mis ubicaciones", locationsDescription: "Abre los destinos asignados y las tareas relacionadas.",
    loading: "Cargando panel…", profileCheckError: "No se pudo verificar tu perfil.", noAccess: "No tienes acceso a esta página.", status_pending: "Pendiente", status_approved: "Aprobado", status_rejected: "Rechazado", status_under_review: "En revisión", status_submitted: "Enviado", status_draft: "Borrador",
  },
  PT: {
    owner: "Proprietário", admin: "Administrador", manager: "Gerente", greeting: "Boas-vindas, {name}. Consulte o estado do clube e os principais controles.",
    ownerEyebrow: "Acesso do fundador · Nível 01", commandCenter: "Centro de comando", systemOverview: "Visão geral do sistema", clubIntelligence: "Inteligência do clube", platformOverview: "Visão geral da plataforma", supabaseData: "Dados atuais do Supabase",
    totalProfiles: "Total de perfis", allAccounts: "Todas as contas da plataforma", residents: "Residentes", residentAccounts: "Contas com função de residente", activeTours: "Tours ativos", visibleTours: "Não ocultos nem excluídos", pendingKyc: "KYC pendente", verificationBelow: "Nível de verificação abaixo de 3", metricsError: "Não foi possível carregar algumas métricas. Verifique as políticas de acesso do Supabase para perfis e tours.",
    governance: "Governança", clubManagement: "Gestão do clube", roleAccess: "Funções e acesso", roleDescription: "Equipe, alteração de funções e bloqueios temporários ou permanentes.", fullDatabase: "Base de dados completa", databaseDescription: "Registro privado de residentes e dados de contato confidenciais.", faceControl: "Face Control", faceDescription: "Verificação, análise de perfis e moderação de acesso.", toursParties: "Tours e eventos", eventsDescription: "Agenda e gestão de eventos globais.", gamification: "Gamificação", gamificationDescription: "Índice de influência, níveis do clube, carimbos e conquistas.", operationsSummary: "Resumo operacional", operationsDescription: "Aprovações recentes, solicitações e próximos eventos.",
    verificationQueue: "Fila de verificação", awaitingVerification: "Aguardando verificação", openFaceControl: "Abrir Face Control", noName: "Residente sem nome", noQueue: "Nenhum residente corresponde aos critérios ou os dados estão indisponíveis.",
    operationsEyebrow: "Operações · Admin", operationsPanel: "Painel operacional", operationsIntro: "{name}, aqui estão os perfis que aguardam análise e atalhos para a moderação.", reviewProfiles: "Revisar perfis, documentos e decisões de acesso.", searchResidents: "Buscar residentes e gerenciar o acesso às contas.", applications: "Solicitações", applicationsDescription: "Moderar solicitações de tours e destinos de trabalho.", kycModeration: "Moderação KYC", profilesUnderReview: "Perfis em análise", check: "Revisar", kycLoadError: "Não foi possível carregar a fila KYC. Verifique a política de leitura de profiles.", emptyQueue: "A fila de revisão está vazia.",
    managerEyebrow: "Espaço do gerente", managerPanel: "Espaço operacional", managerIntro: "{name}, escolha um destino, uma solicitação ou uma tarefa operacional.", tourApplications: "Solicitações de tours", tourApplicationsDescription: "Processe solicitações dos destinos atribuídos a você.", myLocations: "Minhas localizações", locationsDescription: "Abra seus destinos atribuídos e as tarefas relacionadas.",
    loading: "Carregando painel…", profileCheckError: "Não foi possível verificar seu perfil.", noAccess: "Você não tem acesso a esta página.", status_pending: "Pendente", status_approved: "Aprovado", status_rejected: "Rejeitado", status_under_review: "Em análise", status_submitted: "Enviado", status_draft: "Rascunho",
  },
};


function PanelCard({ title, value, detail, icon: Icon }: { title: string; value: number | string; detail: string; icon: LucideIcon }) {
  return <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/45 p-5 backdrop-blur-xl transition-all duration-300 hover:border-amber-200/20 hover:bg-zinc-900/70"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-200/[0.035] blur-2xl transition-colors group-hover:bg-amber-200/[0.07]" /><div className="relative flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-zinc-500">{title}</p><p className="mt-4 font-serif text-4xl font-medium tabular-nums tracking-tight text-zinc-50">{value}</p><p className="mt-2 text-xs text-zinc-500">{detail}</p></div><div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.045] p-3 text-amber-100/80"><Icon size={18} strokeWidth={1.5} /></div></div></div>;
}

function ActionCard({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: LucideIcon }) {
  return <Link href={href} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/35 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-200/25 hover:bg-zinc-900/60"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.04] text-amber-100/80 transition-colors group-hover:bg-amber-200/[0.09]"><Icon size={19} strokeWidth={1.5} /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-100">{title}<ArrowUpRight size={15} className="text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-200" /></span><span className="mt-2 block text-xs leading-5 text-zinc-500">{description}</span></span></Link>;
}

export default function AdminHomePage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [greeting, setGreeting] = useState("");
  const [counts, setCounts] = useState<Counts>({ profiles: null, residents: null, tours: null, kyc: null });
  const [queue, setQueue] = useState<QueueProfile[]>([]);
  const [metricsError, setMetricsError] = useState(false);
  const [queueError, setQueueError] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { router.replace("/login"); return; }

    const { data: profile, error: profileError } = await supabase.from("profiles").select("role, full_name").eq("id", authData.user.id).maybeSingle();
    if (profileError || !profile) { router.replace("/login?error=profile_check"); return; }
    const currentRole = String(profile.role) as StaffRole;
    if (!["owner", "admin", "manager"].includes(currentRole)) { router.replace("/dashboard"); return; }
    setRole(currentRole);
    setGreeting(profile.full_name?.trim() || "");

    const pendingQuery = () => supabase.from("profiles").select("id, full_name, email, status, kyc_level, created_at", { count: "exact" }).eq("role", "resident").lt("kyc_level", 3).order("created_at", { ascending: false }).limit(currentRole === "owner" ? 6 : 20);
    if (currentRole === "owner") {
      const [allProfiles, residents, tours, pending] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "resident"),
        supabase.from("tours").select("id", { count: "exact", head: true }).is("deleted_at", null).neq("visibility", "hidden"),
        pendingQuery(),
      ]);
      setCounts({ profiles: allProfiles.count, residents: residents.count, tours: tours.count, kyc: pending.count ?? pending.data?.length ?? 0 });
      setQueue((pending.data ?? []) as QueueProfile[]);
      setMetricsError(Boolean(allProfiles.error || residents.error || tours.error));
      setQueueError(Boolean(pending.error));
    } else if (currentRole === "admin") {
      const pending = await pendingQuery();
      setQueue((pending.data ?? []) as QueueProfile[]);
      setQueueError(Boolean(pending.error));
    }
    setLoading(false);
  }, [router]);

  // The loader owns loading/data state for this async query lifecycle.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const greetingName = greeting || (role ? t[role] : "");

  const statusLabel = (status: string | null) => {
    if (!status) return "—";
    const key = `status_${status.toLowerCase()}`;
    return t[key] ?? status.replaceAll("_", " ");
  };

  if (loading) return <div className="flex min-h-[45vh] items-center justify-center gap-3 text-sm text-zinc-500"><LoaderCircle size={17} className="animate-spin text-amber-200/70" />{t.loading}</div>;
  if (!role) return <div role="alert" className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-5 text-sm text-rose-200">{t.profileCheckError}</div>;

  if (role === "owner") return <div className="space-y-9 pb-10">
    <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/55 to-zinc-950 p-7 sm:p-10"><div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-amber-200/[0.06] blur-[100px]" /><div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" /><div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-100/65"><ShieldCheck size={13} />{t.ownerEyebrow}</p><h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">{t.commandCenter}</h1><p className="mt-3 text-sm text-zinc-400">{t.greeting.replace("{name}", greetingName)}</p></div><div className="flex w-fit items-center gap-2 rounded-full border border-amber-200/15 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-amber-100/75"><span className="h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,.65)]" />{t.systemOverview}</div></div></header>
    <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">{t.clubIntelligence}</p><h2 className="mt-1 font-serif text-2xl text-zinc-100">{t.platformOverview}</h2></div><p className="text-[10px] text-zinc-600">{t.supabaseData}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PanelCard title={t.totalProfiles} value={counts.profiles ?? "—"} detail={t.allAccounts} icon={Users} /><PanelCard title={t.residents} value={counts.residents ?? "—"} detail={t.residentAccounts} icon={Fingerprint} /><PanelCard title={t.activeTours} value={counts.tours ?? "—"} detail={t.visibleTours} icon={MapPinned} /><PanelCard title={t.pendingKyc} value={counts.kyc ?? "—"} detail={t.verificationBelow} icon={BadgeCheck} /></div>{metricsError && <p className="mt-3 rounded-xl border border-amber-200/10 bg-amber-200/[0.035] px-4 py-3 text-xs text-amber-100/70">{t.metricsError}</p>}</section>
    <section><div className="mb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">{t.governance}</p><h2 className="mt-1 font-serif text-2xl text-zinc-100">{t.clubManagement}</h2></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><ActionCard href="/admin/roles" title={t.roleAccess} description={t.roleDescription} icon={KeyRound} /><ActionCard href="/admin/database" title={t.fullDatabase} description={t.databaseDescription} icon={Database} /><ActionCard href="/admin/face-control" title={t.faceControl} description={t.faceDescription} icon={BadgeCheck} /><ActionCard href="/admin/events" title={t.toursParties} description={t.eventsDescription} icon={CalendarDays} /><ActionCard href="/admin/gamification" title={t.gamification} description={t.gamificationDescription} icon={Activity} /><ActionCard href="/admin/directory" title={t.operationsSummary} description={t.operationsDescription} icon={WalletCards} /></div></section>
    <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/35"><div className="flex flex-col gap-2 border-b border-zinc-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">{t.verificationQueue}</p><h2 className="mt-1 font-serif text-xl text-zinc-100">{t.awaitingVerification}</h2></div><Link href="/admin/face-control" className="inline-flex w-fit items-center gap-2 text-xs text-amber-100/80 transition-colors hover:text-amber-100">{t.openFaceControl}<ArrowUpRight size={14} /></Link></div>{queueError ? <p className="px-5 py-7 text-sm text-rose-300">{t.kycLoadError}</p> : queue.length ? <div className="divide-y divide-zinc-800/60">{queue.map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm text-zinc-200">{item.full_name?.trim() || t.noName}</p><p className="mt-1 truncate text-xs text-zinc-600">{item.email || item.id}</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-100/70">KYC {item.kyc_level ?? 0}/3</span><span className="text-[10px] text-zinc-600">{statusLabel(item.status)}</span></div></div>)}</div> : <p className="px-5 py-8 text-sm text-zinc-500">{t.noQueue}</p>}</section>
  </div>;

  if (role === "admin") return <div className="space-y-8 pb-10"><header className="rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-7 sm:p-9"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65"><ShieldCheck size={13} />{t.operationsEyebrow}</p><h1 className="mt-4 font-serif text-4xl font-medium text-zinc-50 sm:text-5xl">{t.operationsPanel}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{t.operationsIntro.replace("{name}", greetingName)}</p></header><div className="grid gap-3 sm:grid-cols-3"><ActionCard href="/admin/face-control" title={t.faceControl} description={t.reviewProfiles} icon={BadgeCheck} /><ActionCard href="/admin/database" title={t.fullDatabase} description={t.searchResidents} icon={Database} /><ActionCard href="/admin/applications" title={t.applications} description={t.applicationsDescription} icon={CalendarDays} /></div><section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/35"><div className="flex items-center justify-between border-b border-zinc-800/70 px-5 py-4"><div><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">{t.kycModeration}</p><h2 className="mt-1 font-serif text-xl text-zinc-100">{t.profilesUnderReview}</h2></div><span className="rounded-full border border-amber-200/15 px-2.5 py-1 text-xs tabular-nums text-amber-100/80">{queue.length}</span></div>{queueError ? <p className="px-5 py-6 text-sm text-rose-300">{t.kycLoadError}</p> : queue.length ? <div className="divide-y divide-zinc-800/60">{queue.map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm text-zinc-200">{item.full_name?.trim() || t.noName}</p><p className="mt-1 truncate text-xs text-zinc-600">{item.email || item.id}</p></div><div className="flex items-center gap-3"><span className="text-xs text-zinc-500">KYC {item.kyc_level ?? 0}/3</span><Link href="/admin/face-control" className="text-xs text-amber-100/80 hover:text-amber-100">{t.check}<ArrowUpRight size={13} className="ml-1 inline" /></Link></div></div>)}</div> : <p className="px-5 py-8 text-sm text-zinc-500">{t.emptyQueue}</p>}</section></div>;

  return <div className="space-y-8 pb-10"><header className="rounded-3xl border border-zinc-800/80 bg-zinc-900/45 p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/65">{t.managerEyebrow}</p><h1 className="mt-4 font-serif text-4xl text-zinc-50">{t.managerPanel}</h1><p className="mt-3 text-sm leading-6 text-zinc-400">{t.managerIntro.replace("{name}", greetingName)}</p></header><div className="grid gap-3 md:grid-cols-2"><ActionCard href="/admin/applications" title={t.tourApplications} description={t.tourApplicationsDescription} icon={CalendarDays} /><ActionCard href="/admin/location" title={t.myLocations} description={t.locationsDescription} icon={MapPinned} /></div></div>;
}
