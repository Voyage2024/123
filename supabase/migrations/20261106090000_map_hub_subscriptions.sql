-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Страна у локаций, кастинг только под тур, подписки резиденток
-- на локации карты, лента локаций и Telegram (06.11.2026)
-- supabase/migrations/20261106090000_map_hub_subscriptions.sql
--
-- 1. map_hubs.country_code (ISO-3166 alpha-2). Локация = страна + город.
--    Для известных городов страна проставляется сама; остальные admin
--    заполняет в /admin/map-locations. Тур нельзя создать или включить
--    на локации без страны; tour_catalog.country_code = страна локации.
--    У локации, к которой привязан тур, страну нельзя стереть.
-- 2. partner_castings.map_hub_id ставит база из тура. Новый кастинг без
--    тура каталога создать нельзя (voyage:catalog_tour_required), тур у
--    кастинга нельзя снять. Старые кастинги без тура не трогаются.
-- 3. map_hub_subscriptions — подписка резидентки на локацию (до 50).
--    Подписаться можно только на активную локацию.
-- 4. resident_location_feed — внутренняя лента: «новый тур» / «открыт
--    кастинг» в локации, по строке на подписчицу, без дублей.
-- 5. Telegram: шаблон location_update через общую очередь
--    partner_notifications (вебхук partner_notifications_webhook), тумблер
--    member_preferences.notify_location_updates.
-- 6. Кто получает: подписчица локации, резидентка approved, без бана и
--    чёрного списка, не NPC, сегмент совпадает с аудиторией тура/кастинга.
--    Создатель не важен: менеджер, admin, owner, VOYAGE Management.
--
-- Требует 20261103100000_tour_catalog_map_hubs.sql. Идемпотентна.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tour_catalog' and column_name = 'map_hub_id'
  ) then
    raise exception 'Сначала примените 20261103100000_tour_catalog_map_hubs.sql';
  end if;
end $$;

/* ── 1. Страна локации ─────────────────────────────────────────────── */

alter table public.map_hubs add column if not exists country_code text;

alter table public.map_hubs drop constraint if exists map_hubs_country_code_check;
alter table public.map_hubs add constraint map_hubs_country_code_check
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

create index if not exists map_hubs_country_idx on public.map_hubs (country_code, region);

comment on column public.map_hubs.country_code is
  'Страна локации, ISO-3166 alpha-2 (AE, FR, …). Локация = страна + город (name). Без страны тур на локации не создаётся.';

-- Известные города → страна (только там, где страна ещё пустая)
with dict(city, cc) as (values
  ('dubai','AE'), ('abu-dhabi','AE'), ('sharjah','AE'), ('ras-al-khaimah','AE'),
  ('doha','QA'), ('riyadh','SA'), ('jeddah','SA'), ('alula','SA'), ('manama','BH'), ('bahrain','BH'),
  ('muscat','OM'), ('kuwait','KW'), ('kuwait-city','KW'), ('beirut','LB'), ('amman','JO'),
  ('cairo','EG'), ('marrakech','MA'), ('casablanca','MA'), ('istanbul','TR'), ('bodrum','TR'), ('tel-aviv','IL'),
  ('london','GB'), ('paris','FR'), ('nice','FR'), ('cannes','FR'), ('saint-tropez','FR'), ('st-tropez','FR'), ('courchevel','FR'),
  ('monaco','MC'), ('monte-carlo','MC'), ('milan','IT'), ('rome','IT'), ('sardinia','IT'), ('capri','IT'), ('porto-cervo','IT'),
  ('madrid','ES'), ('barcelona','ES'), ('marbella','ES'), ('ibiza','ES'), ('mallorca','ES'), ('lisbon','PT'), ('porto','PT'),
  ('mykonos','GR'), ('athens','GR'), ('santorini','GR'), ('geneva','CH'), ('zurich','CH'), ('st-moritz','CH'), ('gstaad','CH'),
  ('vienna','AT'), ('berlin','DE'), ('munich','DE'), ('amsterdam','NL'), ('prague','CZ'), ('budapest','HU'), ('warsaw','PL'),
  ('belgrade','RS'), ('tivat','ME'), ('budva','ME'), ('dubrovnik','HR'), ('split','HR'), ('limassol','CY'), ('cyprus','CY'),
  ('moscow','RU'), ('saint-petersburg','RU'), ('tbilisi','GE'), ('baku','AZ'), ('almaty','KZ'),
  ('new-york','US'), ('miami','US'), ('los-angeles','US'), ('las-vegas','US'), ('aspen','US'),
  ('toronto','CA'), ('mexico-city','MX'), ('cancun','MX'), ('tulum','MX'), ('sao-paulo','BR'), ('rio-de-janeiro','BR'), ('rio','BR'),
  ('buenos-aires','AR'), ('punta-del-este','UY'), ('st-barths','BL'), ('st-barth','BL'),
  ('sydney','AU'), ('melbourne','AU'), ('gold-coast','AU'), ('auckland','NZ'), ('tokyo','JP'), ('osaka','JP'), ('seoul','KR'),
  ('hong-kong','HK'), ('macau','MO'), ('macao','MO'), ('shanghai','CN'), ('beijing','CN'), ('singapore','SG'),
  ('bangkok','TH'), ('phuket','TH'), ('bali','ID'), ('jakarta','ID'), ('kuala-lumpur','MY'), ('manila','PH'),
  ('maldives','MV'), ('male','MV'), ('mumbai','IN'), ('goa','IN'), ('ho-chi-minh-city','VN'), ('seychelles','SC'), ('mauritius','MU')
)
update public.map_hubs h
   set country_code = d.cc
  from dict d
 where h.country_code is null
   and (lower(h.id) = d.city
        or lower(regexp_replace(btrim(coalesce(h.name ->> 'EN', '')), '[^A-Za-z]+', '-', 'g')) = d.city);

