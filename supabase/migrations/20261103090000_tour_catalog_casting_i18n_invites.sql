-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Статичные туры ↔ динамичные кастинги, брифы на 4 языках,
--          приглашения резиденток (03.11.2026)
-- supabase/migrations/20261103090000_tour_catalog_casting_i18n_invites.sql
--
-- 1. public.tour_catalog — «Статичный тур»: постоянное направление
--    (Дубай, Сидней …) с базовыми условиями, описанием и требованиями на
--    RU/EN/ES/PT. Читают все вошедшие (резидентки — только активные),
--    пишут owner/admin.
-- 2. partner_castings — «Динамичный кастинг» под конкретный тур:
--      catalog_tour_id  → tour_catalog (NULL у старых кастингов)
--      title_i18n       { RU, EN, ES, PT } заголовок, до 120 символов
--      brief_i18n       { RU, EN, ES, PT } описание, до 2000 символов
--      source_lang      язык, на котором писал автор
--      status           + 'archived' (Открыт / Шорт-лист / Архив)
--    Колонка brief остаётся и заполняется триггером из brief_i18n на языке
--    автора — Telegram-бот, старые RPC и PDF продолжают работать.
--    Права на новые колонки выданы явно (у таблицы column-level grants).
-- 3. public.partner_casting_invites — точечные приглашения. Пишутся только
--    через RPC voyage_invite_residents (owner/admin), уведомление
--    уходит в Telegram (шаблон casting_invite в очереди partner_notifications).
--    Приглашённая может откликнуться, даже если не включила «Открыта к
--    турам» или кастинг для другого сегмента; бан и Blacklist по-прежнему
--    закрывают доступ. Опцион и рукопожатие, как и раньше, требуют KYC 3.
-- 4. voyage_resident_registry() — весь реестр резиденток для owner/admin
--    с фильтрами: выездной статус, сегмент, KYC, рост, размеры, языки,
--    летала ли в тур из каталога. Права проверяются внутри функции.
-- 5. partner_castings_list / partner_resident_feed отдают тур, заголовок
--    и бриф на 4 языках, приглашения.
--
-- Требует: 20261022090000 (организатор), 20261024090000 (tour/event),
--          20261101090000 (права на колонки), 20261102100000 (размеры).
-- Идемпотентна: можно прогнать повторно.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regprocedure('public.voyage_is_publisher(uuid)') is null then
    raise exception 'Сначала примените 20261022090000_voyage_management_organizer.sql';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'shoe_size') then
    raise exception 'Сначала примените 20261102100000_resident_sizes_dossier_audit.sql';
  end if;
end $$;

/* ── 0. Тексты на 4 языках ─────────────────────────────────────────── */

-- {RU, EN, ES, PT} → только строки, ключи из списка, длина ≤ p_max
create or replace function public.voyage_i18n_ok(p jsonb, p_max integer)
returns boolean
language sql immutable
set search_path to ''
as $$
  select p is not null
     and jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from jsonb_each(p) e
       where e.key not in ('RU', 'EN', 'ES', 'PT')
          or jsonb_typeof(e.value) <> 'string'
          or char_length(e.value #>> '{}') > p_max
     )
$$;

create or replace function public.voyage_i18n_has_text(p jsonb)
returns boolean
language sql immutable
set search_path to ''
as $$
  select coalesce(jsonb_typeof(p) = 'object', false)
     and exists (select 1 from jsonb_each_text(p) e where btrim(e.value) <> '')
$$;

-- Текст на нужном языке → на языке автора → любой непустой
create or replace function public.voyage_i18n_pick(p jsonb, p_lang text, p_fallback text default 'RU')
returns text
language sql immutable
set search_path to ''
as $$
  select coalesce(
    nullif(btrim(p ->> upper(coalesce(p_lang, ''))), ''),
    nullif(btrim(p ->> upper(coalesce(p_fallback, ''))), ''),
    nullif(btrim(p ->> 'EN'), ''),
    nullif(btrim(p ->> 'RU'), ''),
    nullif(btrim(p ->> 'ES'), ''),
    nullif(btrim(p ->> 'PT'), '')
  )
$$;

grant execute on function public.voyage_i18n_ok(jsonb, integer) to authenticated, service_role;
grant execute on function public.voyage_i18n_has_text(jsonb) to authenticated, service_role;
grant execute on function public.voyage_i18n_pick(jsonb, text, text) to authenticated, service_role;

/* ── 1. Статичные туры ─────────────────────────────────────────────── */

