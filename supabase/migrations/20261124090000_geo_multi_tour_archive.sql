-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · География: несколько туров в локации, архив локаций (24.11.2026)
-- supabase/migrations/20261124090000_geo_multi_tour_archive.sql
--
-- Только структура, данные локаций не меняются (это 20261124091000).
--
-- 1. tour_catalog: снят unique tour_catalog_map_hub_key — в одной локации
--    может быть несколько туров каталога. Вместо него обычный индекс.
-- 2. map_hubs: archived_at / archive_note / successor_hub_ids.
--    Архив = is_active = false (как и раньше); archived_at ставится и
--    снимается триггером, successor_hub_ids — куда «переехала» локация
--    (Turkey → {ankara, istanbul}). Связанные данные остаются на старом id.
-- 3. Физическое удаление локации, к которой что-то привязано (подписки,
--    заявки, туры, кастинги, лента, ответственные, managed_hubs),
--    запрещено: voyage:map_hub_in_use. Раньше удаление каскадом стирало
--    подписки и оставляло заявки без локации.
-- 4. Активная локация обязана иметь координаты X/Y в 0..100
--    (NOT VALID; проверяется в 20261124091000 после данных).
-- 5. Новая заявка на карте — только на существующую активную локацию.
--    Старые заявки (смена статуса, завершение, начисление) не затронуты.
-- 6. voyage_map_hub_directory(): одна строка на локацию при любом числе
--    туров (+ tours_active, tours, is_active). Архивные локации видны
--    только той, кто на них подписана, — чтобы можно было отписаться.
-- 7. Индекс кастингов тура по датам.
--
-- Требует 20261106090000_map_hub_subscriptions.sql. Идемпотентна.
-- Права: у map_hubs и tour_catalog табличные гранты (колоночных нет),
-- новые колонки отдельных грантов не требуют; запись по-прежнему RLS
-- (admin/owner).
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regclass('public.map_hub_subscriptions') is null
     or to_regprocedure('public.voyage_map_hub_directory()') is null then
    raise exception 'Сначала примените 20261106090000_map_hub_subscriptions.sql';
  end if;
end $$;

/* ── 1. Несколько туров в локации ──────────────────────────────────── */

drop index if exists public.tour_catalog_map_hub_key;

create index if not exists tour_catalog_map_hub_idx
  on public.tour_catalog (map_hub_id, is_active, sort_order)
  where map_hub_id is not null;

comment on column public.tour_catalog.map_hub_id is
  'Локация тура из /admin/map-locations (map_hubs). Город, регион и страна тура берутся из неё. В одной локации может быть несколько туров (с 24.11.2026).';

/* ── 2. Архив локаций ─────────────────────────────────────────────── */

alter table public.map_hubs add column if not exists archived_at timestamptz;
alter table public.map_hubs add column if not exists archive_note text;
alter table public.map_hubs add column if not exists successor_hub_ids text[] not null default '{}'::text[];

alter table public.map_hubs drop constraint if exists map_hubs_archive_note_check;
alter table public.map_hubs add constraint map_hubs_archive_note_check
  check (archive_note is null or char_length(archive_note) <= 500);

alter table public.map_hubs drop constraint if exists map_hubs_successors_check;
alter table public.map_hubs add constraint map_hubs_successors_check
  check (cardinality(successor_hub_ids) <= 10 and not (id = any (successor_hub_ids)));

comment on column public.map_hubs.archived_at is
  'Когда локация выведена из активной географии (is_active=false). Ставит и снимает триггер map_hubs_archive_stamp. Запись не удаляется.';
comment on column public.map_hubs.archive_note is 'Причина архивации (для админки).';
comment on column public.map_hubs.successor_hub_ids is
  'Локации-преемники архивной локации (Turkey → ankara, istanbul). Справочно: связанные подписки, заявки и туры автоматически не переносятся.';

create or replace function public.map_hubs_archive_stamp()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if coalesce(new.is_active, true) then
    new.archived_at := null;
  elsif new.archived_at is null then
    new.archived_at := now();
  end if;
  new.successor_hub_ids := coalesce(new.successor_hub_ids, '{}'::text[]);
  if exists (
    select 1 from unnest(new.successor_hub_ids) s(hub)
     where not exists (select 1 from public.map_hubs h where h.id = s.hub)
  ) then
    raise exception 'voyage:map_hub_successor_not_found' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists map_hubs_archive_stamp on public.map_hubs;
create trigger map_hubs_archive_stamp
  before insert or update of is_active, archived_at, successor_hub_ids on public.map_hubs
  for each row execute function public.map_hubs_archive_stamp();

-- Уже выключенные локации получают дату архива (один раз)
update public.map_hubs set archived_at = now()
 where not coalesce(is_active, true) and archived_at is null;

/* ── 3. Запрет удаления локации с данными ──────────────────────────── */

