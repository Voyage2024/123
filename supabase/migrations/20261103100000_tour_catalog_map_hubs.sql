-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Туры каталога только из локаций карты (03.11.2026)
-- supabase/migrations/20261103100000_tour_catalog_map_hubs.sql
--
-- Источник направлений — локации туров из /admin/map-locations
-- (public.map_hubs). Статичный тур больше нельзя завести «руками»:
--
-- 1. tour_catalog.map_hub_id → map_hubs(id), уникально: одна локация —
--    один тур, дублей нет. Город (city) и регион (region) тура триггер
--    берёт из локации (название EN → RU → ES → PT → id), вручную их
--    не задать. country_code в map_hubs нет — поле больше не пишется.
-- 2. Локация переименована → город тура и кастингов под ним обновляются.
--    Локация выключена → её туры выключаются; включить тур можно только
--    при активной локации. Локация удалена → тур остаётся выключенным
--    без привязки (кастинги и история не теряются).
-- 3. Кастинг под тур всегда получает город тура (поле в форме только
--    для чтения); тур с выключенной локацией выбрать нельзя.
-- 4. Стартовые туры Dubai/Sydney из 20261103090000 привязываются к
--    локации с тем же id/названием; без пары и без кастингов — удаляются,
--    с кастингами — выключаются.
--
-- Требует 20261103090000_tour_catalog_casting_i18n_invites.sql.
-- Идемпотентна.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regclass('public.tour_catalog') is null then
    raise exception 'Сначала примените 20261103090000_tour_catalog_casting_i18n_invites.sql';
  end if;
end $$;

/* ── 0. Название локации → город ───────────────────────────────────── */

create or replace function public.voyage_map_hub_city(p_name jsonb, p_id text)
returns text
language sql immutable
set search_path to ''
as $$
  select left(coalesce(
    nullif(btrim(p_name ->> 'EN'), ''),
    nullif(btrim(p_name ->> 'RU'), ''),
    nullif(btrim(p_name ->> 'ES'), ''),
    nullif(btrim(p_name ->> 'PT'), ''),
    initcap(replace(p_id, '-', ' '))
  ), 60)
$$;

grant execute on function public.voyage_map_hub_city(jsonb, text) to authenticated, service_role;

/* ── 1. Привязка к локации ─────────────────────────────────────────── */

alter table public.tour_catalog add column if not exists map_hub_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tour_catalog_map_hub_fkey') then
    alter table public.tour_catalog
      add constraint tour_catalog_map_hub_fkey
      foreign key (map_hub_id) references public.map_hubs(id)
      on update cascade on delete set null;
  end if;
end $$;

create unique index if not exists tour_catalog_map_hub_key on public.tour_catalog (map_hub_id) where map_hub_id is not null;

comment on column public.tour_catalog.map_hub_id is
  'Локация тура из /admin/map-locations (map_hubs). Город и регион тура берутся из неё. Одна локация — один тур.';

-- Стартовые туры → локации с тем же id или названием
update public.tour_catalog t
   set map_hub_id = h.id
  from public.map_hubs h
 where t.map_hub_id is null
   and (lower(h.id) = t.slug
        or lower(public.voyage_map_hub_city(h.name, h.id)) = lower(t.city)
        or lower(coalesce(h.name ->> 'RU', '')) = lower(t.city))
   and not exists (select 1 from public.tour_catalog x where x.map_hub_id = h.id);

delete from public.tour_catalog t
 where t.map_hub_id is null
   and not exists (select 1 from public.partner_castings c where c.catalog_tour_id = t.id);

update public.tour_catalog set is_active = false where map_hub_id is null and is_active;

/* ── 2. Тур ← локация ──────────────────────────────────────────────── */

create or replace function public.tour_catalog_sync_hub()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_hub public.map_hubs%rowtype;
begin
  if new.map_hub_id is null then
    if tg_op = 'INSERT' then
      raise exception 'voyage:map_hub_required' using errcode = '23514';
    end if;
    -- Локацию удалили (FK on delete set null) или тур старый: только выключенный.
    new.is_active := false;
    return new;
  end if;

  select * into v_hub from public.map_hubs h where h.id = new.map_hub_id;
  if not found then
    raise exception 'voyage:map_hub_not_found' using errcode = '23503';
  end if;

  new.city := public.voyage_map_hub_city(v_hub.name, v_hub.id);
  new.region := left(nullif(btrim(coalesce(v_hub.region, '')), ''), 60);
  new.country_code := null;

  if new.is_active and not coalesce(v_hub.is_active, true) then
    raise exception 'voyage:map_hub_inactive' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tour_catalog_sync_hub on public.tour_catalog;
