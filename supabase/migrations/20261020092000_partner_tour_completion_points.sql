-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Баллы за тур менеджера: начисление в момент закрытия комнаты
-- supabase/migrations/20261020092000_partner_tour_completion_points.sql
--
-- Раньше баллы приходили только из applications / event_applications
-- (status → completed). Туры менеджеров (partner_tours) в рейтинг не попадали.
--
-- Теперь:
--   partner_tours.status → 'closed'  (или 'completed' — нормализуется в 'closed')
--     каждая участница со статусом 'flown' получает resident_activities
--     (activity_type 'tour') → resident_process_activity(): баллы по формуле,
--     штамп страны, комбо, ачивки, пересчёт уровня. Всё — в той же транзакции.
--   partner_tour_members.status → 'flown' уже после закрытия тура
--     (админ поправил итог) — начисляется этой участнице.
--   Повторное закрытие / повторный 'flown' не начисляют дважды:
--     resident_activities.source_partner_member_id уникален, event_key
--     'activity:<id>' в ledger тоже.
--
--   partner_close_tour(p_tour, p_outcomes, p_country_code) — RPC для кнопки
--   «Закрыть тур» в комнате: менеджер отмечает, кто долетел, кто сорвался,
--   и закрывает тур одним вызовом (участниц напрямую менять может только админ).
--
-- Формула та же, что для обычных туров:
--   commercial_value = гонорар из последней версии контракта (terms.fee_amount),
--                      иначе гонорар кастинга
--   destination_code = partner_tours.country_code, иначе game_destinations по городу
--   complexity       = partner_tours.complexity_score (1…3, меняет только админ)
-- ════════════════════════════════════════════════════════════════════

begin;

/* ── Схема ───────────────────────────────────────────────────────── */

alter table public.partner_tours
  add column if not exists country_code text,
  add column if not exists complexity_score numeric(4,2) not null default 1,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null;

alter table public.partner_tours drop constraint if exists partner_tours_country_code_check;
alter table public.partner_tours add constraint partner_tours_country_code_check
  check (country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.partner_tours drop constraint if exists partner_tours_complexity_check;
alter table public.partner_tours add constraint partner_tours_complexity_check
  check (complexity_score >= 1 and complexity_score <= 3);

comment on column public.partner_tours.country_code is 'ISO 3166-1 alpha-2 of the tour destination; drives the passport stamp when the tour closes.';
comment on column public.partner_tours.complexity_score is 'Scoring multiplier 1..3 for closed-tour points. Admin-managed.';

alter table public.resident_activities
  add column if not exists source_partner_member_id uuid,
  add column if not exists source_partner_tour_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'resident_activities_source_partner_member_id_fkey') then
    alter table public.resident_activities
      add constraint resident_activities_source_partner_member_id_fkey
      foreign key (source_partner_member_id) references public.partner_tour_members(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'resident_activities_source_partner_member_id_key') then
    alter table public.resident_activities
      add constraint resident_activities_source_partner_member_id_key unique (source_partner_member_id);
  end if;
end $$;

create index if not exists resident_activities_partner_tour_idx
  on public.resident_activities (source_partner_tour_id) where source_partner_tour_id is not null;

-- Ровно один источник. Для тура менеджера: участница или (если тур потом удалили
-- вместе с составом) хотя бы id тура — баллы в ledger при этом сохраняются.
alter table public.resident_activities drop constraint if exists resident_activities_one_source_check;
alter table public.resident_activities add constraint resident_activities_one_source_check check (
  num_nonnulls(source_application_id, source_event_application_id, source_partner_member_id) = 1
  or (
    num_nonnulls(source_application_id, source_event_application_id, source_partner_member_id) = 0
    and source_partner_tour_id is not null
  )
);

/* ── Начисление одной участнице ─────────────────────────────────── */

create or replace function public.voyage_award_partner_member(p_member uuid)
returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare
  m public.partner_tour_members%rowtype;
  t public.partner_tours%rowtype;
  v_country text;
  v_value numeric(12,2);
  v_reliability numeric(5,2);
  v_label text;
  v_activity uuid;
