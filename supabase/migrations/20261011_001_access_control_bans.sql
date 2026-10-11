-- VOYAGE · access control, bans and audit trail
-- Run after taking a DB backup. This migration preserves existing profiles and roles.

begin;

alter table public.profiles
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text,
  add column if not exists ban_permanent boolean not null default false,
  add column if not exists ban_set_at timestamptz,
  add column if not exists ban_set_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_ban_reason_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_ban_reason_length_check
      check (ban_reason is null or char_length(ban_reason) <= 500);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_permanent_ban_consistency_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_permanent_ban_consistency_check
      check (not ban_permanent or banned_until = 'infinity'::timestamptz);
  end if;
end $$;

create index if not exists profiles_banned_until_active_idx
  on public.profiles (banned_until)
  where banned_until is not null;


-- Prevent a resident or manager from clearing/forging their own ban through direct PostgREST updates.
-- RPCs run with the caller's auth.uid(), so owner/admin actions remain authorized by role.
create or replace function public.guard_profile_ban_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  -- Transaction-local flag enabled only by the SECURITY DEFINER ban RPCs below.
  v_rpc_authorized boolean := coalesce(current_setting('voyage.allow_ban_fields', true), 'off') = 'on';
begin
  -- Trusted backend operations / migrations run without an end-user JWT.
  if auth.uid() is null or v_rpc_authorized then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.banned_until is not null
      or new.ban_reason is not null
      or coalesce(new.ban_permanent, false)
      or new.ban_set_at is not null
      or new.ban_set_by is not null
    then
      raise exception 'Voyage: ban fields must be changed through the authorized ban RPC' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.banned_until is distinct from old.banned_until
    or new.ban_reason is distinct from old.ban_reason
    or new.ban_permanent is distinct from old.ban_permanent
    or new.ban_set_at is distinct from old.ban_set_at
    or new.ban_set_by is distinct from old.ban_set_by
  then
    raise exception 'Voyage: ban fields must be changed through the authorized ban RPC' using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function public.guard_profile_ban_fields() owner to postgres;
drop trigger if exists profiles_guard_ban_fields on public.profiles;
create trigger profiles_guard_ban_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_ban_fields();

create table if not exists public.profile_ban_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('banned', 'unbanned')),
  duration text check (duration is null or duration in ('24_hours', '1_week', '1_month', 'forever')),
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profile_ban_audit enable row level security;

drop policy if exists profile_ban_audit_staff_read on public.profile_ban_audit;
create policy profile_ban_audit_staff_read
  on public.profile_ban_audit
  for select to authenticated
  using (public.is_admin_or_owner());

revoke all on table public.profile_ban_audit from public, anon, authenticated;
grant select on public.profile_ban_audit to authenticated;

-- Remove the legacy PUBLIC SELECT policy: it exposed all profile columns, including Telegram and wallet data.
drop policy if exists "Profiles are viewable by everyone" on public.profiles;

-- Keep staff gamification editing, but scope the formerly global FOR ALL policy to admin/owner.
drop policy if exists admin_full_access on public.game_attendance;
create policy admin_full_access
  on public.game_attendance
  for all to authenticated
  using (public.is_voyage_admin())
  with check (public.is_voyage_admin());

