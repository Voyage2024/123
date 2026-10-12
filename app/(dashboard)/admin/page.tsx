import Link from "next/link";
import { redirect } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import QuickKycActions from "@/app/(dashboard)/admin/QuickKycActions";

export const dynamic = "force-dynamic";

type QueueProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  kyc_level: number | null;
  created_at: string | null;
  avatar_url?: string | null;
  photo_urls?: string[] | null;
  resolvedAvatar?: string | null;
};

function PanelCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/45 p-5 backdrop-blur-xl transition-all duration-300 hover:border-amber-200/20 hover:bg-zinc-900/70">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-200/[0.035] blur-2xl transition-colors group-hover:bg-amber-200/[0.07]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.23em] text-zinc-500">{title}</p>
          <p className="mt-4 font-serif text-4xl font-medium tabular-nums tracking-tight text-zinc-50">{value}</p>
          <p className="mt-2 text-xs text-zinc-500">{detail}</p>
        </div>
        <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.045] p-3 text-amber-100/80">
          <Icon size={18} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 items-start gap-4 rounded-2xl border border-zinc-800/70 bg-zinc-900/35 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-200/25 hover:bg-zinc-900/60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.04] text-amber-100/80 transition-colors group-hover:bg-amber-200/[0.09]">
        <Icon size={19} strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-100">
          {title}<ArrowUpRight size={15} className="text-zinc-600 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-200" />
        </span>
        <span className="mt-2 block text-xs leading-5 text-zinc-500">{description}</span>
      </span>
    </Link>
  );
}