begin
  select * into m from public.partner_tour_members where id = p_member;
  if not found or m.status <> 'flown' then return null; end if;
  select * into t from public.partner_tours where id = m.tour_id;
  if not found or t.status <> 'closed' then return null; end if;

  -- Только резидентки клуба
  if not exists (select 1 from public.profiles p where p.id = m.resident_id and p.role = 'resident') then
    return null;
  end if;

  v_country := t.country_code;
  if v_country is null then
    select upper(coalesce(nullif(d.country_code, ''), case when d.code ~* '^[A-Z]{2}$' then d.code end))
      into v_country
      from public.game_destinations d
     where d.active and lower(btrim(d.name)) = lower(btrim(t.city))
     order by d.sort_order
     limit 1;
  end if;
  if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;

  select case when (c.terms ->> 'fee_amount') ~ '^\d+(\.\d+)?$' then (c.terms ->> 'fee_amount')::numeric end
    into v_value
    from public.partner_contracts c
   where c.tour_id = t.id
   order by c.version desc
   limit 1;
  if v_value is null and t.casting_id is not null then
    select pc.fee_amount into v_value from public.partner_castings pc where pc.id = t.casting_id;
  end if;
  v_value := least(greatest(coalesce(v_value, 0), 0), 100000000);

  select coalesce(p.reliability, 100)::numeric(5,2) into v_reliability
    from public.profiles p where p.id = m.resident_id;

  v_label := t.city || ' · ' || case t.project_type
    when 'shoot' then 'Съёмка' when 'show' then 'Показ'
    when 'campaign' then 'Кампейн' when 'event' then 'Ивент' else t.project_type end;

  insert into public.resident_activities (
    profile_id, activity_type, source_partner_member_id, source_partner_tour_id, source_label,
    destination_code, commercial_value, complexity_score, reliability_snapshot, completed_by, completed_at
  ) values (
    m.resident_id, 'tour', m.id, t.id, v_label,
    v_country, v_value, greatest(1, least(3, coalesce(t.complexity_score, 1))),
    coalesce(v_reliability, 100), coalesce(t.closed_by, auth.uid(), t.manager_id), coalesce(t.closed_at, now())
  )
  on conflict (source_partner_member_id) do nothing
  returning id into v_activity;

  if v_activity is not null then
    perform public.resident_process_activity(v_activity);
  end if;
  return v_activity;
end;
$$;

revoke all on function public.voyage_award_partner_member(uuid) from public, anon, authenticated;
grant execute on function public.voyage_award_partner_member(uuid) to service_role;

/* ── Триггеры ────────────────────────────────────────────────────── */

-- 'completed' — синоним 'closed'; фиксируем, кто и когда закрыл
create or replace function public.partner_tours_before_close()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.status = 'completed' then
    new.status := 'closed';
  end if;

  if new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at := now();
    new.closed_by := coalesce(auth.uid(), new.closed_by, new.manager_id);
  elsif old.status = 'closed' and new.status is distinct from 'closed' then
    raise exception 'voyage:tour_already_closed' using errcode = '23514';
  end if;

  -- Коэффициент сложности влияет на баллы — его меняет только админ
  if new.complexity_score is distinct from old.complexity_score
     and auth.uid() is not null and not coalesce(public.is_admin(), false) then
    raise exception 'voyage:complexity_admin_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists partner_tours_before_close on public.partner_tours;
create trigger partner_tours_before_close
  before update on public.partner_tours
  for each row execute function public.partner_tours_before_close();

create or replace function public.partner_tours_award_on_close()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_member uuid;
begin
  for v_member in
    select m.id from public.partner_tour_members m
     where m.tour_id = new.id and m.status = 'flown'
     order by m.joined_at
  loop
    perform public.voyage_award_partner_member(v_member);
  end loop;
  return null;
end;
$$;

