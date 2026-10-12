-- VOYAGE UX feedback features:
-- 1) idempotent Welcome achievement grant; 2) concierge requests/checklist;
-- 3) server-side event application validation with user-readable error codes.
-- Prerequisite: the existing VOYAGE gamification migration must already be applied
-- (resident_metrics, resident_achievements, game_is_staff, resident_refresh_metrics).

begin;

-- Fail early with an actionable error rather than applying a partial migration
-- when its known VOYAGE prerequisites have not been installed.
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.global_events') is null
     or to_regclass('public.event_applications') is null then
    raise exception 'VOYAGE UX migration requires profiles, global_events and event_applications';
  end if;
  if to_regclass('public.resident_metrics') is null
     or to_regclass('public.resident_achievements') is null
     or to_regprocedure('public.game_is_staff()') is null then
    raise exception 'Apply the VOYAGE gamification migration first (resident_metrics, resident_achievements, game_is_staff)';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Required function public.set_updated_at() is missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A. Event application rules. Existing rows remain; capacity is unlimited unless
-- configured. Existing events default to KYC2 because these are closed events.
-- ---------------------------------------------------------------------------
alter table public.global_events
  add column if not exists minimum_kyc_level smallint not null default 0,
  add column if not exists capacity integer,
  add column if not exists application_closes_at timestamptz;

alter table public.global_events alter column minimum_kyc_level set default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.global_events'::regclass
      and conname = 'global_events_minimum_kyc_level_chk'
  ) then
    alter table public.global_events add constraint global_events_minimum_kyc_level_chk
      check (minimum_kyc_level between 0 and 3) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.global_events'::regclass
      and conname = 'global_events_capacity_chk'
  ) then
    alter table public.global_events add constraint global_events_capacity_chk
      check (capacity is null or capacity > 0) not valid;
  end if;
end $$;

alter table public.global_events validate constraint global_events_minimum_kyc_level_chk;
alter table public.global_events validate constraint global_events_capacity_chk;

comment on column public.global_events.minimum_kyc_level is 'Minimum resident KYC level required to apply; 0..3.';
comment on column public.global_events.capacity is 'Maximum number of active applications; NULL means unlimited.';
comment on column public.global_events.application_closes_at is 'Application deadline. NULL means no scheduled deadline.';

create or replace function public.submit_global_event_application(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_event public.global_events%rowtype;
  v_application public.event_applications%rowtype;
  v_active_count integer;
  v_latest_rejection timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = v_uid
  for share;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;
  if v_profile.role::text <> 'resident' then
    return jsonb_build_object('ok', false, 'reason', 'resident_only');
  end if;
  if v_profile.status::text is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'reason', 'profile_not_approved');
  end if;
  if coalesce(to_jsonb(v_profile)->>'ban_permanent', 'false') = 'true'
     or coalesce(to_jsonb(v_profile)->>'banned_until', '') = 'infinity'
     or nullif(to_jsonb(v_profile)->>'banned_until', '')::timestamptz > now() then
    return jsonb_build_object('ok', false, 'reason', 'banned');
  end if;

  -- Serializes capacity checks per event to prevent two simultaneous requests
  -- from taking the final place twice.
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  select * into v_event
  from public.global_events e
  where e.id = p_event_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'event_not_found');
  end if;
  if not v_event.is_active then
    return jsonb_build_object('ok', false, 'reason', 'event_closed');
  end if;
  if v_event.application_closes_at is not null and v_event.application_closes_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'application_closed');
  end if;
  if coalesce(v_profile.kyc_level, 0) < coalesce(v_event.minimum_kyc_level, 0) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'kyc_required',
      'required_level', v_event.minimum_kyc_level,
      'actual_level', coalesce(v_profile.kyc_level, 0)
    );
  end if;
  if v_event.audience_segment is not null and v_event.audience_segment <> 'all'
     and v_event.audience_segment <> v_profile.segment then
    return jsonb_build_object('ok', false, 'reason', 'segment_not_eligible');
  end if;

  if exists (
    select 1 from public.event_applications a
    where a.event_id = p_event_id and a.user_id = v_uid
      and a.status in ('pending', 'approved')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_applied');
  end if;

  select max(a.updated_at) into v_latest_rejection
  from public.event_applications a
  where a.event_id = p_event_id and a.user_id = v_uid and a.status = 'rejected';
  if v_latest_rejection is not null and v_latest_rejection > now() - interval '1 month' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'rejection_cooldown',
      'available_at', v_latest_rejection + interval '1 month'
    );
  end if;

  if v_event.capacity is not null then
    select count(*)::integer into v_active_count
    from public.event_applications a
    where a.event_id = p_event_id and a.status in ('pending', 'approved');
    if v_active_count >= v_event.capacity then
      return jsonb_build_object('ok', false, 'reason', 'event_full');
    end if;
  end if;

  insert into public.event_applications(user_id, event_id, status)
  values (v_uid, p_event_id, 'pending')
  returning * into v_application;

  return jsonb_build_object('ok', true, 'application', to_jsonb(v_application));
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_applied');
end;
$$;

