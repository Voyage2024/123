-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Личные настройки участника: Telegram-оповещения и приватность
-- supabase/migrations/20261020090000_member_preferences.sql
--
--   member_preferences      одна строка на профиль (резидент или персонал)
--     резидент              notify_tours · notify_parties · notify_approvals · notify_points
--     менеджер              notify_casting_responses · notify_contract_signed ·
--                           notify_docs_uploaded · notify_reviews · notify_map_applications
--     приватность           hide_points — скрыть баллы и рейтинг от других резидентов
--
--   Нет строки = всё включено, ничего не скрыто (значения по умолчанию).
--   Пишет только сам владелец строки (RLS); персонал читает — чтобы видеть,
--   почему участнице не ушло уведомление.
--
--   v_global_leaderboard и get_segmented_tour_leaderboard получают колонку
--   points_hidden: цифры скрывшей баллы резидентки видят только она сама
--   и персонал клуба. Место в рейтинге сохраняется — порядок списка не ломается.
-- ════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.member_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,

  -- резидент
  notify_tours boolean not null default true,
  notify_parties boolean not null default true,
  notify_approvals boolean not null default true,
  notify_points boolean not null default true,

  -- менеджер / партнёр
  notify_casting_responses boolean not null default true,
  notify_contract_signed boolean not null default true,
  notify_docs_uploaded boolean not null default true,
  notify_reviews boolean not null default true,
  notify_map_applications boolean not null default true,

  -- приватность
  hide_points boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.member_preferences is
  'Per-profile Telegram notification opt-outs and privacy flags. Missing row = defaults (everything on, nothing hidden).';
comment on column public.member_preferences.hide_points is
  'Resident hides Influence Index, points and reliability from other residents; staff and the resident herself still see them.';

drop trigger if exists member_preferences_touch on public.member_preferences;
create trigger member_preferences_touch
  before update on public.member_preferences
  for each row execute function public.set_updated_at();

alter table public.member_preferences enable row level security;

drop policy if exists member_preferences_select on public.member_preferences;
create policy member_preferences_select on public.member_preferences
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.game_is_staff()));

drop policy if exists member_preferences_insert on public.member_preferences;
create policy member_preferences_insert on public.member_preferences
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists member_preferences_update on public.member_preferences;
create policy member_preferences_update on public.member_preferences
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke all on public.member_preferences from anon;
grant select, insert, update on public.member_preferences to authenticated;
grant all on public.member_preferences to service_role;

/* ── Хелперы ─────────────────────────────────────────────────────── */

