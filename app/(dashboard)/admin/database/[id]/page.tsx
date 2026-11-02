import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, CircleUserRound, ShieldCheck } from "lucide-react";
import ResidentProfileManagement from "@/app/(dashboard)/admin/database/[id]/ResidentProfileManagement";
import DeleteResidentDangerZone from "@/app/(dashboard)/admin/database/[id]/DeleteResidentDangerZone";
import ResidentPdfExports from "@/app/(dashboard)/admin/database/[id]/ResidentPdfExports";
import { formatShoeSize, normalizeClothingSize } from "@/lib/resident-sizes";
import { createClient } from "@/lib/supabase/server";
import { VipAvatarMark, VipBadge, VipSeal, isKycElite } from "@/app/components/profile/VipBadge";
import { ReviewChips } from "@/app/components/admin/ReviewChips";
import { hasPendingReview, reviewCopy, type ReviewFlags } from "@/lib/admin-review";
import { loadReviewQueue } from "@/lib/server/admin-review-queue";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

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

  const PROFILE_COLUMNS = "id,full_name,name,email,role,status,kyc_level,telegram_id,telegram_username,avatar_url,photo_urls,location,citizenship,birth_date,height,weight,measurements,about,segment,circle,level,reliability,influence_index,tour_points,usdt_wallet,banned_until,ban_reason,ban_permanent,created_at,last_seen_at,registration_source";
  type ProfileWithSizes = { clothing_size?: string | null; shoe_size?: string | number | null };
  let profileQuery = await supabase.from("profiles")
    .select(`${PROFILE_COLUMNS},clothing_size,shoe_size`)
    .eq("id", id)
    .maybeSingle();
  // 42703: миграция с размерами ещё не применена — карточка открывается без них.
  if (profileQuery.error?.code === "42703") {
    profileQuery = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle() as typeof profileQuery;
  }
  const { data: profile, error } = profileQuery;
  if (error || !profile) notFound();
  const sizes = profile as ProfileWithSizes;
  const clothingSize = normalizeClothingSize(sizes.clothing_size);
  const shoeSize = formatShoeSize(sizes.shoe_size);

  let avatarUrl: string | null = profile.avatar_url ?? profile.photo_urls?.[0] ?? null;
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(avatarUrl, 3600);
    avatarUrl = signed?.signedUrl ?? null;
  }
  const name = profile.full_name?.trim() || profile.name?.trim() || "Без ФИО";
  /** KYC 3 — личная верификация с консьержем: VIP-знак у имени и на фото */
  const elite = profile.role === "resident" && isKycElite(profile.kyc_level);
  // Что ждёт проверки (KYC 1/2 файлы, запрос KYC 3) — сюда ведёт кнопка из Telegram.
  let review: ReviewFlags | null = null;
  if (profile.role === "resident") {
    try {
      const queue = await loadReviewQueue(getTelegramServiceClient(), profile.id);
      review = queue.byProfile[profile.id] ?? null;
    } catch (queueError) {
      console.error("[admin/database/id] review queue", queueError instanceof Error ? queueError.name : "unknown");
    }
  }
  const pendingReview = hasPendingReview(review);
  const rc = reviewCopy("RU");
  const bannedUntil = profile.ban_permanent || profile.banned_until === "infinity" ? "Навсегда" : fmt(profile.banned_until);

  return <div className="mx-auto max-w-5xl space-y-6 pb-10">
    <Link href="/admin/database" className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-amber-200/25 hover:text-amber-100"><ArrowLeft size={14} /> Назад в полную базу</Link>
    <header className={`relative overflow-hidden rounded-3xl border ${pendingReview ? "border-amber-200/60 shadow-[0_0_32px_rgba(253,230,138,0.10)]" : "border-amber-200/15"} bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-zinc-950 p-6 sm:p-8`}>
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative w-fit shrink-0">
          {avatarUrl ? <img src={avatarUrl} alt="" className={`h-24 w-24 rounded-2xl border object-cover ${elite ? "border-amber-200/55" : "border-amber-200/20"}`} /> : <span className="flex h-24 w-24 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 text-3xl text-amber-100/75"><CircleUserRound size={34} /></span>}
          {elite && <VipAvatarMark lang="RU" size="md" className="-bottom-2 -right-2" />}
        </div>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/65">Private registry · Profile preview</p>{pendingReview && <ReviewChips flags={review} lang="RU" className="mt-2" />}<h1 className="mt-3 break-words font-serif text-3xl text-zinc-50 sm:text-4xl">{name}{elite && <VipSeal className="ml-2 inline h-7 w-7 align-[-4px]" title="KYC 3" />}</h1><p className="mt-2 break-all font-mono text-[10px] text-zinc-600">{profile.id}</p><div className="mt-4 flex flex-wrap gap-2">{elite && <VipBadge lang="RU" />}<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-1 text-[10px] text-emerald-200/80"><ShieldCheck size={12} /> {profile.status || "Статус не указан"}</span><span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 px-2.5 py-1 text-[10px] text-zinc-400"><CalendarClock size={12} /> Был(а) в сети: {fmt(profile.last_seen_at)}</span></div></div>
      </div>
    </header>

    {profile.role === "resident" && <ResidentPdfExports profileId={profile.id} viewerRole={String(actor.role)} />}

    {pendingReview && review && <section aria-label={rc.bannerTitle} className="relative overflow-hidden rounded-2xl border border-amber-200/50 bg-amber-200/[0.07] p-4 sm:p-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,0.55)]" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">{rc.bannerTitle}</p>
          <ReviewChips flags={review} lang="RU" className="mt-2" />
          {(review.kyc1 || review.kyc2) && <p className="mt-2 text-xs leading-5 text-amber-100/70">{rc.bannerHint}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(review.kyc1 || review.kyc2) && <a href="#kyc-review" className="inline-flex min-h-10 items-center rounded-lg border border-amber-200/50 bg-amber-200 px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100">К документам</a>}
          {review.kyc3 && <Link href="/admin/concierge" className="inline-flex min-h-10 items-center rounded-lg border border-amber-200/40 px-3.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/10">{rc.openConcierge}</Link>}
        </div>
      </div>
    </section>}

    <section className="space-y-3"><h2 className="font-serif text-xl text-zinc-100">Идентификация и доступ</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Email / логин" value={profile.email} /><Field label="Telegram ID" value={profile.telegram_id} /><Field label="Telegram username" value={profile.telegram_username ? `@${profile.telegram_username.replace(/^@/, "")}` : null} /><Field label="Роль" value={profile.role} /><Field label="KYC" value={`${profile.kyc_level ?? 0}/3`} /><Field label="Дата создания" value={fmt(profile.created_at)} /><Field label="Источник регистрации" value={profile.registration_source} /><Field label="Блокировка до" value={profile.ban_permanent ? "Навсегда" : profile.banned_until ? bannedUntil : "Не заблокирован"} /><Field label="Причина блокировки" value={profile.ban_reason} /></div></section>
    <section className="space-y-3"><h2 className="font-serif text-xl text-zinc-100">Профиль резидента</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Локация" value={profile.location} /><Field label="Гражданство" value={profile.citizenship} /><Field label="Дата рождения" value={profile.birth_date} /><Field label="Рост" value={profile.height} /><Field label="Вес" value={profile.weight} /><Field label="Параметры" value={profile.measurements} /><Field label="Размер одежды" value={clothingSize ?? (profile.role === "resident" ? "Не указан" : null)} /><Field label="Размер обуви (EU)" value={shoeSize ?? (profile.role === "resident" ? "Не указан" : null)} /><Field label="Индекс влияния" value={profile.influence_index} /><Field label="Баллы" value={profile.tour_points} /><Field label="USDT кошелёк" value={profile.usdt_wallet} /></div></section>
    {profile.role === "resident" && <div id="kyc-review" className="scroll-mt-24" />}
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