create table if not exists public.tour_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  city text not null,
  country_code text,
  region text,
  destination_id text references public.game_destinations(id) on delete set null,
  project_type text not null default 'tour',
  audience_segment text not null default 'all',
  source_lang text not null default 'RU',
  title_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  requirements_i18n jsonb not null default '{}'::jsonb,
  conditions_i18n jsonb not null default '{}'::jsonb,
  fee_amount numeric(12,2),
  fee_currency text,
  flight_paid_by text not null default 'manager',
  hotel_paid_by text not null default 'manager',
  height_min smallint,
  languages text[] not null default '{}'::text[],
  cover_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_catalog_slug_key unique (slug),
  constraint tour_catalog_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  constraint tour_catalog_city_check check (char_length(btrim(city)) between 2 and 60),
  constraint tour_catalog_country_check check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint tour_catalog_region_check check (region is null or char_length(region) <= 60),
  constraint tour_catalog_project_check check (project_type in ('tour', 'event')),
  constraint tour_catalog_audience_check check (audience_segment in ('all', 'working', 'elite')),
  constraint tour_catalog_source_lang_check check (source_lang in ('RU', 'EN', 'ES', 'PT')),
  constraint tour_catalog_title_check check (public.voyage_i18n_ok(title_i18n, 120) and public.voyage_i18n_has_text(title_i18n)),
  constraint tour_catalog_description_check check (public.voyage_i18n_ok(description_i18n, 4000)),
  constraint tour_catalog_requirements_check check (public.voyage_i18n_ok(requirements_i18n, 2000)),
  constraint tour_catalog_conditions_check check (public.voyage_i18n_ok(conditions_i18n, 2000)),
  constraint tour_catalog_fee_check check (fee_amount is null or fee_amount >= 0),
  constraint tour_catalog_currency_check check (fee_currency is null or fee_currency ~ '^[A-Z]{3}$'),
  constraint tour_catalog_fee_pair_check check ((fee_amount is null) = (fee_currency is null)),
  constraint tour_catalog_flight_check check (flight_paid_by in ('manager', 'participant', 'split')),
  constraint tour_catalog_hotel_check check (hotel_paid_by in ('manager', 'participant', 'split')),
  constraint tour_catalog_height_check check (height_min is null or height_min between 140 and 230),
  constraint tour_catalog_languages_check check (
    cardinality(languages) <= 5 and array_to_string(languages, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'
  ),
  constraint tour_catalog_cover_check check (cover_url is null or char_length(cover_url) <= 500)
);

comment on table public.tour_catalog is
  'Статичные туры (направления клуба): постоянные условия, описание и требования на RU/EN/ES/PT. Кастинги создаются под тур (partner_castings.catalog_tour_id).';

create index if not exists tour_catalog_active_idx on public.tour_catalog (is_active, sort_order, city);

drop trigger if exists tour_catalog_touch on public.tour_catalog;
create trigger tour_catalog_touch
  before update on public.tour_catalog
  for each row execute function public.partner_touch_updated_at();

alter table public.tour_catalog enable row level security;

drop policy if exists tour_catalog_select on public.tour_catalog;
create policy tour_catalog_select on public.tour_catalog
  for select to authenticated
  using (is_active or (select public.is_staff()));

drop policy if exists tour_catalog_insert on public.tour_catalog;
create policy tour_catalog_insert on public.tour_catalog
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists tour_catalog_update on public.tour_catalog;
create policy tour_catalog_update on public.tour_catalog
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists tour_catalog_delete on public.tour_catalog;
create policy tour_catalog_delete on public.tour_catalog
  for delete to authenticated
  using ((select public.is_admin()));

revoke all on table public.tour_catalog from anon;
grant select, insert, update, delete on table public.tour_catalog to authenticated;
grant all on table public.tour_catalog to service_role;

-- Два стартовых тура, чтобы форма кастинга не была пустой. Правятся в /partner/castings/tours.
insert into public.tour_catalog (slug, city, country_code, region, project_type, audience_segment, source_lang,
                                 title_i18n, description_i18n, requirements_i18n, conditions_i18n,
                                 flight_paid_by, hotel_paid_by, height_min, languages, sort_order)
values
  ('dubai', 'Dubai', 'AE', 'Middle East', 'tour', 'all', 'RU',
   '{"RU":"Дубай · VOYAGE Season","EN":"Dubai · VOYAGE Season","ES":"Dubái · VOYAGE Season","PT":"Dubai · VOYAGE Season"}',
   '{"RU":"Постоянное направление клуба: частные ужины, яхты и закрытые вечера с партнёрами VOYAGE.","EN":"A permanent club destination: private dinners, yachts and closed evenings with VOYAGE partners.","ES":"Un destino permanente del club: cenas privadas, yates y veladas cerradas con socios de VOYAGE.","PT":"Um destino permanente do clube: jantares privados, iates e noites fechadas com parceiros VOYAGE."}',
   '{"RU":"Загранпаспорт со сроком от 6 месяцев, KYC 3, английский язык.","EN":"Passport valid for 6+ months, KYC level 3, English.","ES":"Pasaporte con 6+ meses de validez, KYC nivel 3, inglés.","PT":"Passaporte válido por 6+ meses, KYC nível 3, inglês."}',
   '{"RU":"Перелёт и отель оплачивает организатор. Трансферы и сопровождение — VOYAGE.","EN":"Flight and hotel are paid by the organizer. Transfers and support by VOYAGE.","ES":"El vuelo y el hotel los paga el organizador. Traslados y acompañamiento de VOYAGE.","PT":"Passagem e hotel pagos pelo organizador. Traslados e acompanhamento da VOYAGE."}',
   'manager', 'manager', 170, '{EN}', 10),
  ('sydney', 'Sydney', 'AU', 'Asia Pacific', 'tour', 'all', 'RU',
   '{"RU":"Сидней · Harbour Tour","EN":"Sydney · Harbour Tour","ES":"Sídney · Harbour Tour","PT":"Sydney · Harbour Tour"}',
   '{"RU":"Постоянное направление клуба в Австралии: события на воде, гала-ужины, съёмки для партнёров.","EN":"The club''s permanent destination in Australia: events on the water, gala dinners, partner shoots.","ES":"El destino permanente del club en Australia: eventos en el agua, cenas de gala, sesiones para socios.","PT":"O destino permanente do clube na Austrália: eventos na água, jantares de gala, ensaios para parceiros."}',
   '{"RU":"Загранпаспорт, австралийская виза (ETA/visitor), KYC 3, английский язык.","EN":"Passport, Australian visa (ETA/visitor), KYC level 3, English.","ES":"Pasaporte, visado australiano (ETA/visitante), KYC nivel 3, inglés.","PT":"Passaporte, visto australiano (ETA/visitante), KYC nível 3, inglês."}',
   '{"RU":"Перелёт и отель оплачивает организатор. Визу помогает оформить консьерж VOYAGE.","EN":"Flight and hotel are paid by the organizer. The VOYAGE concierge helps with the visa.","ES":"El vuelo y el hotel los paga el organizador. El concierge de VOYAGE ayuda con el visado.","PT":"Passagem e hotel pagos pelo organizador. O concierge VOYAGE ajuda com o visto."}',
   'manager', 'manager', 170, '{EN}', 20)