-- Тур ← локация: город, регион и теперь страна
create or replace function public.tour_catalog_sync_hub()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_hub public.map_hubs%rowtype;
  v_activating boolean;
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

  v_activating := tg_op = 'INSERT'
               or (new.is_active and not old.is_active)
               or new.map_hub_id is distinct from old.map_hub_id;

  -- Страна обязательна: при создании тура, при включении и при смене локации
  if v_hub.country_code is null and (tg_op = 'INSERT' or (v_activating and new.is_active)) then
    raise exception 'voyage:map_hub_country_required' using errcode = '23514';
  end if;

  new.city := public.voyage_map_hub_city(v_hub.name, v_hub.id);
  new.region := left(nullif(btrim(coalesce(v_hub.region, '')), ''), 60);
  new.country_code := v_hub.country_code;

  if new.is_active and not coalesce(v_hub.is_active, true) then
    raise exception 'voyage:map_hub_inactive' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Локация → туры и их кастинги (страна добавлена)
create or replace function public.map_hubs_sync_tour_catalog()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_city text := public.voyage_map_hub_city(new.name, new.id);
begin
  if new.name is distinct from old.name
     or new.region is distinct from old.region
     or new.country_code is distinct from old.country_code then
    update public.tour_catalog t
       set city = v_city
     where t.map_hub_id = new.id;
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

-- Страну локации с туром нельзя стереть
create or replace function public.map_hubs_guard_country()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.country_code := nullif(upper(btrim(coalesce(new.country_code, ''))), '');
  if tg_op = 'UPDATE' and new.country_code is null and old.country_code is not null
     and exists (select 1 from public.tour_catalog t where t.map_hub_id = new.id) then
    raise exception 'voyage:map_hub_country_in_use' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists map_hubs_guard_country on public.map_hubs;
create trigger map_hubs_guard_country
  before insert or update of country_code on public.map_hubs
  for each row execute function public.map_hubs_guard_country();

-- Прогон: страна в существующие туры
update public.tour_catalog t
   set updated_at = now()
  from public.map_hubs h
 where h.id = t.map_hub_id
   and t.country_code is distinct from h.country_code;

/* ── 2. Кастинг: локация из тура, без тура — нельзя ────────────────── */

alter table public.partner_castings add column if not exists map_hub_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partner_castings_map_hub_fkey') then
    alter table public.partner_castings
      add constraint partner_castings_map_hub_fkey
      foreign key (map_hub_id) references public.map_hubs(id)
      on update cascade on delete set null;
  end if;
end $$;

create index if not exists partner_castings_map_hub_idx on public.partner_castings (map_hub_id, status);

