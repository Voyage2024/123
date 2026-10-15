-- VOYAGE Master Blueprint · Stage 1
-- Idempotent profile foundations + protected owner/admin Social Lift RPC.
-- Existing application/event relationships are preserved; no tables are recreated.

begin;

-- 1) Ensure the profile fields exist. These columns already exist in the supplied dump;
-- IF NOT EXISTS keeps this migration safe on earlier installations as well.
alter table public.profiles
  add column if not exists segment text default 'working' not null,
  add column if not exists level smallint default 1 not null,
  add column if not exists reliability numeric(5,2) default 100.00 not null;

-- Normalize legacy/null values before enforcing the expected ranges.
update public.profiles
set segment = case when segment = 'elite' then 'elite' else 'working' end
where segment is null or segment not in ('working', 'elite');

update public.profiles
set level = greatest(1, least(6, coalesce(level, 1)))::smallint
where level is null or level < 1 or level > 6;

update public.profiles
set reliability = greatest(0::numeric, least(100::numeric, coalesce(reliability, 100.00)))
where reliability is null or reliability < 0 or reliability > 100;

alter table public.profiles alter column segment set default 'working';
alter table public.profiles alter column segment set not null;
alter table public.profiles alter column level set default 1;
alter table public.profiles alter column level set not null;
alter table public.profiles alter column reliability set default 100.00;
alter table public.profiles alter column reliability set not null;

-- Add expected range checks only when this exact constraint is not already present.
do $migration$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_segment_check') then
    alter table public.profiles add constraint profiles_segment_check check (segment in ('working', 'elite'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_level_range')
     and not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_level_range_check') then
    alter table public.profiles add constraint profiles_level_range check (level between 1 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_reliability_range') then
    alter table public.profiles add constraint profiles_reliability_range check (reliability between 0 and 100);
  end if;
end
$migration$;

comment on column public.profiles.segment is 'VOYAGE access segment: working or elite; owner/admin managed.';
comment on column public.profiles.level is 'Cached VOYAGE circle level 1..6; calculated by server-side gamification.';
comment on column public.profiles.reliability is 'Reliability percentage 0..100; owner/admin managed.';

-- 2) Confirm application/event fields used by the unified moderation CRM.
-- In the supplied dump these columns and their key relationships already exist.
-- Add-if-missing clauses are non-destructive for environments with a partial schema.
alter table public.applications
  add column if not exists user_id uuid,
  add column if not exists hub_id text,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now();

alter table public.global_events
  add column if not exists title text,
  add column if not exists region text,
  add column if not exists is_active boolean default true not null,
  add column if not exists audience_segment text default 'all' not null,
  add column if not exists minimum_kyc_level smallint default 0 not null,
  add column if not exists capacity integer,
  add column if not exists application_closes_at timestamptz;

alter table public.event_applications
  add column if not exists user_id uuid,
  add column if not exists event_id uuid,
  add column if not exists status text default 'pending',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- event_applications.user_id points to auth.users.id, while profiles.id is a separate
-- club profile identifier and profiles.user_id is the unique auth-user mapping. The CRM
-- resolves event applicants with profiles.user_id. Do not add a second FK here: profiles.user_id
-- already uses ON DELETE SET NULL toward auth.users, while event_applications.user_id is NOT NULL
-- and cascades on auth.users deletion; a second cascading FK would complicate that delete path.

-- Useful for the two descending application feeds. Safe to rerun.
create index if not exists applications_created_at_crm_idx
  on public.applications (created_at desc);
create index if not exists event_applications_created_at_crm_idx
  on public.event_applications (created_at desc);
create index if not exists event_applications_event_created_at_crm_idx
  on public.event_applications (event_id, created_at desc);

-- 3) Defense-in-depth guard for segment/reliability and server-computed level.
-- The existing voyage_guard_profile_privileges trigger remains untouched.
create or replace function public.voyage_guard_profile_segment_level_reliability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Backend migrations, trusted service-role calls and existing system triggers.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.club_is_admin() then
      new.segment := 'working';
      new.level := 1;
      new.reliability := 100.00;
    end if;
    return new;
  end if;

  if (new.segment is distinct from old.segment
      or new.reliability is distinct from old.reliability)
     and not public.club_is_admin() then
    raise exception 'VOYAGE: only owner/admin can change segment or reliability'
      using errcode = '42501';
  end if;

  if new.level is distinct from old.level
     and coalesce(current_setting('voyage.gamification_internal', true), 'off') <> 'on' then
    raise exception 'VOYAGE: level is computed by server-side gamification'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.voyage_guard_profile_segment_level_reliability() from public, anon;
grant execute on function public.voyage_guard_profile_segment_level_reliability() to authenticated, service_role;

drop trigger if exists profiles_guard_segment_level_reliability on public.profiles;
create trigger profiles_guard_segment_level_reliability
before insert or update of segment, level, reliability on public.profiles
for each row execute function public.voyage_guard_profile_segment_level_reliability();

-- 4) Atomic Social Lift action. The RPC validates role, target, segment and range.
-- It intentionally does not accept level/circle: those remain server-calculated.
create or replace function public.admin_set_resident_segment_reliability(
  p_profile_id uuid,
  p_segment text default null,
  p_reliability numeric default null
)
returns table (profile_id uuid, segment text, reliability numeric)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;

  if not public.is_admin_or_owner() then
    raise exception 'voyage:admin_or_owner_required' using errcode = '42501';
  end if;

  if p_profile_id is null then
    raise exception 'voyage:profile_id_required' using errcode = '22023';
  end if;

  if p_segment is null and p_reliability is null then
    raise exception 'voyage:no_changes_requested' using errcode = '22023';
  end if;

  if p_segment is not null and p_segment not in ('working', 'elite') then
    raise exception 'voyage:invalid_segment' using errcode = '22023';
  end if;

  if p_reliability is not null and (p_reliability < 0 or p_reliability > 100) then
    raise exception 'voyage:invalid_reliability' using errcode = '22023';
  end if;

  update public.profiles as p
     set segment = coalesce(p_segment, p.segment),
         reliability = coalesce(p_reliability, p.reliability),
         updated_at = now()
   where p.id = p_profile_id
     and p.role::text = 'resident'
   returning p.* into v_profile;

  if not found then
    raise exception 'voyage:resident_profile_not_found' using errcode = 'P0002';
  end if;

  return query select v_profile.id, v_profile.segment, v_profile.reliability;
end;
$function$;

revoke all on function public.admin_set_resident_segment_reliability(uuid, text, numeric) from public, anon;
grant execute on function public.admin_set_resident_segment_reliability(uuid, text, numeric) to authenticated;

notify pgrst, 'reload schema';

commit;