on conflict (slug) do nothing;

/* ── 2. Кастинг: тур, тексты на 4 языках, «Архив» ──────────────────── */

alter table public.partner_castings add column if not exists catalog_tour_id uuid;
alter table public.partner_castings add column if not exists title_i18n jsonb not null default '{}'::jsonb;
alter table public.partner_castings add column if not exists brief_i18n jsonb not null default '{}'::jsonb;
alter table public.partner_castings add column if not exists source_lang text not null default 'RU';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'partner_castings_catalog_tour_fkey') then
    alter table public.partner_castings
      add constraint partner_castings_catalog_tour_fkey
      foreign key (catalog_tour_id) references public.tour_catalog(id) on delete set null;
  end if;
end $$;

alter table public.partner_castings drop constraint if exists partner_castings_title_i18n_check;
alter table public.partner_castings add constraint partner_castings_title_i18n_check
  check (public.voyage_i18n_ok(title_i18n, 120));
alter table public.partner_castings drop constraint if exists partner_castings_brief_i18n_check;
alter table public.partner_castings add constraint partner_castings_brief_i18n_check
  check (public.voyage_i18n_ok(brief_i18n, 2000));
alter table public.partner_castings drop constraint if exists partner_castings_source_lang_check;
alter table public.partner_castings add constraint partner_castings_source_lang_check
  check (source_lang in ('RU', 'EN', 'ES', 'PT'));

alter table public.partner_castings drop constraint if exists partner_castings_status_check;
alter table public.partner_castings add constraint partner_castings_status_check
  check (status in ('open', 'shortlist', 'closed', 'cancelled', 'archived'));

create index if not exists partner_castings_catalog_tour_idx on public.partner_castings (catalog_tour_id);

comment on column public.partner_castings.catalog_tour_id is 'Статичный тур (tour_catalog), под который создан кастинг. NULL — кастинг до 03.11.2026.';
comment on column public.partner_castings.title_i18n is 'Заголовок кастинга {RU,EN,ES,PT}, до 120 символов.';
comment on column public.partner_castings.brief_i18n is 'Бриф {RU,EN,ES,PT}, до 2000 символов. brief = версия на source_lang (триггер).';
comment on column public.partner_castings.status is 'open — Открыт, shortlist — Шорт-лист, closed/cancelled/archived — Архив.';

-- Старые брифы → русская версия
update public.partner_castings
   set brief_i18n = jsonb_build_object(source_lang, brief)
 where brief is not null and btrim(brief) <> '' and brief_i18n = '{}'::jsonb;

-- brief ↔ brief_i18n и город из тура.
--   Новая форма пишет brief_i18n → brief берётся из версии на языке автора.
--   Старый клиент (или бот) меняет только brief → он попадает в brief_i18n[source_lang].
create or replace function public.partner_castings_sync_i18n()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_tour public.tour_catalog%rowtype;
  v_text text;
begin
  new.title_i18n := coalesce(new.title_i18n, '{}'::jsonb);
  new.brief_i18n := coalesce(new.brief_i18n, '{}'::jsonb);
  new.source_lang := upper(coalesce(new.source_lang, 'RU'));

  if new.catalog_tour_id is not null
     and (tg_op = 'INSERT' or new.catalog_tour_id is distinct from old.catalog_tour_id) then
    select * into v_tour from public.tour_catalog t where t.id = new.catalog_tour_id;
    if not found or not v_tour.is_active then
      raise exception 'voyage:catalog_tour_inactive' using errcode = '23514';
    end if;
    if new.city is null or btrim(new.city) = '' then
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

drop trigger if exists partner_castings_sync_i18n on public.partner_castings;
create trigger partner_castings_sync_i18n
  before insert or update on public.partner_castings
  for each row execute function public.partner_castings_sync_i18n();

grant insert (catalog_tour_id, title_i18n, brief_i18n, source_lang) on table public.partner_castings to authenticated;
grant update (catalog_tour_id, title_i18n, brief_i18n, source_lang) on table public.partner_castings to authenticated;

/* ── 3. Приглашения ────────────────────────────────────────────────── */