revoke all on function public.submit_global_event_application(uuid) from public, anon;
grant execute on function public.submit_global_event_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- B. Welcome achievement. We use resident_achievements as the timestamp source;
-- profiles.achievements stays untouched because its guard intentionally protects
-- manual awards. The dashboard merges achievement keys from both sources.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists first_step_earned_at timestamptz;

create table if not exists public.resident_achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  activity_id uuid,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  earned_at timestamptz not null default now(),
  unique (profile_id, achievement_key)
);

create index if not exists resident_achievements_profile_idx
  on public.resident_achievements(profile_id, earned_at desc);

create or replace function public.voyage_award_welcome_achievement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned_at timestamptz;
begin
  if new.role::text <> 'resident'
     or coalesce(to_jsonb(new)->>'is_npc', 'false') = 'true' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and not (
       (new.status::text = 'approved' and old.status::text is distinct from 'approved')
       or new.kyc_level > old.kyc_level
     ) then
    return new;
  end if;

  -- The migration that introduced resident_metrics must be installed first.
  insert into public.resident_metrics(profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  insert into public.resident_achievements(profile_id, achievement_key, title, points_awarded)
  values (new.id, 'welcome_to_voyage', 'Welcome to VOYAGE', 0)
  on conflict (profile_id, achievement_key) do nothing
  returning earned_at into v_earned_at;

  if v_earned_at is null then
    select a.earned_at into v_earned_at
    from public.resident_achievements a
    where a.profile_id = new.id and a.achievement_key = 'welcome_to_voyage';
  end if;

  update public.profiles p
  set first_step_earned_at = coalesce(p.first_step_earned_at, v_earned_at)
  where p.id = new.id and p.first_step_earned_at is null;

  if to_regprocedure('public.resident_refresh_metrics(uuid)') is not null then
    execute 'select public.resident_refresh_metrics($1)' using new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.voyage_award_welcome_achievement() from public, anon, authenticated;
drop trigger if exists profiles_award_welcome_achievement on public.profiles;
create trigger profiles_award_welcome_achievement
after insert or update of status, kyc_level on public.profiles
for each row execute function public.voyage_award_welcome_achievement();

-- Backfill the welcome achievement for already-approved residents. The earn time
-- is written once, so its visual glow ends precisely 24 hours after this award.
insert into public.resident_metrics(profile_id)
select p.id
from public.profiles p
where p.role::text = 'resident'
  and coalesce(to_jsonb(p)->>'is_npc', 'false') <> 'true'
on conflict (profile_id) do nothing;

insert into public.resident_achievements(profile_id, achievement_key, title, points_awarded)
select p.id, 'welcome_to_voyage', 'Welcome to VOYAGE', 0
from public.profiles p
where p.role::text = 'resident'
  and p.status::text = 'approved'
  and coalesce(to_jsonb(p)->>'is_npc', 'false') <> 'true'
on conflict (profile_id, achievement_key) do nothing;

update public.profiles p
set first_step_earned_at = a.earned_at
from public.resident_achievements a
where a.profile_id = p.id
  and a.achievement_key = 'welcome_to_voyage'
  and p.first_step_earned_at is null;

do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select a.profile_id
    from public.resident_achievements a
    join public.profiles p on p.id = a.profile_id
    where a.achievement_key = 'welcome_to_voyage'
      and p.role::text = 'resident'
  loop
    if to_regprocedure('public.resident_refresh_metrics(uuid)') is not null then
      perform public.resident_refresh_metrics(v_profile_id);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- D. Private profile avatar uploads and signed reads.
-- Telegram uploads use <telegram_id>/<uuid>.jpg; self-service avatars use
-- <auth_user_uuid>/avatar-<uuid>.<ext>. Keep both naming conventions private.
drop policy if exists voyage_staff_read_portfolio_photos on storage.objects;
create policy voyage_staff_read_portfolio_photos
on storage.objects for select to authenticated
using (
  bucket_id = 'user-uploads'
  and exists (
    select 1 from public.profiles p
    where (p.id::text = split_part(storage.objects.name, '/', 1)
           or p.telegram_id = split_part(storage.objects.name, '/', 1))
      and (
        p.id = auth.uid()
        or public.is_voyage_admin()
        or (public.is_manager() and exists (
          select 1 from public.applications a
          where a.user_id = p.id and public.is_manager_for_hub(a.hub_id)
        ))
      )
  )
);

drop policy if exists voyage_resident_upload_own_profile_avatar on storage.objects;
create policy voyage_resident_upload_own_profile_avatar
on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-uploads'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
  and storage.objects.name ~* '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.(jpg|png|webp)$'
  and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
);