-- Скрывает ли резидентка цифры от текущего зрителя
create or replace function public.voyage_points_hidden_for_viewer(p_profile uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select coalesce((
    select mp.hide_points
    from public.member_preferences mp
    where mp.profile_id = p_profile
  ), false)
  and p_profile is distinct from auth.uid()
  and not coalesce(public.game_is_staff(), false)
$$;

grant execute on function public.voyage_points_hidden_for_viewer(uuid) to authenticated, service_role;

/* ── Глобальный рейтинг: те же колонки + points_hidden в конце ──────── */

create or replace view public.v_global_leaderboard as
 with legacy as (
         select p.id as profile_id,
            p.full_name,
            p.avatar_url,
            coalesce(rm.stamp_points, coalesce(b.stamp_points, 0)) as stamp_points,
            coalesce(rm.combo_points, coalesce(b.combo_points, 0)) as combo_points,
            coalesce(rm.total_points, (coalesce(b.base_influence, 0) + coalesce(pt.patronage_points, 0))) as total_influence,
            coalesce(rm.stamps_count, coalesce(b.stamps_count, 0)) as stamps_count,
            coalesce(rm.destinations_count, coalesce(b.destinations_count, 0)) as destinations_count,
            coalesce(rm.combos_completed, coalesce(b.combos_completed, 0)) as combos_completed,
            coalesce(rm.patronage_points, coalesce(pt.patronage_points, 0)) as patronage_points,
            coalesce(rm.proteges_count, coalesce(pt.proteges_count, 0)) as proteges_count,
            coalesce(rm.tour_points, coalesce(b.tour_points, 0)) as tour_points,
            coalesce(rm.tours_count, coalesce(b.tours_count, 0)) as tours_count,
            coalesce(p.segment, 'working'::text) as segment,
            (coalesce(p.reliability, (100)::numeric))::numeric(5,2) as reliability,
            (coalesce((p.level)::integer, 1))::smallint as profile_level,
            coalesce(nullif(p.circle, ''::text), 'voyager'::text) as profile_circle,
            public.voyage_points_hidden_for_viewer(p.id) as hidden
           from (((public.profiles p
             left join public.resident_metrics rm on ((rm.profile_id = p.id)))
             left join public.game_base_influence b on ((b.profile_id = p.id)))
             left join ( select cip.patron_id as profile_id,
                    (sum(cip.dividends))::integer as patronage_points,
                    (count(*) filter (where (cip.status = 'approved'::text)))::integer as proteges_count
                   from public.club_invite_progress cip
                  where (cip.patron_id is not null)
                  group by cip.patron_id) pt on ((pt.profile_id = p.id)))
          where (p.role = 'resident'::public.app_role)
        )
 select l.profile_id,
    case when l.hidden then null else l.total_influence end as total_influence,
    coalesce(cur.title, 'Voyager'::text) as rank_title,
    coalesce(cur.level, 1) as level,
    coalesce(cur.key, 'voyager'::text) as circle_key,
    case when l.hidden then null else nxt.min_influence end as next_level_at,
    case when l.hidden then null else l.stamp_points end as stamp_points,
    case when l.hidden then null else l.combo_points end as combo_points,
    case when l.hidden then null else l.stamps_count end as stamps_count,
    case when l.hidden then null else l.destinations_count end as destinations_count,
    case when l.hidden then null else l.combos_completed end as combos_completed,
    (rank() over (order by l.total_influence desc))::integer as "position",
    l.full_name,
    l.avatar_url,
    case when l.hidden then null else l.patronage_points end as patronage_points,
    case when l.hidden then null else l.proteges_count end as proteges_count,
    case when l.hidden then null else l.tour_points end as tour_points,
    case when l.hidden then null else l.tours_count end as tours_count,
    l.segment,
    (case when l.hidden then null else l.reliability end)::numeric(5,2) as reliability,
    l.profile_level,
    l.profile_circle,
    (rank() over (partition by l.segment order by l.total_influence desc))::integer as segment_position,
    l.hidden as points_hidden
   from ((legacy l
     left join lateral ( select gc.level,
            gc.key,
            gc.title
           from public.game_circles gc
          where (gc.min_influence <= l.total_influence)
          order by gc.min_influence desc, gc.level desc
         limit 1) cur on (true))
     left join lateral ( select gc.min_influence
           from public.game_circles gc
          where (gc.min_influence > l.total_influence)
          order by gc.min_influence
         limit 1) nxt on (true));

comment on column public.v_global_leaderboard.points_hidden is
  'True when the resident hid her numbers and the viewer is neither her nor staff: numeric columns are NULL.';

/* ── Рейтинг тура: + points_hidden ───────────────────────────────── */

drop function if exists public.get_segmented_tour_leaderboard(text, integer);

create function public.get_segmented_tour_leaderboard(p_segment text default 'working'::text, p_limit integer default 50)
returns table("position" integer, full_name text, avatar_url text, tour_points integer, is_me boolean, profile_id uuid,
              segment text, level integer, circle_key text, circle_title text, reliability numeric, influence integer,
              influence_index integer, index_points integer, tour_id text, tour_title text, points_hidden boolean)
language plpgsql stable security definer
set search_path to ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_segment text := lower(coalesce(nullif(btrim(p_segment), ''), 'working'));
begin
  if auth.uid() is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if v_segment not in ('working', 'elite') then
    raise exception 'invalid_segment' using errcode = '22023';
  end if;

  return query
  with ranked as (
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.segment::text as resident_segment,
      p.level::integer as resident_level,
      coalesce(nullif(p.circle, ''), 'voyager')::text as resident_circle,
      coalesce(p.reliability, 100)::numeric(5,2) as resident_reliability,
      case when v_segment = 'elite'
        then coalesce(rm.event_points, 0)
        else coalesce(rm.tour_points, 0)
      end::integer as segment_points,
      greatest(coalesce(rm.total_points, p.influence_index, 0), 0)::integer as influence_score,
      public.voyage_points_hidden_for_viewer(p.id) as hidden,
      row_number() over (
        order by
          case when v_segment = 'elite' then coalesce(rm.event_points, 0) else coalesce(rm.tour_points, 0) end desc,
          p.full_name asc nulls last,
          p.id
      )::integer as pos
    from public.profiles p
    left join public.resident_metrics rm on rm.profile_id = p.id
    where p.role = 'resident'::public.app_role
      and p.segment = v_segment
  )
  select
    r.pos,
    r.full_name,
    r.avatar_url,
    case when r.hidden then null else r.segment_points end,
    r.id = auth.uid(),
    r.id,
    r.resident_segment,
    r.resident_level,
    coalesce(gc.key, r.resident_circle, 'voyager'),
    coalesce(gc.title, case r.resident_level
      when 6 then 'Black Circle'
      when 5 then 'Private Circle'
      when 4 then 'Inner Circle'
      when 3 then 'Preferred'
      when 2 then 'Resident'
      else 'Voyager'
    end),
    case when r.hidden then null else r.resident_reliability end,
    case when r.hidden then null else r.influence_score end,
    case when r.hidden then null else r.influence_score end,
    case when r.hidden then null else r.segment_points end,
    null::text,
    null::text,
    r.hidden
  from ranked r
  left join public.game_circles gc on gc.level = r.resident_level
  where r.pos <= v_limit or r.id = auth.uid()
  order by r.pos;
end;
$function$;

revoke all on function public.get_segmented_tour_leaderboard(text, integer) from public, anon;
grant execute on function public.get_segmented_tour_leaderboard(text, integer) to authenticated, service_role;

commit;