create trigger tour_catalog_sync_hub
  before insert or update on public.tour_catalog
  for each row execute function public.tour_catalog_sync_hub();

-- Локация → туры и их кастинги
create or replace function public.map_hubs_sync_tour_catalog()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_city text := public.voyage_map_hub_city(new.name, new.id);
begin
  if new.name is distinct from old.name or new.region is distinct from old.region then
    update public.tour_catalog t
       set city = v_city
     where t.map_hub_id = new.id;
    -- Открытые кастинги под туром этой локации получают новое название города
    update public.partner_castings c
       set city = v_city
      from public.tour_catalog t
     where t.map_hub_id = new.id
       and c.catalog_tour_id = t.id
       and c.status in ('open', 'shortlist')
       and c.city is distinct from v_city;
  end if;
  if coalesce(old.is_active, true) and not coalesce(new.is_active, true) then
    update public.tour_catalog set is_active = false where map_hub_id = new.id and is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists map_hubs_sync_tour_catalog on public.map_hubs;
create trigger map_hubs_sync_tour_catalog
  after update on public.map_hubs
  for each row execute function public.map_hubs_sync_tour_catalog();

-- Прогон триггера по существующим строкам: город/регион из локации
update public.tour_catalog t
   set updated_at = now(),
       is_active = t.is_active and coalesce(h.is_active, true)
  from public.map_hubs h
 where h.id = t.map_hub_id;

/* ── 3. Кастинг: город всегда из тура ──────────────────────────────── */

create or replace function public.partner_castings_sync_i18n()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_tour public.tour_catalog%rowtype;
  v_hub_active boolean;
  v_text text;
begin
  new.title_i18n := coalesce(new.title_i18n, '{}'::jsonb);
  new.brief_i18n := coalesce(new.brief_i18n, '{}'::jsonb);
  new.source_lang := upper(coalesce(new.source_lang, 'RU'));

  if new.catalog_tour_id is not null then
    select * into v_tour from public.tour_catalog t where t.id = new.catalog_tour_id;
    if tg_op = 'INSERT' or new.catalog_tour_id is distinct from old.catalog_tour_id then
      select coalesce(h.is_active, true) into v_hub_active from public.map_hubs h where h.id = v_tour.map_hub_id;
      if v_tour.id is null or not v_tour.is_active or v_tour.map_hub_id is null or not coalesce(v_hub_active, false) then
        raise exception 'voyage:catalog_tour_inactive' using errcode = '23514';
      end if;
    end if;
    -- Направление задаёт локация карты: город кастинга = город тура.
    if v_tour.id is not null and (tg_op = 'INSERT' or new.status in ('open', 'shortlist')) then
      new.city := v_tour.city;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.brief is distinct from old.brief
     and new.brief_i18n = old.brief_i18n then
    new.brief_i18n := case
      when new.brief is null or btrim(new.brief) = '' then new.brief_i18n - new.source_lang
      else jsonb_set(new.brief_i18n, array[new.source_lang], to_jsonb(left(btrim(new.brief), 2000)))
    end;
  elsif tg_op = 'INSERT' and new.brief_i18n = '{}'::jsonb and new.brief is not null and btrim(new.brief) <> '' then
    new.brief_i18n := jsonb_build_object(new.source_lang, left(btrim(new.brief), 2000));
  end if;

  if public.voyage_i18n_has_text(new.brief_i18n) then
    v_text := public.voyage_i18n_pick(new.brief_i18n, new.source_lang, new.source_lang);
    new.brief := left(v_text, 2000);
  elsif tg_op = 'UPDATE' and new.brief_i18n is distinct from old.brief_i18n then
    new.brief := null;
  end if;
  return new;
end;
$$;

/* ── 4. Сводка тура в лентах — с локацией ──────────────────────────── */

create or replace function public.voyage_catalog_tour_brief(p_tour uuid)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'city', t.city, 'country_code', t.country_code,
    'map_hub_id', t.map_hub_id, 'region', t.region,
    'title_i18n', t.title_i18n, 'requirements_i18n', t.requirements_i18n, 'conditions_i18n', t.conditions_i18n
  )
  from public.tour_catalog t where t.id = p_tour
$$;

revoke all on function public.voyage_catalog_tour_brief(uuid) from public, anon;
grant execute on function public.voyage_catalog_tour_brief(uuid) to authenticated, service_role;

commit;
