import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, CircleUserRound, ShieldCheck } from "lucide-react";
import ResidentProfileManagement from "./ResidentProfileManagement";
import DeleteResidentDangerZone from "./DeleteResidentDangerZone";
import { createClient } from "@/lib/supabase/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-xl border border-zinc-800/80 bg-black/15 px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{label}</p><p className="mt-2 break-words text-sm text-zinc-200">{value === null || value === undefined || value === "" ? "—" : String(value)}</p></div>;
}

export default async function ResidentProfilePreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const actorByUser = await supabase.from("profiles")
    .select("id,user_id,role,banned_until,ban_permanent")
    .eq("user_id", user.id)
    .maybeSingle();
  let actor = actorByUser.data;
  let actorError = actorByUser.error;
  // Older installs may still use auth.users.id as profiles.id.
  if (!actor && !actorError) {
    const legacyActor = await supabase.from("profiles")
      .select("id,user_id,role,banned_until,ban_permanent")
      .eq("id", user.id)
      .maybeSingle();
    actor = legacyActor.data;
    actorError = legacyActor.error;
  }
  if (actorError || !actor || !["owner", "admin"].includes(String(actor.role))) {
    return <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/20 bg-rose-950/10 p-6 text-sm text-rose-200">Доступ к профилям разрешён только владельцу и администраторам.</div>;
  }
  if (actor.ban_permanent || actor.banned_until === "infinity" || (actor.banned_until && Date.parse(actor.banned_until) > Date.now())) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase.from("profiles")
    .select("id,full_name,name,email,role,status,kyc_level,telegram_id,telegram_username,avatar_url,photo_urls,location,citizenship,birth_date,height,weight,measurements,about,segment,circle,level,reliability,influence_index,tour_points,usdt_wallet,banned_until,ban_reason,ban_permanent,created_at,last_seen_at,registration_source")
    .eq("id", id)
    .maybeSingle();
  if (error || !profile) notFound();

  let avatarUrl: string | null = profile.avatar_url ?? profile.photo_urls?.[0] ?? null;
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(avatarUrl, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }
  const name = profile.full_name?.trim() || profile.name?.trim() || "Без ФИО";
  const bannedUntil = profile.ban_permanent || profile.banned_until === "infinity" ? "Навсегда" : fmt(profile.banned_until);

  return <div className="mx-auto max-w-5xl space-y-6 pb-10">
    <Link href="/admin/database" className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-amber-200/25 hover:text-amber-100"><ArrowLeft size={14} /> Назад в полную базу</Link>
    <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-6 sm:p-8">
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-24 w-24 rounded-2xl border border-amber-200/20 object-cover" /> : <span className="flex h-24 w-24 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 text-3xl text-amber-100/75"><CircleUserRound size={34} /></span>}
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/65">Private registry · Profile preview</p><h1 className="mt-3 break-words font-serif text-3xl text-zinc-50 sm:text-4xl">{name}</h1><p className="mt-2 break-all font-mono text-[10px] text-zinc-600">{profile.id}</p><div className="mt-4 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1 text-[10px] text-emerald-200/80"><ShieldCheck size={12} /> {profile.status || "Статус не указан"}</span><span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 px-2.5 py-1 text-[10px] text-zinc-400"><CalendarClock size={12} /> Был(а) в сети: {fmt(profile.last_seen_at)}</span></div></div>
      </div>
    </header>

    <section className="space-y-3"><h2 className="font-serif text-xl text-zinc-100">Идентификация и доступ</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Email / логин" value={profile.email} /><Field label="Telegram ID" value={profile.telegram_id} /><Field label="Telegram username" value={profile.telegram_username ? `@${profile.telegram_username.replace(/^@/, "")}` : null} /><Field label="Роль" value={profile.role} /><Field label="KYC" value={`${profile.kyc_level ?? 0}/3`} /><Field label="Дата создания" value={fmt(profile.created_at)} /><Field label="Источник регистрации" value={profile.registration_source} /><Field label="Блокировка до" value={profile.ban_permanent ? "Навсегда" : profile.banned_until ? bannedUntil : "Не заблокирован"} /><Field label="Причина блокировки" value={profile.ban_reason} /></div></section>
    <section className="space-y-3"><h2 className="font-serif text-xl text-zinc-100">Профиль резидента</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Локация" value={profile.location} /><Field label="Гражданство" value={profile.citizenship} /><Field label="Дата рождения" value={profile.birth_date} /><Field label="Рост" value={profile.height} /><Field label="Вес" value={profile.weight} /><Field label="Параметры" value={profile.measurements} /><Field label="Индекс влияния" value={profile.influence_index} /><Field label="Баллы" value={profile.tour_points} /><Field label="USDT кошелёк" value={profile.usdt_wallet} /></div></section>
    {profile.role === "resident" && <ResidentProfileManagement
      profileId={profile.id}
      fullName={name}
      segment={profile.segment}
      level={profile.level}
      circle={profile.circle}
      reliability={profile.reliability}
      kycLevel={profile.kyc_level}
      viewerRole={String(actor.role)}
      viewerId={user.id}
      viewerEmail={user.email ?? null}
    />}

    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-5"><h2 className="font-serif text-xl text-zinc-100">О себе</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{profile.about?.trim() || "Описание не заполнено."}</p></section>

    {actor.role === "owner" && profile.role === "resident" && <DeleteResidentDangerZone profileId={profile.id} fullName={name} />}
  </div>;
}