drop trigger if exists partner_tours_award_on_close on public.partner_tours;
create trigger partner_tours_award_on_close
  after update of status on public.partner_tours
  for each row when (new.status = 'closed' and old.status is distinct from 'closed')
  execute function public.partner_tours_award_on_close();

create or replace function public.partner_members_award_on_flown()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  perform public.voyage_award_partner_member(new.id);
  return null;
end;
$$;

drop trigger if exists partner_members_award_on_flown on public.partner_tour_members;
create trigger partner_members_award_on_flown
  after update of status on public.partner_tour_members
  for each row when (new.status = 'flown' and old.status is distinct from 'flown')
  execute function public.partner_members_award_on_flown();

revoke all on function public.partner_tours_award_on_close() from public, anon, authenticated;
revoke all on function public.partner_members_award_on_flown() from public, anon, authenticated;

/* ── RPC «Закрыть тур» ───────────────────────────────────────────── */

-- p_outcomes: {"<resident_id>": "flown" | "late_drop" | "no_show" | "released", ...}
-- Участницы со статусом confirmed, которых нет в p_outcomes, считаются долетевшими.
create or replace function public.partner_close_tour(
  p_tour uuid,
  p_outcomes jsonb default '{}'::jsonb,
  p_country_code text default null
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  t public.partner_tours%rowtype;
  v_country text := nullif(upper(btrim(coalesce(p_country_code, ''))), '');
  v_key text;
  v_value text;
  v_flown int;
  v_dropped int;
  v_points int;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_outcomes is not null and jsonb_typeof(p_outcomes) <> 'object' then
    raise exception 'voyage:invalid_outcomes' using errcode = '22023';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'voyage:invalid_country' using errcode = '22023';
  end if;

  select * into t from public.partner_tours where id = p_tour for update;
  if not found then raise exception 'voyage:tour_not_found' using errcode = 'P0002'; end if;
  if not v_admin and t.manager_id <> me then
    raise exception 'voyage:forbidden_owner' using errcode = '42501';
  end if;
  if t.status = 'closed' then
    raise exception 'voyage:tour_already_closed' using errcode = 'P0001';
  end if;
  if t.status = 'cancelled' then
    raise exception 'voyage:tour_cancelled' using errcode = 'P0001';
  end if;
  if t.departs_at > now() then
    raise exception 'voyage:tour_not_started' using errcode = 'P0001';
  end if;

  -- Итоги по участницам: только известные статусы и только участницы этого тура
  for v_key, v_value in select key, value #>> '{}' from jsonb_each(coalesce(p_outcomes, '{}'::jsonb)) loop
    if v_value not in ('flown', 'late_drop', 'no_show', 'released') then
      raise exception 'voyage:invalid_outcome' using errcode = '22023';
    end if;
    if v_key !~* '^[0-9a-f-]{36}$' then
      raise exception 'voyage:invalid_outcomes' using errcode = '22023';
    end if;
    update public.partner_tour_members m
       set status = v_value
     where m.tour_id = t.id and m.resident_id = v_key::uuid and m.status = 'confirmed';
  end loop;

  update public.partner_tour_members m
     set status = 'flown'
   where m.tour_id = t.id and m.status = 'confirmed';

  update public.partner_tours
     set status = 'closed',
         country_code = coalesce(v_country, country_code)
   where id = t.id;

  select count(*) filter (where m.status = 'flown')::int,
         count(*) filter (where m.status in ('late_drop', 'no_show'))::int
    into v_flown, v_dropped
    from public.partner_tour_members m where m.tour_id = t.id;

  select coalesce(sum(a.points_awarded), 0)::int into v_points
    from public.resident_activities a where a.source_partner_tour_id = t.id;

  return jsonb_build_object('ok', true, 'tour_id', t.id, 'status', 'closed',
                            'flown', v_flown, 'dropped', v_dropped, 'points_awarded', v_points);
end;
$$;

revoke all on function public.partner_close_tour(uuid, jsonb, text) from public, anon;
grant execute on function public.partner_close_tour(uuid, jsonb, text) to authenticated, service_role;

commit;