create table if not exists public.partner_casting_invites (
  id uuid primary key default gen_random_uuid(),
  casting_id uuid not null references public.partner_castings(id) on delete cascade,
  resident_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid default auth.uid() references public.profiles(id) on delete set null,
  message text,
  status text not null default 'invited',
  notified boolean not null default false,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_casting_invites_unique unique (casting_id, resident_id),
  constraint partner_casting_invites_status_check check (status in ('invited', 'accepted', 'declined', 'revoked')),
  constraint partner_casting_invites_message_check check (message is null or char_length(message) <= 500)
);

comment on table public.partner_casting_invites is
  'Точечные приглашения резиденток на кастинг. Пишет только RPC voyage_invite_residents (owner/admin).';

create index if not exists partner_casting_invites_resident_idx on public.partner_casting_invites (resident_id, status);

drop trigger if exists partner_casting_invites_touch on public.partner_casting_invites;
create trigger partner_casting_invites_touch
  before update on public.partner_casting_invites
  for each row execute function public.partner_touch_updated_at();

alter table public.partner_casting_invites enable row level security;

drop policy if exists partner_casting_invites_select on public.partner_casting_invites;
create policy partner_casting_invites_select on public.partner_casting_invites
  for select to authenticated
  using (resident_id = (select auth.uid()) or (select public.is_admin()));

revoke all on table public.partner_casting_invites from anon, authenticated;
grant select on table public.partner_casting_invites to authenticated;
grant all on table public.partner_casting_invites to service_role;

-- Шаблон Telegram для приглашения
alter table public.partner_notifications drop constraint if exists partner_notifications_template_check;
alter table public.partner_notifications add constraint partner_notifications_template_check check (template = any (array[
  'contract_sign_request', 'contract_reminder', 'docs_reminder', 'kyc_approved', 'access_link',
  'tour_published', 'party_published', 'application_approved', 'points_awarded',
  'casting_response', 'contract_signed', 'docs_uploaded', 'review_received',
  'casting_invite'
]::text[]));

-- Может ли резидентка получить приглашение (без KYC 3 и «Открыта к турам» — это решает owner)
create or replace function public.voyage_invite_target_ok(p_resident uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_resident
      and p.role::text = 'resident'
      and not coalesce(p.is_npc, false)
      and coalesce(p.status, 'approved') = 'approved'
      and not coalesce(p.ban_permanent, false)
      and (p.banned_until is null or p.banned_until <= now())
  ) and not public.partner_is_blacklisted(p_resident)
$$;

revoke all on function public.voyage_invite_target_ok(uuid) from public, anon;
grant execute on function public.voyage_invite_target_ok(uuid) to authenticated, service_role;

create or replace function public.voyage_invite_residents(p_casting uuid, p_residents uuid[], p_message text default null)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_casting public.partner_castings%rowtype;
  v_tour public.tour_catalog%rowtype;
  v_message text := nullif(left(btrim(coalesce(p_message, '')), 500), '');
  v_resident uuid;
  v_existing public.partner_casting_invites%rowtype;
  v_invited uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_notified integer := 0;
  v_payload jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_residents is null or cardinality(p_residents) = 0 then
    raise exception 'voyage:no_residents' using errcode = '22023';
  end if;
  if cardinality(p_residents) > 50 then
    raise exception 'voyage:too_many_residents' using errcode = '22023';
  end if;

  select * into v_casting from public.partner_castings c where c.id = p_casting for update;
  if not found then
    raise exception 'voyage:casting_not_found' using errcode = 'P0002';
  end if;
  if v_casting.status not in ('open', 'shortlist') or v_casting.closes_at <= now() then
    raise exception 'voyage:casting_closed' using errcode = 'P0001';
  end if;
  if v_casting.catalog_tour_id is not null then
    select * into v_tour from public.tour_catalog t where t.id = v_casting.catalog_tour_id;
  end if;

  v_payload := jsonb_build_object(
    'ref_id', v_casting.id,
    'city', v_casting.city,
    'project', v_casting.project_type,
    'starts_on', v_casting.starts_on,
    'ends_on', v_casting.ends_on,
    'closes_at', v_casting.closes_at,
    'title_i18n', case when public.voyage_i18n_has_text(v_casting.title_i18n) then v_casting.title_i18n
                       else coalesce(v_tour.title_i18n, '{}'::jsonb) end,
    'message', v_message
  );

  foreach v_resident in array (select array_agg(distinct x) from unnest(p_residents) x where x is not null)
  loop
    if not public.voyage_invite_target_ok(v_resident) then
      v_skipped := v_skipped || jsonb_build_object('id', v_resident, 'reason', 'not_eligible');
      continue;
    end if;
    if exists (select 1 from public.partner_casting_responses r
               where r.casting_id = p_casting and r.resident_id = v_resident
                 and r.status in ('ready', 'option', 'selected')) then
      v_skipped := v_skipped || jsonb_build_object('id', v_resident, 'reason', 'already_responded');
      continue;
    end if;

    select * into v_existing from public.partner_casting_invites i
     where i.casting_id = p_casting and i.resident_id = v_resident;
    if found and v_existing.status in ('invited', 'accepted') then
      v_skipped := v_skipped || jsonb_build_object('id', v_resident, 'reason', 'already_invited');
      continue;
    end if;

    insert into public.partner_casting_invites (casting_id, resident_id, invited_by, message, status, notified, responded_at)
    values (p_casting, v_resident, auth.uid(), v_message, 'invited', false, null)
    on conflict (casting_id, resident_id) do update
      set status = 'invited', invited_by = excluded.invited_by, message = excluded.message,
          notified = false, responded_at = null, created_at = now();

    if public.voyage_queue_if_allowed(v_resident, 'casting_invite', null, v_payload) then
      update public.partner_casting_invites set notified = true
       where casting_id = p_casting and resident_id = v_resident;
      v_notified := v_notified + 1;
    end if;
    v_invited := v_invited || v_resident;
  end loop;

  return jsonb_build_object('invited', to_jsonb(v_invited), 'notified', v_notified, 'skipped', v_skipped);