-- Что привязано к локации (для админки и для запрета удаления)
create or replace function public.voyage_map_hub_usage(p_hub text)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'subscriptions', (select count(*) from public.map_hub_subscriptions s where s.hub_id = p_hub),
    'applications',  (select count(*) from public.applications a where a.hub_id = p_hub),
    'catalog_tours', (select count(*) from public.tour_catalog t where t.map_hub_id = p_hub),
    'castings',      (select count(*) from public.partner_castings c where c.map_hub_id = p_hub),
    'feed',          (select count(*) from public.resident_location_feed f where f.hub_id = p_hub),
    'staff_slots',   (select count(*) from public.map_hub_assignments m where m.hub_id = p_hub),
    'managers',      (select count(*) from public.profiles p where p_hub = any (coalesce(p.managed_hubs, '{}'::text[]))),
    'successor_of',  (select count(*) from public.map_hubs h where p_hub = any (h.successor_hub_ids))
  )
$$;

revoke all on function public.voyage_map_hub_usage(text) from public, anon, authenticated;
grant execute on function public.voyage_map_hub_usage(text) to service_role;

-- Админке: счётчики только для owner/admin
create or replace function public.voyage_map_hub_usage_admin(p_hub text)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  return public.voyage_map_hub_usage(p_hub);
end;
$$;

revoke all on function public.voyage_map_hub_usage_admin(text) from public, anon;
grant execute on function public.voyage_map_hub_usage_admin(text) to authenticated;

create or replace function public.map_hubs_guard_delete()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  u jsonb := public.voyage_map_hub_usage(old.id);
begin
  if exists (select 1 from jsonb_each_text(u) e where e.value::bigint > 0) then
    raise exception 'voyage:map_hub_in_use' using errcode = '23503',
      detail = u::text,
      hint = 'Локацию с данными нельзя удалить — выключите её (архив, is_active = false).';
  end if;
  return old;
end;
$$;

revoke all on function public.map_hubs_guard_delete() from public, anon, authenticated;

drop trigger if exists map_hubs_guard_delete on public.map_hubs;
create trigger map_hubs_guard_delete
  before delete on public.map_hubs
  for each row execute function public.map_hubs_guard_delete();

/* ── 4. Координаты у активной локации ──────────────────────────────── */

alter table public.map_hubs drop constraint if exists map_hubs_active_xy_check;
alter table public.map_hubs add constraint map_hubs_active_xy_check
  check (not coalesce(is_active, true)
         or (x is not null and y is not null and x between 0 and 100 and y between 0 and 100))
  not valid;

comment on constraint map_hubs_active_xy_check on public.map_hubs is
  'Активная локация обязана иметь X/Y в процентах 0..100 (позиция точки на картинке региона /map-<region>.jpg).';

/* ── 5. Новая заявка — только на активную локацию ──────────────────── */

create or replace function public.applications_guard_hub()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if not exists (
    select 1 from public.map_hubs h
     where h.id = new.hub_id and coalesce(h.is_active, true)
  ) then
    raise exception 'voyage:map_hub_inactive' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_guard_hub on public.applications;
create trigger applications_guard_hub
  before insert on public.applications
  for each row execute function public.applications_guard_hub();

/* ── 6. Справочник локаций для резидентки ──────────────────────────── */

drop function if exists public.voyage_map_hub_directory();

create function public.voyage_map_hub_directory()
returns table (
  id text,
  name jsonb,
  subtitle jsonb,
  region text,
  country_code text,
  subscribed boolean,
  tour_id uuid,          -- первый активный тур (совместимость со старым клиентом)
  tour_title jsonb,
  open_castings integer,
  tours_active integer,
  tours jsonb,           -- [{id, title_i18n, project, audience}] активные туры локации
  is_active boolean
)
language sql stable security definer
set search_path to ''
as $$
  select h.id, coalesce(h.name, '{}'::jsonb), coalesce(h.subtitle, '{}'::jsonb), h.region, h.country_code,
         s.profile_id is not null,
         tt.first_id, tt.first_title,
         (select count(*)::int from public.partner_castings c
           where c.map_hub_id = h.id and c.status = 'open' and c.closes_at > now()),
         coalesce(tt.n, 0),
         coalesce(tt.list, '[]'::jsonb),
         coalesce(h.is_active, true)
    from public.map_hubs h
    left join public.map_hub_subscriptions s on s.hub_id = h.id and s.profile_id = auth.uid()
    left join lateral (
      select count(*)::int as n,
             (array_agg(t.id order by t.sort_order, t.created_at))[1] as first_id,
             (array_agg(t.title_i18n order by t.sort_order, t.created_at))[1] as first_title,
             jsonb_agg(jsonb_build_object('id', t.id, 'title_i18n', t.title_i18n,
                                          'project', t.project_type, 'audience', t.audience_segment)
                       order by t.sort_order, t.created_at) as list
        from public.tour_catalog t
       where t.map_hub_id = h.id and t.is_active
    ) tt on true
   where auth.uid() is not null
     and (coalesce(h.is_active, true) or s.profile_id is not null)
   order by h.region, h.country_code nulls last, h.id
$$;

revoke all on function public.voyage_map_hub_directory() from public, anon;
grant execute on function public.voyage_map_hub_directory() to authenticated;

/* ── 7. Кастинги тура по датам ─────────────────────────────────────── */

create index if not exists partner_castings_catalog_tour_dates_idx
  on public.partner_castings (catalog_tour_id, starts_on)
  where catalog_tour_id is not null;

commit;