comment on column public.partner_castings.map_hub_id is
  'Локация карты кастинга. Ставит база из тура каталога (catalog_tour_id → tour_catalog.map_hub_id), клиент её не пишет.';

-- map_hub_id клиенту не выдаём: колонку пишет только триггер
revoke insert (map_hub_id), update (map_hub_id) on public.partner_castings from authenticated;

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

  -- Новый кастинг — только под тур каталога (а тур — только на локации карты)
  if new.catalog_tour_id is null then
    if tg_op = 'INSERT' then
      raise exception 'voyage:catalog_tour_required' using errcode = '23514';
    elsif old.catalog_tour_id is not null then
      raise exception 'voyage:catalog_tour_required' using errcode = '23514';
    end if;
    new.map_hub_id := null;
  end if;

  if new.catalog_tour_id is not null then
    select * into v_tour from public.tour_catalog t where t.id = new.catalog_tour_id;
    if tg_op = 'INSERT' or new.catalog_tour_id is distinct from old.catalog_tour_id then
      select coalesce(h.is_active, true) into v_hub_active from public.map_hubs h where h.id = v_tour.map_hub_id;
      if v_tour.id is null or not v_tour.is_active or v_tour.map_hub_id is null or not coalesce(v_hub_active, false) then
        raise exception 'voyage:catalog_tour_inactive' using errcode = '23514';
      end if;
    end if;
    -- Направление задаёт локация карты: город и локация кастинга = тура.
    new.map_hub_id := v_tour.map_hub_id;
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

-- Локация тура сменилась или удалена → кастинги под ним следуют за туром
create or replace function public.tour_catalog_sync_castings_hub()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if new.map_hub_id is distinct from old.map_hub_id then
    update public.partner_castings c
       set map_hub_id = new.map_hub_id
     where c.catalog_tour_id = new.id
       and c.map_hub_id is distinct from new.map_hub_id;
  end if;
  return null;
end;
$$;

drop trigger if exists tour_catalog_sync_castings_hub on public.tour_catalog;
create trigger tour_catalog_sync_castings_hub
  after update of map_hub_id on public.tour_catalog
  for each row execute function public.tour_catalog_sync_castings_hub();

-- Существующие кастинги под турами получают локацию
update public.partner_castings c
   set map_hub_id = t.map_hub_id
  from public.tour_catalog t
 where t.id = c.catalog_tour_id
   and c.map_hub_id is distinct from t.map_hub_id;

/* ── 3. Подписки на локации ────────────────────────────────────────── */

create table if not exists public.map_hub_subscriptions (
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  hub_id text not null references public.map_hubs(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, hub_id)
);

create index if not exists map_hub_subscriptions_hub_idx on public.map_hub_subscriptions (hub_id);

comment on table public.map_hub_subscriptions is
  'Подписки резиденток на локации карты: новый тур или открытый кастинг в локации → лента + Telegram (location_update).';

alter table public.map_hub_subscriptions enable row level security;

-- Может ли текущий пользователь подписаться на локацию
create or replace function public.voyage_can_subscribe_hub(p_hub text)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
           select 1 from public.profiles p
            where p.id = auth.uid() and p.role::text = 'resident' and not coalesce(p.is_npc, false)
         )
     and exists (select 1 from public.map_hubs h where h.id = p_hub and coalesce(h.is_active, true))
     and (select count(*) from public.map_hub_subscriptions s where s.profile_id = auth.uid()) < 50
$$;

revoke all on function public.voyage_can_subscribe_hub(text) from public, anon;
grant execute on function public.voyage_can_subscribe_hub(text) to authenticated, service_role;

drop policy if exists map_hub_subscriptions_select on public.map_hub_subscriptions;
create policy map_hub_subscriptions_select on public.map_hub_subscriptions
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists map_hub_subscriptions_insert on public.map_hub_subscriptions;
create policy map_hub_subscriptions_insert on public.map_hub_subscriptions
  for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.voyage_can_subscribe_hub(hub_id));

drop policy if exists map_hub_subscriptions_delete on public.map_hub_subscriptions;
create policy map_hub_subscriptions_delete on public.map_hub_subscriptions
  for delete to authenticated
  using (profile_id = (select auth.uid()));