end;
$$;

revoke all on function public.voyage_invite_residents(uuid, uuid[], text) from public, anon;
grant execute on function public.voyage_invite_residents(uuid, uuid[], text) to authenticated;

create or replace function public.voyage_revoke_casting_invite(p_casting uuid, p_resident uuid)
returns boolean
language plpgsql security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  update public.partner_casting_invites
     set status = 'revoked', responded_at = now()
   where casting_id = p_casting and resident_id = p_resident and status = 'invited';
  return found;
end;
$$;

revoke all on function public.voyage_revoke_casting_invite(uuid, uuid) from public, anon;
grant execute on function public.voyage_revoke_casting_invite(uuid, uuid) to authenticated;

-- Резидентка отклоняет приглашение (кастинг уходит из её ленты)
create or replace function public.partner_casting_invite_decline(p_casting uuid)
returns boolean
language plpgsql security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  update public.partner_casting_invites
     set status = 'declined', responded_at = now()
   where casting_id = p_casting and resident_id = auth.uid() and status = 'invited';
  return found;
end;
$$;

revoke all on function public.partner_casting_invite_decline(uuid) from public, anon;
grant execute on function public.partner_casting_invite_decline(uuid) to authenticated;

-- Отклик «Готова» по приглашению → приглашение принято
create or replace function public.partner_casting_invite_accept_on_response()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if new.status = 'ready' then
    update public.partner_casting_invites
       set status = 'accepted', responded_at = now()
     where casting_id = new.casting_id and resident_id = new.resident_id and status = 'invited';
  end if;
  return new;
end;
$$;

drop trigger if exists partner_casting_invite_accept on public.partner_casting_responses;
create trigger partner_casting_invite_accept
  after insert or update of status on public.partner_casting_responses
  for each row execute function public.partner_casting_invite_accept_on_response();

-- Кто может откликнуться: прежнее правило ИЛИ личное приглашение
create or replace function public.partner_me_can_respond(p_casting uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role::text = 'resident'
        and coalesce(p.kyc_level, 0) >= 3
        and coalesce(p.status, 'approved') = 'approved'
        and not coalesce(p.ban_permanent, false)
        and (p.banned_until is null or p.banned_until <= now())
    )
    and exists (
      select 1 from public.partner_resident_settings s
      where s.resident_id = auth.uid() and s.open_to_tours = true
    )
    and not public.partner_is_blacklisted(auth.uid())
    and exists (
      select 1 from public.partner_castings c
      join public.profiles p on p.id = auth.uid()
      where c.id = p_casting
        and c.status = 'open'
        and c.closes_at > now()
        and (c.audience_segment = 'all' or c.audience_segment = p.segment)
    )
  ) or (
    public.voyage_invite_target_ok(auth.uid())
    and exists (
      select 1 from public.partner_casting_invites i
      join public.partner_castings c on c.id = i.casting_id
      where i.casting_id = p_casting
        and i.resident_id = auth.uid()
        and i.status in ('invited', 'accepted')
        and c.status = 'open'
        and c.closes_at > now()
    )
  );
$$;

revoke all on function public.partner_me_can_respond(uuid) from public;
grant execute on function public.partner_me_can_respond(uuid) to authenticated, service_role;

/* ── 4. Реестр резиденток для owner/admin ──────────────────────────── */