async function addSignedAvatars<T extends { avatar_url?: string | null; photo_urls?: string[] | null }>(rows: T[], supabase: Awaited<ReturnType<typeof createClient>>): Promise<Array<T & { resolvedAvatar: string | null }>> {
  const candidate = (row: T) => row.avatar_url?.trim() || row.photo_urls?.find((p) => typeof p === "string" && p.trim()) || null;
  const paths = Array.from(new Set(rows.map(candidate).filter((v): v is string => typeof v === "string" && v.length > 0 && !/^https?:\/\//i.test(v))));
  const signedMap = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage.from("user-uploads").createSignedUrls(paths, 3600);
    if (!error) data?.forEach((item, index) => { if (item.signedUrl) signedMap.set(paths[index], item.signedUrl); });
  }
  return rows.map((row) => {
    const value = candidate(row);
    const resolvedAvatar = !value ? null : /^https?:\/\//i.test(value) ? value : signedMap.get(value) ?? null;
    return { ...row, resolvedAvatar };
  });
}

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) redirect("/login?error=profile_check");
  const role = String(profile.role);
  if (!["owner", "admin", "manager"].includes(role)) redirect("/dashboard");

  const greeting = profile.full_name?.trim() || (role === "owner" ? "Owner" : role === "admin" ? "Administrator" : "Manager");

  if (role === "owner") {
    const [allProfiles, residents, activeTours, queue] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "resident"),
      supabase.from("tours").select("id", { count: "exact", head: true }).is("deleted_at", null).neq("visibility", "hidden"),
      supabase
        .from("profiles")
        .select("id, full_name, email, status, kyc_level, created_at, avatar_url, photo_urls", { count: "exact" })
        .eq("role", "resident")
        .lt("kyc_level", 3)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const pending = await addSignedAvatars((queue.data ?? []) as QueueProfile[], supabase);
    return (
      <div className="space-y-9 pb-10">
        <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/55 to-zinc-950 p-7 sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-amber-200/[0.06] blur-[100px]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-100/65"><ShieldCheck size={13} /> Founder access · Level 01</p>
              <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">Command Center</h1>
              <p className="mt-3 text-sm text-zinc-400">Добро пожаловать, {greeting}. Состояние клуба и ключевые точки управления.</p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-full border border-amber-200/15 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-amber-100/75">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,.65)]" /> System overview
            </div>
          </div>
        </header>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">Club intelligence</p>
              <h2 className="mt-1 font-serif text-2xl text-zinc-100">Обзор платформы</h2>
            </div>
            <p className="text-[10px] text-zinc-600">Данные из Supabase</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PanelCard title="Всего профилей" value={allProfiles.count ?? "—"} detail="Все учётные профили" icon={Users} />
            <PanelCard title="Резидентки" value={residents.count ?? "—"} detail="Профили с ролью resident" icon={Fingerprint} />
            <PanelCard title="Активные туры" value={activeTours.count ?? "—"} detail="Не скрыты и не удалены" icon={MapPinned} />
            <PanelCard title="Ожидают KYC" value={queue.count ?? "—"} detail="Уровень верификации ниже 3" icon={BadgeCheck} />
          </div>
          {(allProfiles.error || residents.error || activeTours.error || queue.error) && (
            <p className="mt-3 rounded-xl border border-amber-200/10 bg-amber-200/[0.035] px-4 py-3 text-xs text-amber-100/70">
              Часть метрик не удалось загрузить. Проверьте права Supabase/RLS для профилей и туров.
            </p>
          )}
        </section>

        <section>
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">Governance</p>
            <h2 className="mt-1 font-serif text-2xl text-zinc-100">Управление клубом</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ActionCard href="/admin/roles" title="Роли и доступ" description="Персонал, смена ролей, временные и постоянные баны." icon={KeyRound} />
            <ActionCard href="/admin/database" title="Полная база" description="Приватный реестр резиденток и доступ к чувствительным данным." icon={Database} />
            <ActionCard href="/admin/face-control" title="Face Control" description="Верификация, проверка анкет и модерация доступа." icon={BadgeCheck} />
            <ActionCard href="/admin/events" title="Туры и тусовки" description="Расписание и управление глобальными мероприятиями." icon={CalendarDays} />
            <ActionCard href="/admin/gamification" title="Геймификация" description="Индекс влияния, уровни клуба, штампы и достижения." icon={Activity} />
            <ActionCard href="/admin/directory" title="Операционная сводка" description="Недавние одобрения, заявки и предстоящие мероприятия." icon={WalletCards} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/35">
          <div className="flex flex-col gap-2 border-b border-zinc-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">Verification queue</p>
              <h2 className="mt-1 font-serif text-xl text-zinc-100">Ожидают верификацию</h2>
            </div>
            <Link href="/admin/face-control" className="inline-flex w-fit items-center gap-2 text-xs text-amber-100/80 transition-colors hover:text-amber-100">Открыть Face Control <ArrowUpRight size={14} /></Link>
          </div>
          {pending.length ? (
            <div className="divide-y divide-zinc-800/60">
              {pending.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.resolvedAvatar ? <img src={item.resolvedAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full border border-amber-200/20 object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-amber-100/70">{(item.full_name?.trim() || "?").slice(0, 1).toUpperCase()}</span>}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">{item.full_name?.trim() || "Без имени"}</p>
                      <p className="mt-1 truncate text-xs text-zinc-600">{item.email || item.id}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <div className="flex items-center gap-3"><span className="rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-100/70">KYC {item.kyc_level ?? 0}/3</span><span className="text-[10px] text-zinc-600">{item.status || "pending"}</span></div>
                    <QuickKycActions profileId={item.id} currentLevel={item.kyc_level} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-zinc-500">Нет резиденток в очереди по выбранному критерию или данные недоступны.</p>
          )}
        </section>
      </div>
    );
  }

  if (role === "admin") {
    const { data: queueData, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, status, kyc_level, created_at, avatar_url, photo_urls")
      .eq("role", "resident")
      .lt("kyc_level", 3)
      .order("created_at", { ascending: false })
      .limit(20);
    const queue = await addSignedAvatars((queueData ?? []) as QueueProfile[], supabase);

    return (
      <div className="space-y-8 pb-10">
        <header className="rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-7 sm:p-9">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65"><ShieldCheck size={13} /> Operations · Admin</p>
          <h1 className="mt-4 font-serif text-4xl font-medium text-zinc-50 sm:text-5xl">Операционная панель</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{greeting}, здесь собраны заявки, требующие проверки, и быстрые переходы к модерации.</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <ActionCard href="/admin/face-control" title="Face Control" description="Проверить анкеты, документы и решения по доступу." icon={BadgeCheck} />
          <ActionCard href="/admin/database" title="Полная база" description="Поиск резиденток и инструменты управления доступом." icon={Database} />
          <ActionCard href="/admin/applications" title="Заявки" description="Модерация запросов на туры и рабочие направления." icon={CalendarDays} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/35">
          <div className="flex items-center justify-between border-b border-zinc-800/70 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">KYC moderation</p>
              <h2 className="mt-1 font-serif text-xl text-zinc-100">Анкеты на проверке</h2>
            </div>
            <span className="rounded-full border border-amber-200/15 px-2.5 py-1 text-xs tabular-nums text-amber-100/80">{queue?.length ?? 0}</span>
          </div>
          {error ? (
            <p className="px-5 py-6 text-sm text-rose-300">Не удалось загрузить очередь KYC. Проверьте политику чтения profiles.</p>
          ) : queue?.length ? (
            <div className="divide-y divide-zinc-800/60">
              {(queue as QueueProfile[]).map((item) => (
                <div key={item.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.resolvedAvatar ? <img src={item.resolvedAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full border border-amber-200/20 object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-amber-100/70">{(item.full_name?.trim() || "?").slice(0, 1).toUpperCase()}</span>}
                    <div className="min-w-0"><p className="truncate text-sm text-zinc-200">{item.full_name?.trim() || "Без имени"}</p><p className="mt-1 truncate text-xs text-zinc-600">{item.email || item.id}</p></div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end"><div className="flex items-center gap-3"><span className="text-xs text-zinc-500">KYC {item.kyc_level ?? 0}/3</span><Link href="/admin/face-control" className="text-xs text-amber-100/80 hover:text-amber-100">Проверить <ArrowUpRight size={13} className="ml-1 inline" /></Link></div><QuickKycActions profileId={item.id} currentLevel={item.kyc_level} /></div>
                </div>
              ))}
            </div>
          ) : <p className="px-5 py-8 text-sm text-zinc-500">Очередь пуста.</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="rounded-3xl border border-zinc-800/80 bg-zinc-900/45 p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/65">Manager workspace</p>
        <h1 className="mt-4 font-serif text-4xl text-zinc-50">Рабочая панель</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{greeting}, выберите направление, заявку или текущую операционную задачу.</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <ActionCard href="/admin/applications" title="Заявки на туры" description="Обрабатывайте запросы в доступных вам направлениях." icon={CalendarDays} />
      </div>
    </div>
  );
}