drop policy if exists voyage_resident_delete_own_profile_avatar on storage.objects;
create policy voyage_resident_delete_own_profile_avatar
on storage.objects for delete to authenticated
using (
  bucket_id = 'user-uploads'
  and split_part(storage.objects.name, '/', 1) = auth.uid()::text
  and storage.objects.name ~* '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.(jpg|png|webp)$'
);

-- ---------------------------------------------------------------------------
-- C. Resident Concierge requests and manager/admin checklist.
-- ---------------------------------------------------------------------------
create table if not exists public.partner_concierge_requests (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  category text not null default 'general' check (category in ('travel', 'accommodation', 'transport', 'event', 'documents', 'general')),
  message text not null check (char_length(btrim(message)) between 5 and 4000),
  trip_stage text not null default 'before_tour' check (trip_stage in ('before_tour', 'during_tour', 'after_tour')),
  desired_at timestamptz,
  preferred_language text not null default 'EN' check (preferred_language in ('EN', 'RU', 'ES', 'PT')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'impossible')),
  admin_feedback text check (admin_feedback is null or char_length(admin_feedback) <= 4000),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_concierge_requests_resident_created_idx
  on public.partner_concierge_requests(resident_id, created_at desc);
create index if not exists partner_concierge_requests_status_created_idx
  on public.partner_concierge_requests(status, created_at asc);

alter table public.partner_concierge_requests enable row level security;

revoke all on public.partner_concierge_requests from public, anon, authenticated;
grant select, insert, update on public.partner_concierge_requests to authenticated;
grant all on public.partner_concierge_requests to service_role;

drop policy if exists partner_concierge_requests_read_own_or_staff on public.partner_concierge_requests;
create policy partner_concierge_requests_read_own_or_staff
on public.partner_concierge_requests for select to authenticated
using (resident_id = auth.uid() or public.game_is_staff());

drop policy if exists partner_concierge_requests_insert_own on public.partner_concierge_requests;
create policy partner_concierge_requests_insert_own
on public.partner_concierge_requests for insert to authenticated
with check (
  resident_id = auth.uid()
  and status = 'open'
  and resolved_by is null
  and resolved_at is null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'resident'
      and p.status::text = 'approved'
      and not (
        coalesce(to_jsonb(p)->>'ban_permanent', 'false') = 'true'
        or coalesce(to_jsonb(p)->>'banned_until', '') = 'infinity'
        or nullif(to_jsonb(p)->>'banned_until', '')::timestamptz > now()
      )
  )
);

drop policy if exists partner_concierge_requests_update_staff on public.partner_concierge_requests;
create policy partner_concierge_requests_update_staff
on public.partner_concierge_requests for update to authenticated
using (public.game_is_staff())
with check (public.game_is_staff());

drop trigger if exists partner_concierge_requests_updated_at on public.partner_concierge_requests;
create trigger partner_concierge_requests_updated_at
before update on public.partner_concierge_requests
for each row execute function public.set_updated_at();

commit;