-- p_filters (все ключи необязательны):
--   q              text      имя / e-mail / @telegram
--   travel         text      available | busy | closed  (выездной статус)
--   segment        text      working | elite
--   kyc_min        int       0..3
--   height_min/max numeric   см
--   clothing_sizes text[]    XXS … XXL
--   shoe_min/max   numeric   EU
--   languages      text[]    все из списка (ISO, как в «Открыта к турам»)
--   catalog_tour   uuid      летала в тур из каталога
--   not_invited    boolean   скрыть уже приглашённых на p_casting
-- Выездной статус: closed — «Открыта к турам» выключено; busy — уже в составе
-- тура, который пересекается с датами кастинга (без кастинга — идущий сейчас);
-- available — всё остальное.
create or replace function public.voyage_resident_registry(
  p_casting uuid default null,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 60,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_from date;
  v_to date;
  v_q text := nullif(btrim(f ->> 'q'), '');
  v_travel text := nullif(f ->> 'travel', '');
  v_segment text := nullif(f ->> 'segment', '');
  v_kyc integer := coalesce(nullif(f ->> 'kyc_min', '')::integer, 0);
  v_hmin numeric := nullif(f ->> 'height_min', '')::numeric;
  v_hmax numeric := nullif(f ->> 'height_max', '')::numeric;
  v_smin numeric := nullif(f ->> 'shoe_min', '')::numeric;
  v_smax numeric := nullif(f ->> 'shoe_max', '')::numeric;
  v_sizes text[] := array(select jsonb_array_elements_text(case when jsonb_typeof(f -> 'clothing_sizes') = 'array' then f -> 'clothing_sizes' else '[]'::jsonb end));
  v_langs text[] := array(select upper(x) from jsonb_array_elements_text(case when jsonb_typeof(f -> 'languages') = 'array' then f -> 'languages' else '[]'::jsonb end) x);
  v_catalog uuid := nullif(f ->> 'catalog_tour', '')::uuid;
  v_not_invited boolean := coalesce((f ->> 'not_invited')::boolean, false);
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  if p_casting is not null then
    select c.starts_on, c.ends_on into v_from, v_to from public.partner_castings c where c.id = p_casting;
    if not found then
      raise exception 'voyage:casting_not_found' using errcode = 'P0002';
    end if;
  end if;

  with base as (
    select p.id, p.full_name, p.name, p.email, p.telegram_username, p.avatar_url, p.photo_urls,
           p.segment, p.level, coalesce(p.kyc_level, 0) as kyc_level, p.height, p.clothing_size, p.shoe_size,
           p.citizenship, p.location, p.reliability, p.last_seen_at,
           coalesce(s.open_to_tours, false) as open_to_tours,
           coalesce(s.languages, '{}'::text[]) as languages,
           exists (
             select 1 from public.partner_tour_members m
             join public.partner_tours t on t.id = m.tour_id
             where m.resident_id = p.id
               and m.status = 'confirmed'
               and t.status in ('confirmed', 'in_tour')
               and (
                 (v_from is not null
                   and t.departs_at::date <= v_to
                   and coalesce(t.returns_at, t.departs_at)::date >= v_from)
                 or (v_from is null
                   and (t.status = 'in_tour'
                        or now() between t.departs_at and coalesce(t.returns_at, t.departs_at + interval '1 day')))
               )
           ) as busy,
           (select count(*) from public.partner_tour_members m
             where m.resident_id = p.id and m.status = 'flown')::integer as tours_done,
           coalesce((
             select jsonb_agg(distinct c.catalog_tour_id)
             from public.partner_tour_members m
             join public.partner_tours t on t.id = m.tour_id
             join public.partner_castings c on c.id = t.casting_id
             where m.resident_id = p.id and m.status in ('confirmed', 'flown') and c.catalog_tour_id is not null
           ), '[]'::jsonb) as catalog_tours,
           (select i.status from public.partner_casting_invites i
             where p_casting is not null and i.casting_id = p_casting and i.resident_id = p.id) as invite_status,
           (select r.status from public.partner_casting_responses r
             where p_casting is not null and r.casting_id = p_casting and r.resident_id = p.id) as response_status
    from public.profiles p
    left join public.partner_resident_settings s on s.resident_id = p.id
    where p.role::text = 'resident'
      and not coalesce(p.is_npc, false)
      and coalesce(p.status, 'approved') = 'approved'
      and not coalesce(p.ban_permanent, false)
      and (p.banned_until is null or p.banned_until <= now())
      and not public.partner_is_blacklisted(p.id)
  ),
  shaped as (
    select b.*,
           case when not b.open_to_tours then 'closed' when b.busy then 'busy' else 'available' end as travel_status
    from base b
  ),
  filtered as (
    select x.* from shaped x
    where (v_q is null
           or coalesce(x.full_name, '') ilike '%' || v_q || '%'
           or coalesce(x.name, '') ilike '%' || v_q || '%'
           or coalesce(x.email, '') ilike '%' || v_q || '%'
           or coalesce(x.telegram_username, '') ilike '%' || ltrim(v_q, '@') || '%')
      and (v_travel is null or x.travel_status = v_travel)
      and (v_segment is null or x.segment = v_segment)
      and x.kyc_level >= v_kyc
      and (v_hmin is null or x.height >= v_hmin)
      and (v_hmax is null or x.height <= v_hmax)
      and (cardinality(v_sizes) = 0 or x.clothing_size = any (v_sizes))
      and (v_smin is null or x.shoe_size >= v_smin)
      and (v_smax is null or x.shoe_size <= v_smax)
      and (cardinality(v_langs) = 0 or x.languages @> v_langs)
      and (v_catalog is null or x.catalog_tours @> to_jsonb(array[v_catalog]))
      and (not v_not_invited or x.invite_status is null or x.invite_status in ('declined', 'revoked'))
  ),
  counted as (
    select x.*, count(*) over () as total
    from filtered x
    order by case x.travel_status when 'available' then 0 when 'busy' then 1 else 2 end,
             x.kyc_level desc, x.tours_done desc, coalesce(x.full_name, x.name, '') asc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'generated_at', now(),
    'casting', case when p_casting is null then null else jsonb_build_object('id', p_casting, 'starts_on', v_from, 'ends_on', v_to) end,
    'total', coalesce(max(c.total), 0),
    'residents', coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', coalesce(nullif(btrim(c.full_name), ''), c.name),
      'telegram', c.telegram_username,
      'photo', coalesce((select u from unnest(c.photo_urls) u where u is not null and u <> '' limit 1), c.avatar_url),
      'segment', c.segment,
      'level', c.level,
      'kyc_level', c.kyc_level,
      'height', c.height,
      'clothing_size', c.clothing_size,
      'shoe_size', c.shoe_size,
      'languages', to_jsonb(c.languages),
      'citizenship', c.citizenship,
      'location', c.location,
      'reliability', c.reliability,
      'open_to_tours', c.open_to_tours,
      'travel_status', c.travel_status,
      'tours_done', c.tours_done,
      'catalog_tours', c.catalog_tours,
      'invite_status', c.invite_status,
      'response_status', c.response_status,
      'last_seen_at', c.last_seen_at
    ) order by case c.travel_status when 'available' then 0 when 'busy' then 1 else 2 end,
               c.kyc_level desc, c.tours_done desc, coalesce(c.full_name, c.name, '') asc), '[]'::jsonb)
  ) into v_result
  from counted c;

  return v_result;