create or replace function public.admin_set_user_ban(
  p_target uuid,
  p_duration text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_until timestamptz;
  v_permanent boolean := false;
begin
  if v_actor is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;

  select p.role::text into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  if p_target is null or p_target = v_actor then
    raise exception 'voyage:invalid_target' using errcode = '22023';
  end if;

  select p.role::text into v_target_role
  from public.profiles p
  where p.id = p_target
  for update;

  if not found then
    raise exception 'voyage:profile_not_found' using errcode = 'P0002';
  end if;

  if v_target_role = 'owner' then
    raise exception 'voyage:owner_cannot_be_banned' using errcode = '42501';
  end if;

  if v_actor_role <> 'owner' and v_target_role <> 'resident' then
    raise exception 'voyage:only_owner_can_ban_staff' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'voyage:ban_reason_required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'voyage:ban_reason_too_long' using errcode = '22023';
  end if;

  case p_duration
    when '24_hours' then v_until := now() + interval '24 hours';
    when '1_week'   then v_until := now() + interval '7 days';
    when '1_month'  then v_until := now() + interval '1 month';
    when 'forever'  then v_until := 'infinity'::timestamptz; v_permanent := true;
    else raise exception 'voyage:invalid_ban_duration' using errcode = '22023';
  end case;

  perform set_config('voyage.allow_ban_fields', 'on', true);

  update public.profiles
  set banned_until = v_until,
      ban_reason = v_reason,
      ban_permanent = v_permanent,
      ban_set_at = now(),
      ban_set_by = v_actor,
      updated_at = now()
  where id = p_target;

  insert into public.profile_ban_audit(profile_id, action, duration, reason, actor_id)
  values (p_target, 'banned', p_duration, v_reason, v_actor);

  return jsonb_build_object(
    'profile_id', p_target,
    'banned_until', case when v_permanent then 'infinity' else v_until::text end,
    'ban_permanent', v_permanent,
    'ban_reason', v_reason
  );
end;
$$;

alter function public.admin_set_user_ban(uuid, text, text) owner to postgres;
revoke all on function public.admin_set_user_ban(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_ban(uuid, text, text) to authenticated;

create or replace function public.admin_clear_user_ban(p_target uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_old_reason text;
begin
  if v_actor is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;

  select p.role::text into v_actor_role from public.profiles p where p.id = v_actor;
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_target is null or p_target = v_actor then
    raise exception 'voyage:invalid_target' using errcode = '22023';
  end if;

  select p.role::text, p.ban_reason
    into v_target_role, v_old_reason
  from public.profiles p
  where p.id = p_target
  for update;

  if not found then
    raise exception 'voyage:profile_not_found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'voyage:owner_ban_cannot_be_changed' using errcode = '42501';
  end if;
  if v_actor_role <> 'owner' and v_target_role <> 'resident' then
    raise exception 'voyage:only_owner_can_manage_staff_bans' using errcode = '42501';
  end if;

  perform set_config('voyage.allow_ban_fields', 'on', true);

  update public.profiles
  set banned_until = null,
      ban_reason = null,
      ban_permanent = false,
      ban_set_at = null,
      ban_set_by = null,
      updated_at = now()
  where id = p_target;

  insert into public.profile_ban_audit(profile_id, action, reason, actor_id)
  values (p_target, 'unbanned', v_old_reason, v_actor);

  return jsonb_build_object('profile_id', p_target, 'banned', false);
end;
$$;

alter function public.admin_clear_user_ban(uuid) owner to postgres;
revoke all on function public.admin_clear_user_ban(uuid) from public, anon;
grant execute on function public.admin_clear_user_ban(uuid) to authenticated;

-- Restrict the app-facing role management RPC: owner can change staff to admin/manager or demote to resident,
-- but cannot create another owner via this UI flow.
create or replace function public.admin_change_staff_role(
  p_target uuid,
  p_new_role public.app_role
) returns public.app_role
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
begin
  if v_actor is null or not public.voyage_is_founder() then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  if p_target is null or p_target = v_actor then
    raise exception 'voyage:invalid_target' using errcode = '22023';
  end if;
  if p_new_role not in ('admin', 'manager', 'resident') then
    raise exception 'voyage:invalid_new_role' using errcode = '22023';
  end if;

  select p.role::text into v_target_role
  from public.profiles p
  where p.id = p_target
  for update;
  if not found then
    raise exception 'voyage:profile_not_found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'voyage:cannot_change_owner' using errcode = '42501';
  end if;

  perform public.set_user_role(p_target, p_new_role);
  return p_new_role;
end;
$$;

alter function public.admin_change_staff_role(uuid, public.app_role) owner to postgres;
revoke all on function public.admin_change_staff_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_change_staff_role(uuid, public.app_role) to authenticated;

commit;