revoke all on public.map_hub_subscriptions from anon, authenticated;
grant select, delete on public.map_hub_subscriptions to authenticated;
grant insert (profile_id, hub_id) on public.map_hub_subscriptions to authenticated;
grant all on public.map_hub_subscriptions to service_role;

/* ── 4. Лента локаций ──────────────────────────────────────────────── */

create table if not exists public.resident_location_feed (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  hub_id text references public.map_hubs(id) on update cascade on delete set null,
  ref_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  telegram_queued boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint resident_location_feed_kind_check check (kind in ('tour_new', 'casting_open')),
  constraint resident_location_feed_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint resident_location_feed_once unique (profile_id, kind, ref_id)
);

create index if not exists resident_location_feed_profile_idx
  on public.resident_location_feed (profile_id, created_at desc);
create index if not exists resident_location_feed_unread_idx
  on public.resident_location_feed (profile_id) where read_at is null;

comment on table public.resident_location_feed is
  'Внутренняя лента резидентки по подпискам на локации: новый тур / открытый кастинг. Снимок условий на момент публикации.';

alter table public.resident_location_feed enable row level security;

drop policy if exists resident_location_feed_select on public.resident_location_feed;
create policy resident_location_feed_select on public.resident_location_feed
  for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on public.resident_location_feed from anon, authenticated;
grant select on public.resident_location_feed to authenticated;
grant all on public.resident_location_feed to service_role;

-- Счётчик в меню обновляется в реальном времени
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'resident_location_feed'
     ) then
    alter publication supabase_realtime add table public.resident_location_feed;
  end if;
end $$;