end;
$$;

revoke all on function public.voyage_resident_registry(uuid, jsonb, integer, integer) from public, anon;
grant execute on function public.voyage_resident_registry(uuid, jsonb, integer, integer) to authenticated;

-- Приглашённые на кастинг (для модуля в карточке) — owner/admin
create or replace function public.voyage_casting_invites(p_casting uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'resident_id', i.resident_id,
             'name', coalesce(nullif(btrim(p.full_name), ''), p.name),
             'kyc_level', coalesce(p.kyc_level, 0),
             'status', i.status,
             'notified', i.notified,
             'message', i.message,
             'invited_at', i.created_at,
             'responded_at', i.responded_at,
             'response_status', (select r.status from public.partner_casting_responses r
                                  where r.casting_id = i.casting_id and r.resident_id = i.resident_id)
           ) order by i.created_at desc)
    from public.partner_casting_invites i
    join public.profiles p on p.id = i.resident_id
    where i.casting_id = p_casting
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.voyage_casting_invites(uuid) from public, anon;
grant execute on function public.voyage_casting_invites(uuid) to authenticated;

/* ── 5. Ленты ──────────────────────────────────────────────────────── */

create or replace function public.voyage_catalog_tour_brief(p_tour uuid)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'city', t.city, 'country_code', t.country_code,
    'title_i18n', t.title_i18n, 'requirements_i18n', t.requirements_i18n, 'conditions_i18n', t.conditions_i18n
  )
  from public.tour_catalog t where t.id = p_tour
$$;