create or replace function public.voyage_location_feed_mark_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'voyage:unauthenticated' using errcode = '42501';
  end if;
  update public.resident_location_feed f
     set read_at = now()
   where f.profile_id = auth.uid()
     and f.read_at is null
     and (p_ids is null or f.id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.voyage_location_feed_mark_read(uuid[]) from public, anon;
grant execute on function public.voyage_location_feed_mark_read(uuid[]) to authenticated;

/* ── 5. Тумблер и шаблон Telegram ──────────────────────────────────── */

alter table public.member_preferences
  add column if not exists notify_location_updates boolean not null default true;

comment on column public.member_preferences.notify_location_updates is
  'Telegram по подпискам на локации карты (новый тур / открытый кастинг). Лента в кабинете пишется всегда.';

create or replace function public.voyage_notification_allowed(p_recipient uuid, p_template text)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select coalesce((
    select case p_template
             when 'tour_published'       then mp.notify_tours
             when 'party_published'      then mp.notify_parties
             when 'application_approved' then mp.notify_approvals
             when 'points_awarded'       then mp.notify_points
             when 'casting_response'     then mp.notify_casting_responses
             when 'contract_signed'      then mp.notify_contract_signed
             when 'docs_uploaded'        then mp.notify_docs_uploaded
             when 'review_received'      then mp.notify_reviews
             when 'location_update'      then mp.notify_location_updates
             else true
           end
    from public.member_preferences mp
    where mp.profile_id = p_recipient
  ), true)
$$;

revoke all on function public.voyage_notification_allowed(uuid, text) from public, anon;
grant execute on function public.voyage_notification_allowed(uuid, text) to authenticated, service_role;

alter table public.partner_notifications drop constraint if exists partner_notifications_template_check;
alter table public.partner_notifications add constraint partner_notifications_template_check check (template = any (array[
  'contract_sign_request', 'contract_reminder', 'docs_reminder', 'kyc_approved', 'access_link',
  'tour_published', 'party_published', 'application_approved', 'points_awarded',
  'casting_response', 'contract_signed', 'docs_uploaded', 'review_received',
  'casting_invite', 'location_update'
]::text[]));

/* ── 6. Рассылка подписчицам ───────────────────────────────────────── */

-- Лента всем подходящим подписчицам + Telegram тем, у кого он есть и включён.
-- Повтор того же тура/кастинга (выключили-включили) не дублируется.
create or replace function public.voyage_location_fanout(p_hub text, p_kind text, p_ref uuid, p_audience text, p_payload jsonb)
returns integer
language plpgsql security definer
set search_path to ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  if p_hub is null or p_ref is null then return 0; end if;

  for r in
    insert into public.resident_location_feed (profile_id, kind, hub_id, ref_id, payload)
    select s.profile_id, p_kind, p_hub, p_ref, coalesce(p_payload, '{}'::jsonb)
      from public.map_hub_subscriptions s
      join public.profiles p on p.id = s.profile_id
     where s.hub_id = p_hub
       and public.voyage_invite_target_ok(s.profile_id)
       and (coalesce(p_audience, 'all') = 'all' or p.segment = p_audience)
    on conflict (profile_id, kind, ref_id) do nothing
    returning id, profile_id
  loop
    v_count := v_count + 1;
    if public.voyage_queue_if_allowed(r.profile_id, 'location_update', null,
         coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('feed_id', r.id)) then
      update public.resident_location_feed set telegram_queued = true where id = r.id;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.voyage_location_fanout(text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.voyage_location_fanout(text, text, uuid, text, jsonb) to service_role;

-- Снимок тура каталога для ленты и Telegram
create or replace function public.voyage_location_tour_payload(p_tour uuid)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'kind', 'tour', 'ref_id', t.id, 'hub_id', t.map_hub_id,
    'city', t.city, 'country_code', coalesce(h.country_code, t.country_code), 'region', t.region,
    'hub_name_i18n', coalesce(h.name, '{}'::jsonb),
    'project', t.project_type, 'audience', t.audience_segment, 'source_lang', t.source_lang,
    'title_i18n', t.title_i18n,
    'conditions_i18n', t.conditions_i18n, 'requirements_i18n', t.requirements_i18n,
    'fee_amount', t.fee_amount, 'fee_currency', t.fee_currency,
    'flight_paid_by', t.flight_paid_by, 'hotel_paid_by', t.hotel_paid_by,
    'height_min', t.height_min, 'languages', to_jsonb(t.languages)
  )
  from public.tour_catalog t
  left join public.map_hubs h on h.id = t.map_hub_id
  where t.id = p_tour
$$;

-- Снимок кастинга (условия брифа) для ленты и Telegram
create or replace function public.voyage_location_casting_payload(p_casting uuid)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'kind', 'casting', 'ref_id', c.id, 'hub_id', c.map_hub_id, 'tour_id', c.catalog_tour_id,
    'city', c.city, 'country_code', h.country_code, 'region', h.region,
    'hub_name_i18n', coalesce(h.name, '{}'::jsonb),
    'project', c.project_type, 'audience', c.audience_segment, 'source_lang', c.source_lang,
    'title_i18n', case when public.voyage_i18n_has_text(c.title_i18n) then c.title_i18n
                       else coalesce(t.title_i18n, '{}'::jsonb) end,
    'brief_i18n', c.brief_i18n,
    'starts_on', c.starts_on, 'ends_on', c.ends_on, 'closes_at', c.closes_at, 'slots', c.slots,
    'fee_amount', c.fee_amount, 'fee_currency', c.fee_currency,
    'flight_paid_by', c.flight_paid_by, 'hotel_paid_by', c.hotel_paid_by,
    'height_min', c.height_min, 'languages', to_jsonb(c.languages)
  )
  from public.partner_castings c
  left join public.map_hubs h on h.id = c.map_hub_id
  left join public.tour_catalog t on t.id = c.catalog_tour_id
  where c.id = p_casting
$$;

revoke all on function public.voyage_location_tour_payload(uuid) from public, anon, authenticated;
revoke all on function public.voyage_location_casting_payload(uuid) from public, anon, authenticated;
grant execute on function public.voyage_location_tour_payload(uuid) to service_role;
grant execute on function public.voyage_location_casting_payload(uuid) to service_role;

-- Новый (или впервые включённый) тур каталога на локации
create or replace function public.voyage_notify_location_tour()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if not new.is_active or new.map_hub_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.is_active and old.map_hub_id is not distinct from new.map_hub_id then
    return null;
  end if;
  if not exists (select 1 from public.map_hubs h where h.id = new.map_hub_id and coalesce(h.is_active, true)) then
    return null;
  end if;
  perform public.voyage_location_fanout(new.map_hub_id, 'tour_new', new.id, new.audience_segment,
                                        public.voyage_location_tour_payload(new.id));
  return null;
end;
$$;

drop trigger if exists voyage_notify_location_tour on public.tour_catalog;
create trigger voyage_notify_location_tour
  after insert or update of is_active, map_hub_id on public.tour_catalog
  for each row execute function public.voyage_notify_location_tour();

-- Кастинг открыт в локации (кем угодно: менеджер, admin, owner, клуб)
create or replace function public.voyage_notify_location_casting()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if new.status <> 'open' or new.map_hub_id is null or new.closes_at <= now() then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'open' and old.map_hub_id is not distinct from new.map_hub_id then
    return null;
  end if;
  perform public.voyage_location_fanout(new.map_hub_id, 'casting_open', new.id, new.audience_segment,
                                        public.voyage_location_casting_payload(new.id));
  return null;
end;
$$;

drop trigger if exists voyage_notify_location_casting on public.partner_castings;
create trigger voyage_notify_location_casting
  after insert or update of status, map_hub_id on public.partner_castings
  for each row execute function public.voyage_notify_location_casting();

revoke all on function public.voyage_notify_location_tour() from public, anon, authenticated;
revoke all on function public.voyage_notify_location_casting() from public, anon, authenticated;
revoke all on function public.tour_catalog_sync_castings_hub() from public, anon, authenticated;

/* ── 7. RPC для карты и админки ────────────────────────────────────── */

-- Активные локации для карты резидентки: страна, город, подписка, тур, кастинги
create or replace function public.voyage_map_hub_directory()
returns table (
  id text,
  name jsonb,
  subtitle jsonb,
  region text,
  country_code text,
  subscribed boolean,
  tour_id uuid,
  tour_title jsonb,
  open_castings integer
)
language sql stable security definer
set search_path to ''
as $$
  select h.id, coalesce(h.name, '{}'::jsonb), coalesce(h.subtitle, '{}'::jsonb), h.region, h.country_code,
         exists (select 1 from public.map_hub_subscriptions s where s.hub_id = h.id and s.profile_id = auth.uid()),
         t.id, t.title_i18n,
         (select count(*)::int from public.partner_castings c
           where c.map_hub_id = h.id and c.status = 'open' and c.closes_at > now())
    from public.map_hubs h
    left join public.tour_catalog t on t.map_hub_id = h.id and t.is_active
   where auth.uid() is not null
     and coalesce(h.is_active, true)
   order by h.region, h.country_code nulls last, h.id
$$;

revoke all on function public.voyage_map_hub_directory() from public, anon;
grant execute on function public.voyage_map_hub_directory() to authenticated;

-- Подписаться / отписаться. Возвращает итоговое состояние.
create or replace function public.voyage_set_map_hub_subscription(p_hub text, p_subscribed boolean)
returns boolean
language plpgsql security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then
    raise exception 'voyage:unauthenticated' using errcode = '42501';
  end if;
  if not p_subscribed then
    delete from public.map_hub_subscriptions where profile_id = auth.uid() and hub_id = p_hub;
    return false;
  end if;
  if exists (select 1 from public.map_hub_subscriptions where profile_id = auth.uid() and hub_id = p_hub) then
    return true;
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text = 'resident') then
    raise exception 'voyage:residents_only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.map_hubs h where h.id = p_hub and coalesce(h.is_active, true)) then
    raise exception 'voyage:map_hub_inactive' using errcode = '23514';
  end if;
  if not public.voyage_can_subscribe_hub(p_hub) then
    raise exception 'voyage:subscription_limit' using errcode = '23514';
  end if;
  insert into public.map_hub_subscriptions (profile_id, hub_id) values (auth.uid(), p_hub)
  on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.voyage_set_map_hub_subscription(text, boolean) from public, anon;
grant execute on function public.voyage_set_map_hub_subscription(text, boolean) to authenticated;

-- Сколько подписчиц у каждой локации (owner/admin)
create or replace function public.voyage_map_hub_subscriber_counts()
returns table (hub_id text, subscribers integer)
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  return query
    select s.hub_id, count(*)::int from public.map_hub_subscriptions s group by s.hub_id;
end;
$$;

revoke all on function public.voyage_map_hub_subscriber_counts() from public, anon;
grant execute on function public.voyage_map_hub_subscriber_counts() to authenticated;

commit;