revoke all on function public.voyage_catalog_tour_brief(uuid) from public, anon;
grant execute on function public.voyage_catalog_tour_brief(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.partner_castings_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := auth.uid();
  v_admin boolean;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  v_admin := coalesce(public.is_admin(), false);

  return jsonb_build_object(
    'generated_at', now(),
    'castings', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'city', c.city, 'project', c.project_type,
               'starts_on', c.starts_on, 'ends_on', c.ends_on, 'slots', c.slots,
               'closes_at', c.closes_at, 'stage', c.status,
               'organizer', (select jsonb_build_object(
                               'id', op.id, 'official', op.is_system, 'badge', op.partner_badge,
                               'name', coalesce(nullif(btrim(op.full_name), ''), op.name))
                             from public.profiles op where op.id = c.manager_id),
               'fee_amount', c.fee_amount, 'fee_currency', c.fee_currency,
               'flight_paid_by', c.flight_paid_by, 'hotel_paid_by', c.hotel_paid_by,
               'height_min', c.height_min, 'languages', to_jsonb(c.languages), 'brief', c.brief,
               'title_i18n', c.title_i18n, 'brief_i18n', c.brief_i18n, 'source_lang', c.source_lang,
               'catalog_tour', case when c.catalog_tour_id is null then null
                                    else public.voyage_catalog_tour_brief(c.catalog_tour_id) end,
               'invites', case when v_admin then (select count(*) from public.partner_casting_invites i
                                                  where i.casting_id = c.id and i.status in ('invited', 'accepted'))
                               else null end,
               'tour_id', (select t.id from public.partner_tours t where t.casting_id = c.id
                            order by t.created_at desc limit 1),
               'fresh', (select count(*) from public.partner_casting_responses r
                          where r.casting_id = c.id and r.status = 'ready'
                            and r.created_at > c.manager_seen_at
                            and not public.partner_is_blacklisted(r.resident_id)),
               'responders', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'code', public.partner_blind_code(r.id),
                          'handshake', h.done,
                          'resident_id', case when h.done or v_admin then r.resident_id end,
                          'name', case when h.done or v_admin then public.partner_short_name(p.full_name) end,
                          'snap_at', (select max(s.captured_at) from public.partner_live_snaps s
                                       where s.resident_id = r.resident_id),
                          'trusted', (select t.trusted from public.partner_resident_trust(r.resident_id) t)
                        ) order by h.done desc, r.created_at), '[]'::jsonb)
                 from public.partner_casting_responses r
                 join public.profiles p on p.id = r.resident_id
                 cross join lateral (
                   select exists (
                     select 1 from public.partner_tour_members m
                     join public.partner_tours t on t.id = m.tour_id
                     where t.casting_id = c.id and m.resident_id = r.resident_id
                       and m.status in ('confirmed', 'flown')
                   ) as done
                 ) h
                 where r.casting_id = c.id and r.status in ('ready', 'option', 'selected')
                   and not public.partner_is_blacklisted(r.resident_id)
               )
             ) order by
               case c.status when 'open' then 0 when 'shortlist' then 0 when 'closed' then 1 else 2 end,
               c.closes_at), '[]'::jsonb)
      from public.partner_castings c
      where (c.manager_id = me or v_admin)
        and (c.status in ('open', 'shortlist') or c.updated_at > now() - interval '180 days')
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_resident_feed()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_height numeric;
  v_kyc integer;
  v_segment text;
  v_status text;
  v_ban_permanent boolean;
  v_banned_until timestamptz;
  v_open boolean;
  v_languages text[];
  v_seen timestamptz;
  v_eligible boolean;
  v_base_ok boolean;
  v_castings jsonb := '[]'::jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT p.height, COALESCE(p.kyc_level, 0), p.segment,
         COALESCE(p.status::text, 'approved'), COALESCE(p.ban_permanent, false), p.banned_until
    INTO v_height, v_kyc, v_segment, v_status, v_ban_permanent, v_banned_until
    FROM public.profiles p
   WHERE p.id = v_me AND p.role::text = 'resident';
  IF NOT FOUND THEN RAISE EXCEPTION 'not a resident' USING ERRCODE = '42501'; END IF;

  SELECT COALESCE(s.open_to_tours, false), COALESCE(s.languages, '{}'), s.castings_seen_at
    INTO v_open, v_languages, v_seen
    FROM (SELECT 1) AS one
    LEFT JOIN public.partner_resident_settings s ON s.resident_id = v_me;

  v_base_ok := v_status = 'approved'
    AND NOT v_ban_permanent
    AND (v_banned_until IS NULL OR v_banned_until <= now())
    AND NOT public.partner_is_blacklisted(v_me);

  v_eligible := v_base_ok AND v_kyc >= 3 AND v_open;

  IF v_base_ok THEN
    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.invited DESC, x.closes_at), '[]'::jsonb)
      INTO v_castings
      FROM (
        SELECT c.closes_at,
          (i.id IS NOT NULL AND i.status IN ('invited', 'accepted')) AS invited,
          jsonb_build_object(
            'id', c.id,
            'city', c.city,
            'project', c.project_type,
            'audience_segment', c.audience_segment,
            'starts_on', c.starts_on,
            'ends_on', c.ends_on,
            'slots', c.slots,
            'closes_at', c.closes_at,
            'fee_amount', c.fee_amount,
            'fee_currency', c.fee_currency,
            'flight_paid_by', c.flight_paid_by,
            'hotel_paid_by', c.hotel_paid_by,
            'height_min', c.height_min,
            'languages', to_jsonb(c.languages),
            'brief', c.brief,
            'title_i18n', c.title_i18n,
            'brief_i18n', c.brief_i18n,
            'source_lang', c.source_lang,
            'catalog_tour', CASE WHEN c.catalog_tour_id IS NULL THEN NULL
                                 ELSE public.voyage_catalog_tour_brief(c.catalog_tour_id) END,
            'invite', CASE WHEN i.id IS NOT NULL AND i.status IN ('invited', 'accepted')
                           THEN jsonb_build_object('status', i.status, 'at', i.created_at, 'message', i.message)
                      END,
            'fresh', c.created_at > COALESCE(v_seen, '-infinity'::timestamptz),
            'manager', jsonb_build_object('tier', st.tier, 'rating', st.rating, 'tours', st.tours_done),
            -- Имя открыто только у клуба; партнёр остаётся анонимным до рукопожатия.
            'organizer', jsonb_build_object(
              'official', coalesce(op.is_system, false),
              'badge', op.partner_badge,
              'name', case when op.is_system then 'VOYAGE Management' end),
            'response', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
              'status', r.status, 'at', r.updated_at, 'option_until', r.option_expires_at
            ) END
          ) AS item
        FROM public.partner_castings c
        LEFT JOIN public.partner_casting_responses r ON r.casting_id = c.id AND r.resident_id = v_me
        LEFT JOIN public.partner_casting_invites i ON i.casting_id = c.id AND i.resident_id = v_me
        CROSS JOIN LATERAL public.partner_manager_stats(c.manager_id) st
        LEFT JOIN public.profiles op ON op.id = c.manager_id
        WHERE (r.status IS DISTINCT FROM 'declined')
          AND (
            (v_eligible
              AND (c.audience_segment = 'all' OR c.audience_segment = v_segment)
              AND ((c.status = 'open' AND c.closes_at > now()) OR r.status IN ('ready', 'option', 'selected')))
            OR
            (i.id IS NOT NULL AND i.status IN ('invited', 'accepted')
              AND ((c.status = 'open' AND c.closes_at > now()) OR r.status IN ('ready', 'option', 'selected')))
          )
      ) x;
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'me', jsonb_build_object('height', v_height, 'languages', to_jsonb(v_languages), 'open_to_tours', v_open, 'segment', v_segment),
    'castings', v_castings
  );
END;
$function$;

revoke all on function public.partner_castings_list() from public, anon;
grant execute on function public.partner_castings_list() to authenticated, service_role;
revoke all on function public.partner_resident_feed() from public, anon;
grant execute on function public.partner_resident_feed() to authenticated, service_role;

commit;
