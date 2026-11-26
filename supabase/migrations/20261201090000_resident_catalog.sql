-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Video Identity, этап 2: каталог резиденток (26.11.2026)
-- supabase/migrations/20261201090000_resident_catalog.sql
--
-- Решения Vlad 26.11.2026 (19:50):
--   D1 A  — из каталога приглашают только в кастинг; дальше обычный путь
--           (приглашение → отклик резидентки → Handshake). Прямые приглашения
--           в тур не расширяются.
--   D2    — свежесть: до 30 дней / 30–90 / старше 90.
--   D3    — именной водяной знак (код менеджера + дата) на фото и видео.
--   D4    — Live Snap не трогаем (этап 3).
--   D5    — каталог ставится ВЫКЛЮЧЕННЫМ (resident_catalog_settings.enabled
--           = false); включает owner после юриста. Заполненность 14 → 16.
-- Уточнения:
--   • доступ только у одобренных менеджеров VOYAGE с АКТИВНЫМ доступом,
--     который owner выдал явно (manager_catalog_access.status = 'active');
--     роль manager сама по себе доступа не даёт;
--   • отсутствие видео не блокирует ни анкету, ни вход в каталог;
--   • видимость, пауза и «скрыться от менеджера» проверяются в базе
--     при каждом открытии анкеты и видео;
--   • scout_manager_id, скаутские бонусы, кастинги, partner_casting_invites,
--     partner_me_can_respond и Handshake НЕ меняются. Приглашение из
--     каталога — отдельная таблица catalog_invites; откликается резидентка
--     обычной кнопкой кастинга по обычным правилам.
--
-- Из этапа 1 пересоздаются ровно две функции:
--   voyage_media_access              — добавлена ветка 'catalog'
--   voyage_resident_media_for_viewer — принимает контекст 'catalog'
-- Ветки self/staff/casting/tour не менялись (проверяют тесты этапа 1).
-- В resident_visibility добавлены 3 колонки (catalog_since,
-- catalog_prompt_dismissed_at, preview_seen_at).
--
-- Требует: 36 миграций Production + 20261127090000 + 20261130090000 (этап 1).
-- Идемпотентна. Откат: supabase/rollback/20261201090000_resident_catalog.rollback.sql
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regclass('public.resident_visibility') is null
     or to_regprocedure('public.voyage_media_access(uuid,text,uuid)') is null
     or to_regprocedure('public.voyage_log_profile_view(uuid,text,text,uuid,text)') is null then
    raise exception 'VOYAGE: нет Video Identity этапа 1 — сначала 20261130090000_resident_video_identity.sql (video-identity-stage1.zip)';
  end if;
  if to_regclass('public.partner_casting_invites') is null
     or to_regprocedure('public.voyage_casting_kyc_ok(uuid,uuid)') is null then
    raise exception 'VOYAGE: нет кастинговых функций — нужны 36 миграций Production';
  end if;
  if to_regclass('public.map_hub_subscriptions') is null then
    raise exception 'VOYAGE: нет map_hub_subscriptions — нужна 20261106090000';
  end if;
end $$;

/* ── 1. Общий выключатель каталога ───────────────────────────────── */

create table if not exists public.resident_catalog_settings (
  id                   boolean primary key default true,
  enabled              boolean not null default false,
  default_open_limit   integer not null default 200,
  default_invite_limit integer not null default 30,
  updated_by           uuid,
  updated_at           timestamptz not null default now(),
  constraint resident_catalog_settings_single check (id),
  constraint resident_catalog_settings_limits check (default_open_limit between 1 and 1000
                                                     and default_invite_limit between 1 and 200)
);
comment on table public.resident_catalog_settings is
  'VOYAGE: общий выключатель каталога резиденток для менеджеров (по умолчанию выключен — D5) и лимиты по умолчанию. Меняет только owner.';
insert into public.resident_catalog_settings (id) values (true) on conflict (id) do nothing;
alter table public.resident_catalog_settings enable row level security;
revoke all on table public.resident_catalog_settings from public, anon, authenticated;
grant all on table public.resident_catalog_settings to service_role;

/* ── 2. Новые настройки резидентки (таблица этапа 1) ─────────────── */

alter table public.resident_visibility add column if not exists catalog_since timestamptz;
alter table public.resident_visibility add column if not exists catalog_prompt_dismissed_at timestamptz;
alter table public.resident_visibility add column if not exists preview_seen_at timestamptz;

/* ── 3. Доступ менеджеров (явная выдача owner'ом) ────────────────── */

create table if not exists public.manager_catalog_access (
  manager_id         uuid primary key references public.profiles(id) on delete cascade,
  status             text not null,
  daily_open_limit   integer,
  daily_invite_limit integer,
  expires_at         timestamptz,
  reason             text not null,
  granted_by         uuid,
  granted_at         timestamptz not null default now(),
  updated_by         uuid,
  updated_at         timestamptz not null default now(),
  constraint manager_catalog_access_status_check check (status in ('active', 'suspended')),
  constraint manager_catalog_access_limits_check check (
    (daily_open_limit is null or daily_open_limit between 1 and 1000)
    and (daily_invite_limit is null or daily_invite_limit between 1 and 200)),
  constraint manager_catalog_access_reason_check check (char_length(btrim(reason)) between 3 and 500)
);
comment on table public.manager_catalog_access is
  'VOYAGE: кому из менеджеров owner открыл каталог резиденток. Нет строки или suspended — доступа нет. Лимиты null = по умолчанию.';
alter table public.manager_catalog_access enable row level security;
revoke all on table public.manager_catalog_access from public, anon, authenticated;
grant all on table public.manager_catalog_access to service_role;

/* ── 4. «Скрыться от менеджера» / «Не приглашать меня» ───────────── */

create table if not exists public.resident_hidden_managers (
  resident_id uuid not null references public.profiles(id) on delete cascade,
  manager_id  uuid not null references public.profiles(id) on delete cascade,
  mode        text not null,
  created_at  timestamptz not null default now(),
  primary key (resident_id, manager_id),
  constraint resident_hidden_managers_mode_check check (mode in ('hidden', 'no_invites'))
);
comment on table public.resident_hidden_managers is
  'VOYAGE: hidden — менеджер не видит её в каталоге и не может пригласить; no_invites — видит, но не может пригласить. Видит только сама резидентка.';
alter table public.resident_hidden_managers enable row level security;
revoke all on table public.resident_hidden_managers from public, anon, authenticated;
grant all on table public.resident_hidden_managers to service_role;

/* ── 5. Открытия анкет (лимит в сутки) ───────────────────────────── */

create table if not exists public.manager_catalog_opens (
  manager_id  uuid not null references public.profiles(id) on delete cascade,
  resident_id uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  opened_at   timestamptz not null default now(),
  primary key (manager_id, day, resident_id)
);
comment on table public.manager_catalog_opens is
  'VOYAGE: какие анкеты каталога менеджер открыл за сутки (UTC). Повторное открытие той же анкеты в тот же день лимит не тратит.';
alter table public.manager_catalog_opens enable row level security;
revoke all on table public.manager_catalog_opens from public, anon, authenticated;
grant all on table public.manager_catalog_opens to service_role;

/* ── 6. Подборки менеджера ───────────────────────────────────────── */

create table if not exists public.manager_shortlists (
  id         uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manager_shortlists_title_check check (char_length(btrim(title)) between 1 and 80)
);
create index if not exists manager_shortlists_manager_idx on public.manager_shortlists (manager_id, updated_at desc);

create table if not exists public.manager_shortlist_items (
  shortlist_id uuid not null references public.manager_shortlists(id) on delete cascade,
  resident_id  uuid not null references public.profiles(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (shortlist_id, resident_id)
);
create index if not exists manager_shortlist_items_resident_idx on public.manager_shortlist_items (resident_id, added_at desc);

comment on table public.manager_shortlists is 'VOYAGE: личные подборки менеджера в каталоге. Видит только он сам.';
alter table public.manager_shortlists enable row level security;
alter table public.manager_shortlist_items enable row level security;
revoke all on table public.manager_shortlists, public.manager_shortlist_items from public, anon, authenticated;
grant all on table public.manager_shortlists, public.manager_shortlist_items to service_role;

/* ── 7. Приглашения из каталога ──────────────────────────────────── */

create table if not exists public.catalog_invites (
  id           uuid primary key default gen_random_uuid(),
  manager_id   uuid not null references public.profiles(id) on delete cascade,
  resident_id  uuid not null references public.profiles(id) on delete cascade,
  casting_id   uuid not null references public.partner_castings(id) on delete cascade,
  message      text,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  constraint catalog_invites_status_check check (status in ('pending', 'interested', 'not_now', 'blocked', 'withdrawn', 'expired')),
  constraint catalog_invites_message_check check (message is null or char_length(message) <= 300)
);
comment on table public.catalog_invites is
  'VOYAGE: приглашение менеджера из каталога в его открытый кастинг. Не даёт обходов кастинга: резидентка откликается обычной кнопкой. Не меняет scout_manager_id.';
create unique index if not exists catalog_invites_one_pending
  on public.catalog_invites (manager_id, resident_id) where status = 'pending';
create index if not exists catalog_invites_resident_idx on public.catalog_invites (resident_id, created_at desc);
create index if not exists catalog_invites_manager_idx on public.catalog_invites (manager_id, created_at desc);
alter table public.catalog_invites enable row level security;
revoke all on table public.catalog_invites from public, anon, authenticated;
grant all on table public.catalog_invites to service_role;

/* ── 8. Внутренние помощники ─────────────────────────────────────── */

create or replace function public.voyage_rcat_day()
returns date language sql stable set search_path to '' as
$$ select (now() at time zone 'UTC')::date $$;

-- Свежесть по дате последнего видео (D2)
create or replace function public.voyage_rcat_freshness(p_at timestamptz)
returns text language sql stable set search_path to '' as $$
  select case when p_at is null then 'none'
              when p_at > now() - interval '30 days' then 'fresh'
              when p_at > now() - interval '90 days' then 'aging'
              else 'stale' end
$$;

-- Код менеджера для водяного знака: стабильный, не раскрывает id
create or replace function public.voyage_rcat_manager_code(p_manager uuid)
returns text language sql immutable set search_path to '' as
$$ select 'VY-' || upper(substr(md5(p_manager::text || ':voyage-catalog-wm'), 1, 6)) $$;

-- Одобренный менеджер VOYAGE (без доступа к каталогу это ещё ничего не даёт)
create or replace function public.voyage_rcat_manager_eligible(p_manager uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_manager
      and p.role::text = 'manager'
      and coalesce(p.status, '') = 'approved'
      and not coalesce(p.is_system, false)
      and not coalesce(p.is_npc, false)
      and not coalesce(p.ban_permanent, false)
      and (p.banned_until is null or p.banned_until <= now()))
$$;

-- Режим текущего пользователя: 'staff' | 'manager' | 'x:<причина>'
create or replace function public.voyage_rcat_mode()
returns text language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  a public.manager_catalog_access%rowtype;
begin
  if me is null then return 'x:not_authenticated'; end if;
  if coalesce(public.is_admin(), false) then return 'staff'; end if;
  if public.voyage_ops_role() is distinct from 'manager' then return 'x:not_manager'; end if;
  if not public.voyage_rcat_manager_eligible(me) then return 'x:not_approved'; end if;
  if not coalesce((select s.enabled from public.resident_catalog_settings s where s.id), false) then
    return 'x:catalog_disabled';
  end if;
  select * into a from public.manager_catalog_access x where x.manager_id = me;
  if not found then return 'x:no_access'; end if;
  if a.status <> 'active' then return 'x:suspended'; end if;
  if a.expires_at is not null and a.expires_at <= now() then return 'x:expired'; end if;
  return 'manager';
end $$;

-- Что не хватает резидентке, чтобы анкета попала в каталог (C3). Видео не требуется.
create or replace function public.voyage_rcat_checklist(p_resident uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'approved', coalesce(p.status, '') = 'approved',
    'kyc', coalesce(p.kyc_level, 0) >= 1,
    'photos', least(coalesce(cardinality(p.photo_urls), 0), 3),
    'not_restricted', not coalesce(p.ban_permanent, false)
                      and (p.banned_until is null or p.banned_until <= now())
                      and not coalesce(p.is_npc, false)
                      and not public.partner_is_blacklisted(p.id))
  from public.profiles p where p.id = p_resident and p.role::text = 'resident'
$$;

-- Анкета сейчас в каталоге: включила, не на паузе, проходит C3
create or replace function public.voyage_rcat_listed(p_resident uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.profiles p
    join public.resident_visibility v on v.resident_id = p.id
    where p.id = p_resident
      and p.role::text = 'resident'
      and coalesce(p.status, '') = 'approved'
      and not coalesce(p.is_npc, false)
      and not coalesce(p.ban_permanent, false)
      and (p.banned_until is null or p.banned_until <= now())
      and coalesce(p.kyc_level, 0) >= 1
      and coalesce(cardinality(p.photo_urls), 0) >= 3
      and v.catalog_visible
      and (v.paused_until is null or v.paused_until <= now()))
  and not public.partner_is_blacklisted(p_resident)
$$;

-- Видит ли ТЕКУЩИЙ пользователь эту анкету в каталоге — проверка на каждое открытие
create or replace function public.voyage_rcat_can_see(p_resident uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $$
declare v_mode text := public.voyage_rcat_mode();
begin
  if v_mode = 'staff' then
    return public.voyage_rcat_listed(p_resident);
  end if;
  if v_mode <> 'manager' then
    return false;
  end if;
  return public.voyage_rcat_listed(p_resident)
     and not exists (select 1 from public.resident_hidden_managers h
                     where h.resident_id = p_resident and h.manager_id = auth.uid() and h.mode = 'hidden');
end $$;

create or replace function public.voyage_rcat_limits(p_manager uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'opens',   coalesce(a.daily_open_limit, s.default_open_limit),
    'invites', coalesce(a.daily_invite_limit, s.default_invite_limit),
    'opens_used', (select count(*) from public.manager_catalog_opens o
                   where o.manager_id = p_manager and o.day = public.voyage_rcat_day()),
    'invites_used', (select count(*) from public.catalog_invites i
                     where i.manager_id = p_manager and i.created_at >= public.voyage_rcat_day()::timestamp at time zone 'UTC'))
  from public.resident_catalog_settings s
  left join public.manager_catalog_access a on a.manager_id = p_manager
  where s.id
$$;

-- Событие «лимит исчерпан» для owner'а: одно на менеджера и вид в сутки
create or replace function public.voyage_rcat_limit_event(p_kind text)
returns void language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.audit_logs l
                 where l.action = 'catalog.limit_reached' and l.actor_profile_id = me
                   and l.metadata->>'kind' = p_kind
                   and l.created_at >= public.voyage_rcat_day()::timestamp at time zone 'UTC') then
    insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, metadata)
    values ('catalog.limit_reached', me, me, 'manager', jsonb_build_object('kind', p_kind, 'day', public.voyage_rcat_day()));
  end if;
end $$;

-- Ленивое истечение приглашений: 14 дней или кастинг больше не открыт
create or replace function public.voyage_rcat_expire()
returns void language sql volatile security definer set search_path to '' as $$
  update public.catalog_invites i set status = 'expired', responded_at = now()
  where i.status = 'pending'
    and (i.expires_at <= now()
         or not exists (select 1 from public.partner_castings c
                        where c.id = i.casting_id and c.status = 'open' and c.closes_at > now()))
$$;

-- Занятость: только даты своих подтверждённых туров, без городов и менеджеров
create or replace function public.voyage_rcat_busy(p_resident uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('from', x.f, 'to', x.t) order by x.f), '[]'::jsonb)
  from (select (t.departs_at at time zone 'UTC')::date as f,
               (coalesce(t.returns_at, t.departs_at) at time zone 'UTC')::date as t
        from public.partner_tour_members m
        join public.partner_tours t on t.id = m.tour_id
        where m.resident_id = p_resident and m.status = 'confirmed'
          and t.status in ('confirmed', 'in_tour')
          and coalesce(t.returns_at, t.departs_at) >= now()
          and t.departs_at <= now() + interval '180 days'
        order by t.departs_at limit 4) x
$$;

create or replace function public.voyage_rcat_busy_between(p_resident uuid, p_from date, p_to date)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.partner_tour_members m
    join public.partner_tours t on t.id = m.tour_id
    where m.resident_id = p_resident and m.status = 'confirmed'
      and t.status in ('confirmed', 'in_tour')
      and (t.departs_at at time zone 'UTC')::date <= p_to
      and (coalesce(t.returns_at, t.departs_at) at time zone 'UTC')::date >= p_from)
$$;

-- Короткое имя: имя + инициал. Полного ФИО в каталоге нет.
create or replace function public.voyage_rcat_name(p_resident uuid)
returns text language sql stable security definer set search_path to '' as $$
  select coalesce(public.partner_short_name(coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''))), '—')
  from public.profiles p where p.id = p_resident
$$;

-- Строка сетки: только белый список полей
create or replace function public.voyage_rcat_item_json(p_resident uuid, p_manager uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'id', p.id,
    'name', public.voyage_rcat_name(p.id),
    'age', case when p.birth_date is not null then date_part('year', age(p.birth_date))::int end,
    'city', nullif(left(btrim(coalesce(p.location, '')), 80), ''),
    'height', p.height,
    'languages', coalesce(to_jsonb(s.languages), '[]'::jsonb),
    'kyc_level', coalesce(p.kyc_level, 0),
    'segment', p.segment,
    'photo', (select x from unnest(coalesce(p.photo_urls, '{}'::text[])) x where nullif(btrim(x), '') is not null limit 1),
    'video_allowed', vis.video_consent_at is not null and vis.video_scope = 'catalog',
    'has_intro', exists (select 1 from public.resident_media m where m.profile_id = p.id and m.kind = 'intro' and m.status = 'active'),
    'moments', (select count(*) from public.resident_media m where m.profile_id = p.id and m.kind = 'moment' and m.status = 'active'),
    'poster', case when vis.video_consent_at is not null and vis.video_scope = 'catalog' then
                (select m.poster_path from public.resident_media m
                 where m.profile_id = p.id and m.kind = 'intro' and m.status = 'active' and m.poster_path is not null) end,
    'video_at', med.latest,
    'freshness', public.voyage_rcat_freshness(med.latest),
    'busy', public.voyage_rcat_busy(p.id),
    'in_shortlist', exists (select 1 from public.manager_shortlist_items i
                            join public.manager_shortlists l on l.id = i.shortlist_id
                            where i.resident_id = p.id and l.manager_id = p_manager),
    'invite', (select jsonb_build_object('status', i.status, 'at', i.created_at)
               from public.catalog_invites i where i.manager_id = p_manager and i.resident_id = p.id
               order by i.created_at desc limit 1))
  from public.profiles p
  join public.resident_visibility vis on vis.resident_id = p.id
  left join public.partner_resident_settings s on s.resident_id = p.id
  left join lateral (select max(m.recorded_at) as latest from public.resident_media m
                     where m.profile_id = p.id and m.status = 'active') med on true
  where p.id = p_resident
$$;

-- Полная каталожная анкета (белый список). Без ФИО, даты рождения, гражданства,
-- контактов, «о себе», KYC-файлов, кошелька, скаута, туров и заметок.
create or replace function public.voyage_rcat_card_json(p_resident uuid, p_manager uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select public.voyage_rcat_item_json(p.id, p_manager) || jsonb_build_object(
    'photos', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                 select x from unnest(coalesce(p.photo_urls, '{}'::text[])) x
                 where nullif(btrim(x), '') is not null limit 12) q),
    'weight', case when vis.show_body_params then p.weight end,
    'measurements', case when vis.show_body_params then nullif(left(coalesce(p.measurements, ''), 40), '') end,
    'body_shown', vis.show_body_params,
    'clothing_size', p.clothing_size,
    'shoe_size', p.shoe_size,
    'in_catalog_since', vis.catalog_since,
    'shortlists', (select coalesce(jsonb_agg(l.id), '[]'::jsonb)
                   from public.manager_shortlists l
                   join public.manager_shortlist_items i on i.shortlist_id = l.id and i.resident_id = p.id
                   where l.manager_id = p_manager),
    'no_invites', exists (select 1 from public.resident_hidden_managers h
                          where h.resident_id = p.id and h.manager_id = p_manager))
  from public.profiles p
  join public.resident_visibility vis on vis.resident_id = p.id
  where p.id = p_resident
$$;

-- внутренние помощники недоступны клиенту напрямую
do $$
declare f text;
begin
  foreach f in array array[
    'voyage_rcat_manager_eligible(uuid)', 'voyage_rcat_checklist(uuid)', 'voyage_rcat_listed(uuid)',
    'voyage_rcat_limits(uuid)', 'voyage_rcat_limit_event(text)', 'voyage_rcat_expire()',
    'voyage_rcat_busy(uuid)', 'voyage_rcat_busy_between(uuid,date,date)', 'voyage_rcat_name(uuid)',
    'voyage_rcat_item_json(uuid,uuid)', 'voyage_rcat_card_json(uuid,uuid)', 'voyage_rcat_mode()',
    'voyage_rcat_can_see(uuid)', 'voyage_rcat_day()', 'voyage_rcat_freshness(timestamptz)',
    'voyage_rcat_manager_code(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

/* ── 9. Этап 1: ветка каталога в праве на видео ──────────────────── */

create or replace function public.voyage_media_access(p_resident uuid, p_context text, p_context_id uuid)
returns text
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_scope text;
  v_consent timestamptz;
begin
  if me is null or p_resident is null then
    return null;
  end if;
  if me = p_resident then
    return 'self';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_resident and p.role::text = 'resident') then
    return null;
  end if;
  if coalesce(public.is_admin(), false) then
    return 'staff';
  end if;
  if public.voyage_ops_role() is distinct from 'manager' then
    return null;
  end if;

  select v.video_scope, v.video_consent_at into v_scope, v_consent
  from public.resident_visibility v where v.resident_id = p_resident;
  if v_consent is null or coalesce(v_scope, 'engaged') = 'hidden' then
    return null;
  end if;
  if public.partner_is_blacklisted(p_resident) then
    return null;
  end if;

  if p_context = 'casting' and p_context_id is not null then
    if public.voyage_casting_profile_access(p_context_id)
       and exists (select 1 from public.partner_casting_responses r
                   where r.casting_id = p_context_id and r.resident_id = p_resident
                     and r.status in ('ready', 'option', 'selected', 'declined')) then
      return 'casting';
    end if;
    return null;
  end if;

  if p_context = 'tour' then
    if exists (select 1 from public.partner_tour_members m
               join public.partner_tours t on t.id = m.tour_id
               where m.resident_id = p_resident
                 and (p_context_id is null or t.id = p_context_id)
                 and public.voyage_acts_for(t.manager_id)) then
      return 'tour';
    end if;
    return null;
  end if;

  -- Этап 2: каталог. Видео — только при режиме «всем менеджерам каталога»,
  -- анкета в каталоге, менеджер с активным доступом, не скрыт резиденткой,
  -- и анкета открыта им сегодня (открытие тратит дневной лимит).
  if p_context = 'catalog' then
    if v_scope = 'catalog'
       and public.voyage_rcat_can_see(p_resident)
       and exists (select 1 from public.manager_catalog_opens o
                   where o.manager_id = me and o.resident_id = p_resident and o.day = public.voyage_rcat_day()) then
      return 'catalog';
    end if;
    return null;
  end if;

  return null;
end $$;

comment on function public.voyage_media_access(uuid, text, uuid) is
  'VOYAGE Video Identity: основание просмотра видео резидентки текущим пользователем (self/staff/casting/tour/catalog) или null.';
revoke all on function public.voyage_media_access(uuid, text, uuid) from public, anon;
grant execute on function public.voyage_media_access(uuid, text, uuid) to authenticated, service_role;

create or replace function public.voyage_resident_media_for_viewer(
  p_resident uuid, p_context text default null, p_context_id uuid default null)
returns jsonb
language plpgsql volatile security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_access text;
  v_items jsonb;
  v_scope text;
  v_consent timestamptz;
begin
  if me is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if p_resident is null or (p_context is not null and p_context not in ('casting', 'tour', 'admin', 'catalog')) then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;

  v_access := public.voyage_media_access(p_resident, p_context, p_context_id);
  if v_access is null then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  select v.video_scope, v.video_consent_at into v_scope, v_consent
  from public.resident_visibility v where v.resident_id = p_resident;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'kind', m.kind, 'source', m.source, 'topic', m.topic,
           'storage_path', m.storage_path, 'poster_path', m.poster_path, 'mime', m.mime,
           'duration_ms', m.duration_ms, 'width', m.width, 'height', m.height,
           'status', m.status,
           'hidden_reason', case when v_access in ('self', 'staff') then m.hidden_reason end,
           'recorded_at', m.recorded_at)
         order by case m.kind when 'intro' then 0 else 1 end, m.position, m.recorded_at desc), '[]'::jsonb)
    into v_items
  from public.resident_media m
  where m.profile_id = p_resident
    and (v_access in ('self', 'staff') or m.status = 'active');

  if v_access in ('casting', 'tour', 'staff', 'catalog') and jsonb_array_length(v_items) > 0 then
    perform public.voyage_log_profile_view(p_resident, v_access, p_context, p_context_id, 'video');
  end if;

  return jsonb_build_object(
    'access', v_access,
    'scope', coalesce(v_scope, 'engaged'),
    'consent', v_consent is not null,
    'items', v_items,
    'latest_at', (select max(m.recorded_at) from public.resident_media m
                  where m.profile_id = p_resident and m.status = 'active'));
end $$;

comment on function public.voyage_resident_media_for_viewer(uuid, text, uuid) is
  'VOYAGE Video Identity: видео резидентки для текущего пользователя. Право — voyage_media_access. Возвращает пути, подписывает их сервер. Просмотр менеджером/персоналом пишется в resident_profile_views и audit_logs.';
revoke all on function public.voyage_resident_media_for_viewer(uuid, text, uuid) from public, anon;
grant execute on function public.voyage_resident_media_for_viewer(uuid, text, uuid) to authenticated, service_role;

/* ── 10. Менеджер: доступ, поиск, анкета ─────────────────────────── */

create or replace function public.voyage_rcat_viewer()
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  v_mode text := public.voyage_rcat_mode();
begin
  if me is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if v_mode like 'x:%' then
    return jsonb_build_object('mode', 'none', 'reason', substr(v_mode, 3),
      'enabled', coalesce((select s.enabled from public.resident_catalog_settings s where s.id), false));
  end if;
  perform public.voyage_rcat_expire();
  return jsonb_build_object(
    'mode', v_mode,
    'enabled', coalesce((select s.enabled from public.resident_catalog_settings s where s.id), false),
    'code', public.voyage_rcat_manager_code(me),
    'watermark', public.voyage_rcat_manager_code(me) || ' · ' || to_char(now() at time zone 'UTC', 'DD.MM.YYYY HH24:MI') || ' UTC',
    'limits', case when v_mode = 'manager' then public.voyage_rcat_limits(me) end);
end $$;

create or replace function public.voyage_rcat_search(p_filters jsonb default '{}'::jsonb, p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  v_mode text := public.voyage_rcat_mode();
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_page integer := greatest(0, least(coalesce(p_page, 0), 40));
  v_city text := nullif(btrim(coalesce(f->>'city', '')), '');
  v_hub text := nullif(btrim(coalesce(f->>'hub', '')), '');
  v_langs text[];
  v_hmin numeric := nullif(f->>'height_min', '')::numeric;
  v_hmax numeric := nullif(f->>'height_max', '')::numeric;
  v_kyc integer := coalesce(nullif(f->>'kyc_min', '')::integer, 1);
  v_size text := nullif(f->>'size', '');
  v_video text := coalesce(nullif(f->>'video', ''), 'any');
  v_from date := nullif(f->>'free_from', '')::date;
  v_to date := nullif(f->>'free_to', '')::date;
  v_items jsonb;
  v_count integer;
begin
  if v_mode like 'x:%' then
    raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501';
  end if;
  if jsonb_typeof(f->'languages') = 'array' then
    select array_agg(upper(x)) into v_langs from jsonb_array_elements_text(f->'languages') x where x ~ '^[A-Za-z]{2}$';
  end if;
  if v_city is not null and char_length(v_city) > 60 then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  if v_to is null then v_to := v_from; end if;

  with base as (
    select p.id, vis.catalog_since,
           (select max(m.recorded_at) from public.resident_media m where m.profile_id = p.id and m.status = 'active') as latest
    from public.profiles p
    join public.resident_visibility vis on vis.resident_id = p.id
    left join public.partner_resident_settings s on s.resident_id = p.id
    where vis.catalog_visible
      and public.voyage_rcat_listed(p.id)
      and (v_mode = 'staff' or not exists (select 1 from public.resident_hidden_managers h
                                           where h.resident_id = p.id and h.manager_id = me and h.mode = 'hidden'))
      and (v_city is null or p.location ilike '%' || replace(replace(v_city, '%', ''), '_', '') || '%')
      and (v_hub is null or exists (select 1 from public.map_hub_subscriptions hs where hs.profile_id = p.id and hs.hub_id = v_hub))
      and (v_langs is null or coalesce(s.languages, '{}'::text[]) @> v_langs)
      and (v_hmin is null or p.height >= v_hmin)
      and (v_hmax is null or p.height <= v_hmax)
      and coalesce(p.kyc_level, 0) >= greatest(1, least(v_kyc, 3))
      and (v_size is null or p.clothing_size = v_size)
      and (v_from is null or not public.voyage_rcat_busy_between(p.id, v_from, v_to))
  ), filtered as (
    select b.* from base b
    where v_video = 'any'
       or (v_video = 'has' and b.latest is not null)
       or (v_video = 'fresh' and b.latest > now() - interval '30 days')
  )
  select (select count(*) from filtered),
         (select coalesce(jsonb_agg(public.voyage_rcat_item_json(x.id, me) order by x.rn), '[]'::jsonb)
          from (select f2.id, row_number() over (order by f2.latest desc nulls last, f2.catalog_since desc nulls last, f2.id) as rn
                from filtered f2
                order by f2.latest desc nulls last, f2.catalog_since desc nulls last, f2.id
                offset v_page * 24 limit 24) x)
    into v_count, v_items;

  return jsonb_build_object('items', v_items, 'page', v_page, 'total', v_count,
                            'has_more', v_count > (v_page + 1) * 24 and v_page < 40);
end $$;

create or replace function public.voyage_rcat_card(p_resident uuid)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  v_mode text := public.voyage_rcat_mode();
  v_limits jsonb;
begin
  if v_mode like 'x:%' then
    raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501';
  end if;
  if p_resident is null or not public.voyage_rcat_can_see(p_resident) then
    -- выключила каталог, на паузе, скрылась или не проходит условия — одна причина
    raise exception 'voyage:unavailable' using errcode = '42501';
  end if;

  if v_mode = 'manager' and not exists (
       select 1 from public.manager_catalog_opens o
       where o.manager_id = me and o.resident_id = p_resident and o.day = public.voyage_rcat_day()) then
    perform pg_advisory_xact_lock(hashtextextended('rcat_open:' || me::text, 0));
    v_limits := public.voyage_rcat_limits(me);
    if (v_limits->>'opens_used')::int >= (v_limits->>'opens')::int then
      perform public.voyage_rcat_limit_event('opens');
      return jsonb_build_object('error', 'limit_opens', 'limits', v_limits);
    end if;
    insert into public.manager_catalog_opens (manager_id, resident_id, day)
    values (me, p_resident, public.voyage_rcat_day()) on conflict do nothing;
  end if;

  perform public.voyage_log_profile_view(p_resident, case when v_mode = 'staff' then 'staff' else 'catalog' end,
                                         'catalog', null, 'profile');
  return jsonb_build_object('card', public.voyage_rcat_card_json(p_resident, me),
                            'limits', case when v_mode = 'manager' then public.voyage_rcat_limits(me) end);
end $$;

/* ── 11. Подборки ────────────────────────────────────────────────── */

create or replace function public.voyage_rcat_shortlists()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', l.id, 'title', l.title, 'updated_at', l.updated_at,
            'count', (select count(*) from public.manager_shortlist_items i where i.shortlist_id = l.id))
          order by l.updated_at desc), '[]'::jsonb)
          from public.manager_shortlists l where l.manager_id = me);
end $$;

create or replace function public.voyage_rcat_shortlist_save(p_id uuid, p_title text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode(); v_id uuid;
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  if p_id is null then
    if (select count(*) from public.manager_shortlists l where l.manager_id = me) >= 30 then
      raise exception 'voyage:shortlist_limit' using errcode = 'P0001';
    end if;
    insert into public.manager_shortlists (manager_id, title) values (me, btrim(p_title)) returning id into v_id;
  else
    update public.manager_shortlists l set title = btrim(p_title), updated_at = now()
    where l.id = p_id and l.manager_id = me returning l.id into v_id;
    if v_id is null then raise exception 'voyage:not_found' using errcode = 'P0002'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.voyage_rcat_shortlist_delete(p_id uuid)
returns boolean language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  delete from public.manager_shortlists l where l.id = p_id and l.manager_id = me;
  return found;
end $$;

create or replace function public.voyage_rcat_shortlist_toggle(p_id uuid, p_resident uuid, p_add boolean)
returns boolean language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  if not exists (select 1 from public.manager_shortlists l where l.id = p_id and l.manager_id = me) then
    raise exception 'voyage:not_found' using errcode = 'P0002';
  end if;
  if p_add then
    if not public.voyage_rcat_can_see(p_resident) then
      raise exception 'voyage:unavailable' using errcode = '42501';
    end if;
    if (select count(*) from public.manager_shortlist_items i where i.shortlist_id = p_id) >= 100 then
      raise exception 'voyage:shortlist_full' using errcode = 'P0001';
    end if;
    insert into public.manager_shortlist_items (shortlist_id, resident_id) values (p_id, p_resident) on conflict do nothing;
  else
    delete from public.manager_shortlist_items i where i.shortlist_id = p_id and i.resident_id = p_resident;
  end if;
  update public.manager_shortlists l set updated_at = now() where l.id = p_id;
  return true;
end $$;

-- Состав подборки: недоступная анкета — серая строка без имени, фото и id
create or replace function public.voyage_rcat_shortlist_items(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  if not exists (select 1 from public.manager_shortlists l where l.id = p_id and l.manager_id = me) then
    raise exception 'voyage:not_found' using errcode = 'P0002';
  end if;
  return (select coalesce(jsonb_agg(
            case when public.voyage_rcat_can_see(i.resident_id)
                 then public.voyage_rcat_item_json(i.resident_id, me) || jsonb_build_object('added_at', i.added_at)
                 else jsonb_build_object('unavailable', true, 'added_at', i.added_at) end
            order by i.added_at desc), '[]'::jsonb)
          from public.manager_shortlist_items i where i.shortlist_id = p_id);
end $$;

-- Убрать из подборки все строки «анкета недоступна»
create or replace function public.voyage_rcat_shortlist_prune(p_id uuid)
returns integer language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode(); v_n integer;
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  delete from public.manager_shortlist_items i
  using public.manager_shortlists l
  where l.id = i.shortlist_id and l.id = p_id and l.manager_id = me
    and not public.voyage_rcat_can_see(i.resident_id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/* ── 12. Приглашения: менеджер ───────────────────────────────────── */

-- Открытые кастинги, в которые этот пользователь может приглашать (режим «Под кастинг»)
create or replace function public.voyage_rcat_my_castings()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', c.id, 'city', c.city, 'title_i18n', c.title_i18n, 'project_type', c.project_type,
            'starts_on', c.starts_on, 'ends_on', c.ends_on, 'closes_at', c.closes_at,
            'height_min', c.height_min, 'languages', to_jsonb(c.languages),
            'min_kyc_level', c.min_kyc_level, 'audience_segment', c.audience_segment,
            'map_hub_id', c.map_hub_id) order by c.starts_on), '[]'::jsonb)
          from public.partner_castings c
          where c.status = 'open' and c.closes_at > now() and public.voyage_acts_for(c.manager_id));
end $$;

create or replace function public.voyage_rcat_message_ok(p_message text)
returns boolean language sql immutable set search_path to '' as $$
  select p_message is null
      or (char_length(p_message) <= 300
          and p_message !~* '(https?://|www\.|t\.me|wa\.me|telegram\.me|@[a-z0-9_]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\m[a-z0-9-]+\.(com|ru|net|org|io|me|app|link|site|info)\M)'
          and regexp_replace(p_message, '[\s()+.\-]', '', 'g') !~ '[0-9]{7,}')
$$;
revoke all on function public.voyage_rcat_message_ok(text) from public, anon;
grant execute on function public.voyage_rcat_message_ok(text) to authenticated, service_role;

create or replace function public.voyage_rcat_invite(p_resident uuid, p_casting uuid, p_message text default null)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  v_mode text := public.voyage_rcat_mode();
  c public.partner_castings%rowtype;
  v_limits jsonb;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
  v_id uuid;
  v_seg text;
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  if p_resident is null or p_casting is null then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  if not public.voyage_rcat_message_ok(v_msg) then
    raise exception 'voyage:message_contacts' using errcode = '22023';
  end if;
  if not public.voyage_rcat_can_see(p_resident) then
    raise exception 'voyage:unavailable' using errcode = '42501';
  end if;
  select * into c from public.partner_castings x where x.id = p_casting;
  if not found or not public.voyage_acts_for(c.manager_id) then
    raise exception 'voyage:not_your_casting' using errcode = '42501';
  end if;
  if c.status <> 'open' or c.closes_at <= now() then
    raise exception 'voyage:casting_closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.resident_hidden_managers h where h.resident_id = p_resident and h.manager_id = me) then
    raise exception 'voyage:invites_blocked' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rcat_invite:' || me::text, 0));
  perform public.voyage_rcat_expire();

  if exists (select 1 from public.catalog_invites i where i.manager_id = me and i.resident_id = p_resident and i.status = 'pending') then
    raise exception 'voyage:invite_pending' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.catalog_invites i where i.manager_id = me and i.resident_id = p_resident
             and i.status = 'not_now' and i.responded_at > now() - interval '14 days') then
    raise exception 'voyage:invite_cooldown' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.partner_casting_responses r where r.casting_id = p_casting and r.resident_id = p_resident) then
    raise exception 'voyage:already_in_casting' using errcode = 'P0001';
  end if;
  -- те же требования кастинга, что и для обычного отклика (без обходов)
  select p.segment into v_seg from public.profiles p where p.id = p_resident;
  if not public.voyage_casting_kyc_ok(p_resident, p_casting)
     or not (c.audience_segment = 'all' or c.audience_segment = v_seg) then
    raise exception 'voyage:casting_requirements' using errcode = 'P0001';
  end if;
  if public.voyage_rcat_busy_between(p_resident, c.starts_on, c.ends_on) then
    raise exception 'voyage:busy' using errcode = 'P0001';
  end if;

  if v_mode = 'manager' then
    v_limits := public.voyage_rcat_limits(me);
    if (v_limits->>'invites_used')::int >= (v_limits->>'invites')::int then
      perform public.voyage_rcat_limit_event('invites');
      return jsonb_build_object('error', 'limit_invites', 'limits', v_limits);
    end if;
  end if;

  insert into public.catalog_invites (manager_id, resident_id, casting_id, message, expires_at)
  values (me, p_resident, p_casting, v_msg, least(now() + interval '14 days', c.closes_at))
  returning id into v_id;

  perform public.partner_queue_notification(p_resident, 'casting_invite', null,
    jsonb_build_object('ref_id', p_casting, 'city', c.city, 'project', c.project_type,
                       'starts_on', c.starts_on, 'ends_on', c.ends_on, 'closes_at', c.closes_at,
                       'title_i18n', c.title_i18n, 'message', v_msg, 'source', 'catalog'), me);

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, target_label, metadata)
  values ('catalog.invite', me, me, case when v_mode = 'staff' then public.current_user_role()::text else 'manager' end,
          p_resident, left(c.city, 160), jsonb_build_object('invite_id', v_id, 'casting_id', p_casting));

  return jsonb_build_object('id', v_id, 'limits', case when v_mode = 'manager' then public.voyage_rcat_limits(me) end);
end $$;

create or replace function public.voyage_rcat_invite_withdraw(p_invite uuid)
returns boolean language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  update public.catalog_invites i set status = 'withdrawn', responded_at = now()
  where i.id = p_invite and i.manager_id = me and i.status = 'pending';
  return found;
end $$;

create or replace function public.voyage_rcat_sent_invites(p_limit integer default 50)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid(); v_mode text := public.voyage_rcat_mode();
begin
  if v_mode like 'x:%' then raise exception 'voyage:%', substr(v_mode, 3) using errcode = '42501'; end if;
  perform public.voyage_rcat_expire();
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id, 'status', i.status, 'created_at', i.created_at, 'responded_at', i.responded_at,
            'expires_at', i.expires_at, 'casting_id', i.casting_id, 'city', c.city, 'starts_on', c.starts_on,
            'resident_id', case when public.voyage_rcat_can_see(i.resident_id) then i.resident_id end,
            'name', case when public.voyage_rcat_can_see(i.resident_id) then public.voyage_rcat_name(i.resident_id) end)
          order by i.created_at desc), '[]'::jsonb)
          from (select * from public.catalog_invites x where x.manager_id = me
                order by x.created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) i
          join public.partner_castings c on c.id = i.casting_id);
end $$;

/* ── 13. Резидентка ──────────────────────────────────────────────── */

create or replace function public.voyage_my_catalog_state()
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  v public.resident_visibility%rowtype;
begin
  if me is null then raise exception 'voyage:not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.role::text = 'resident') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  perform public.voyage_rcat_expire();
  select * into v from public.resident_visibility x where x.resident_id = me;

  return jsonb_build_object(
    'enabled', coalesce((select s.enabled from public.resident_catalog_settings s where s.id), false),
    'catalog_visible', coalesce(v.catalog_visible, false),
    'catalog_since', v.catalog_since,
    'paused_until', case when v.paused_until > now() then v.paused_until end,
    'show_body_params', coalesce(v.show_body_params, false),
    'video_scope', coalesce(v.video_scope, 'engaged'),
    'video_consent', v.video_consent_at is not null,
    'prompt_dismissed', v.catalog_prompt_dismissed_at is not null,
    'preview_seen', v.preview_seen_at is not null,
    'checklist', public.voyage_rcat_checklist(me),
    'listed', public.voyage_rcat_listed(me),
    'hidden', (select coalesce(jsonb_agg(jsonb_build_object(
                 'manager_id', h.manager_id, 'mode', h.mode, 'since', h.created_at,
                 'label', coalesce(public.partner_short_name(coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''))), 'Manager'),
                 'badge', p.partner_badge) order by h.created_at desc), '[]'::jsonb)
               from public.resident_hidden_managers h join public.profiles p on p.id = h.manager_id
               where h.resident_id = me),
    -- менеджеры, которые смотрели анкету или приглашали за 90 дней, — чтобы можно было скрыться
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'manager_id', r.viewer_id, 'last_at', r.last_at,
                 'label', coalesce(public.partner_short_name(coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''))), 'Manager'),
                 'badge', p.partner_badge) order by r.last_at desc), '[]'::jsonb)
               from (select x.viewer_id, max(x.at) as last_at from (
                       select pv.viewer_id, pv.viewed_at as at from public.resident_profile_views pv
                       where pv.resident_id = me and pv.viewer_kind = 'manager' and pv.viewed_at > now() - interval '90 days'
                       union all
                       select ci.manager_id, ci.created_at from public.catalog_invites ci
                       where ci.resident_id = me and ci.created_at > now() - interval '90 days') x
                     group by x.viewer_id order by max(x.at) desc limit 20) r
               join public.profiles p on p.id = r.viewer_id and p.role::text = 'manager'
               where not exists (select 1 from public.resident_hidden_managers h where h.resident_id = me and h.manager_id = r.viewer_id)),
    -- пульс за 7 дней: только реальные числа, без имён и названий подборок
    'pulse', jsonb_build_object(
      'views', (select count(distinct pv.viewer_id) from public.resident_profile_views pv
                where pv.resident_id = me and pv.viewer_kind = 'manager' and pv.viewed_at > now() - interval '7 days'),
      'catalog_views', (select count(distinct pv.viewer_id) from public.resident_profile_views pv
                        where pv.resident_id = me and pv.viewer_kind = 'manager' and pv.context = 'catalog'
                          and pv.viewed_at > now() - interval '7 days'),
      'shortlisted', (select count(*) from public.manager_shortlist_items i
                      where i.resident_id = me and i.added_at > now() - interval '7 days'),
      'invites', (select count(*) from public.catalog_invites ci
                  where ci.resident_id = me and ci.created_at > now() - interval '7 days')));
end $$;

create or replace function public.voyage_set_catalog_visibility(
  p_visible boolean default null, p_body boolean default null, p_pause_days integer default null,
  p_dismiss_prompt boolean default null, p_preview_seen boolean default null)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  v public.resident_visibility%rowtype;
begin
  if me is null then raise exception 'voyage:not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.role::text = 'resident') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_pause_days is not null and p_pause_days not in (0, 7, 14, 30) then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;

  insert into public.resident_visibility (resident_id) values (me) on conflict (resident_id) do nothing;
  select * into v from public.resident_visibility x where x.resident_id = me for update;

  if p_preview_seen then
    v.preview_seen_at := coalesce(v.preview_seen_at, now());
  end if;
  if p_visible is true and not v.catalog_visible then
    -- перед первым включением резидентка обязательно смотрит «так вас видит менеджер»
    if v.preview_seen_at is null then
      raise exception 'voyage:preview_required' using errcode = 'P0001';
    end if;
    v.catalog_visible := true;
    v.catalog_since := now();
  elsif p_visible is false then
    v.catalog_visible := false;
  end if;
  if p_body is not null then v.show_body_params := p_body; end if;
  if p_pause_days = 0 then v.paused_until := null;
  elsif p_pause_days is not null then v.paused_until := now() + make_interval(days => p_pause_days);
  end if;
  if p_dismiss_prompt then v.catalog_prompt_dismissed_at := coalesce(v.catalog_prompt_dismissed_at, now()); end if;

  update public.resident_visibility x
     set catalog_visible = v.catalog_visible, catalog_since = v.catalog_since,
         show_body_params = v.show_body_params, paused_until = v.paused_until,
         catalog_prompt_dismissed_at = v.catalog_prompt_dismissed_at, preview_seen_at = v.preview_seen_at,
         updated_at = now()
   where x.resident_id = me;

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, metadata)
  values ('resident.catalog_visibility', me, me, 'resident', me,
          jsonb_build_object('catalog', v.catalog_visible, 'body', v.show_body_params, 'paused_until', v.paused_until));

  return public.voyage_my_catalog_state();
end $$;

-- «Скрыться от менеджера» (hidden), «Не приглашать меня» (no_invites), null — снять.
-- Только менеджеры, которые её уже смотрели или приглашали (никакого перебора id).
create or replace function public.voyage_set_manager_hidden(p_manager uuid, p_mode text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'voyage:not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.role::text = 'resident') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_mode is not null and p_mode not in ('hidden', 'no_invites') then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  if p_mode is null then
    delete from public.resident_hidden_managers h where h.resident_id = me and h.manager_id = p_manager;
  else
    if not exists (select 1 from public.resident_profile_views pv where pv.resident_id = me and pv.viewer_id = p_manager and pv.viewer_kind = 'manager')
       and not exists (select 1 from public.catalog_invites ci where ci.resident_id = me and ci.manager_id = p_manager)
       and not exists (select 1 from public.resident_hidden_managers h where h.resident_id = me and h.manager_id = p_manager) then
      raise exception 'voyage:not_found' using errcode = 'P0002';
    end if;
    insert into public.resident_hidden_managers (resident_id, manager_id, mode) values (me, p_manager, p_mode)
    on conflict (resident_id, manager_id) do update set mode = excluded.mode;
    update public.catalog_invites i set status = 'blocked', responded_at = now()
    where i.resident_id = me and i.manager_id = p_manager and i.status = 'pending';
  end if;
  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, metadata)
  values ('resident.catalog_hide_manager', me, me, 'resident', me, jsonb_build_object('manager_id', p_manager, 'mode', p_mode));
  return public.voyage_my_catalog_state();
end $$;

create or replace function public.voyage_catalog_preview()
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'voyage:not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.role::text = 'resident') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  insert into public.resident_visibility (resident_id) values (me) on conflict (resident_id) do nothing;
  return jsonb_build_object('card', public.voyage_rcat_card_json(me, null), 'checklist', public.voyage_rcat_checklist(me));
end $$;

create or replace function public.voyage_my_catalog_invites()
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'voyage:not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.role::text = 'resident') then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  perform public.voyage_rcat_expire();
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id, 'status', i.status, 'message', i.message, 'created_at', i.created_at,
            'expires_at', i.expires_at, 'responded_at', i.responded_at,
            'casting', jsonb_build_object('id', c.id, 'city', c.city, 'title_i18n', c.title_i18n,
                         'project_type', c.project_type, 'starts_on', c.starts_on, 'ends_on', c.ends_on,
                         'closes_at', c.closes_at, 'fee_amount', c.fee_amount, 'fee_currency', c.fee_currency,
                         'flight_paid_by', c.flight_paid_by, 'hotel_paid_by', c.hotel_paid_by,
                         'open', c.status = 'open' and c.closes_at > now()),
            'manager', jsonb_build_object(
                         'label', coalesce(public.partner_short_name(coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''))), 'Manager'),
                         'badge', p.partner_badge,
                         'tours_done', (select count(*) from public.partner_tours t where t.manager_id = i.manager_id and t.status = 'closed')),
            'can_respond', case when i.status in ('pending', 'interested') then public.partner_me_can_respond(c.id) else false end,
            'responded', exists (select 1 from public.partner_casting_responses r where r.casting_id = c.id and r.resident_id = me),
            'open_to_tours', coalesce((select s.open_to_tours from public.partner_resident_settings s where s.resident_id = me), false))
          order by (i.status = 'pending') desc, i.created_at desc), '[]'::jsonb)
          from public.catalog_invites i
          join public.partner_castings c on c.id = i.casting_id
          join public.profiles p on p.id = i.manager_id
          where i.resident_id = me
            and (i.status in ('pending', 'interested') or i.created_at > now() - interval '30 days')
            and i.status not in ('withdrawn'));
end $$;

create or replace function public.voyage_catalog_invite_respond(p_invite uuid, p_answer text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare
  me uuid := auth.uid();
  i public.catalog_invites%rowtype;
begin
  if me is null then raise exception 'voyage:not_authenticated' using errcode = '28000'; end if;
  if p_answer not in ('interested', 'not_now', 'blocked') then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  perform public.voyage_rcat_expire();
  select * into i from public.catalog_invites x where x.id = p_invite and x.resident_id = me for update;
  if not found then raise exception 'voyage:not_found' using errcode = 'P0002'; end if;
  if i.status <> 'pending' then raise exception 'voyage:invite_closed' using errcode = 'P0001'; end if;

  update public.catalog_invites x set status = p_answer, responded_at = now() where x.id = p_invite;
  if p_answer = 'blocked' then
    insert into public.resident_hidden_managers (resident_id, manager_id, mode) values (me, i.manager_id, 'no_invites')
    on conflict (resident_id, manager_id) do nothing;
  end if;
  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, metadata)
  values ('resident.catalog_invite_answer', me, me, 'resident', me,
          jsonb_build_object('invite_id', p_invite, 'answer', p_answer, 'casting_id', i.casting_id));
  return jsonb_build_object('status', p_answer, 'casting_id', i.casting_id,
                            'can_respond', p_answer = 'interested' and public.partner_me_can_respond(i.casting_id));
end $$;

/* ── 14. Owner / admin ───────────────────────────────────────────── */

create or replace function public.voyage_owner_catalog_overview()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare s public.resident_catalog_settings%rowtype;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'voyage:forbidden' using errcode = '42501'; end if;
  select * into s from public.resident_catalog_settings x where x.id;
  return jsonb_build_object(
    'can_manage', public.voyage_ops_role() = 'owner',
    'settings', jsonb_build_object('enabled', s.enabled, 'default_open_limit', s.default_open_limit,
                                   'default_invite_limit', s.default_invite_limit, 'updated_at', s.updated_at),
    'residents', jsonb_build_object(
      'opted_in', (select count(*) from public.resident_visibility v where v.catalog_visible),
      'listed', (select count(*) from public.resident_visibility v where v.catalog_visible and public.voyage_rcat_listed(v.resident_id)),
      'paused', (select count(*) from public.resident_visibility v where v.catalog_visible and v.paused_until > now()),
      'video_catalog', (select count(*) from public.resident_visibility v where v.catalog_visible and v.video_scope = 'catalog' and v.video_consent_at is not null)),
    'invites_7d', (select count(*) from public.catalog_invites i where i.created_at > now() - interval '7 days'),
    'managers', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', p.id, 'name', coalesce(nullif(btrim(p.full_name), ''), p.name, p.email),
                   'agency', p.agency_name, 'badge', p.partner_badge, 'status', p.status,
                   'eligible', public.voyage_rcat_manager_eligible(p.id),
                   'code', public.voyage_rcat_manager_code(p.id),
                   'access', case when a.manager_id is not null then jsonb_build_object(
                       'status', a.status, 'open_limit', a.daily_open_limit, 'invite_limit', a.daily_invite_limit,
                       'expires_at', a.expires_at, 'reason', a.reason, 'updated_at', a.updated_at) end,
                   'today', public.voyage_rcat_limits(p.id),
                   'last_limit_at', (select max(l.created_at) from public.audit_logs l
                                     where l.action = 'catalog.limit_reached' and l.actor_profile_id = p.id))
                 order by (a.status = 'active') desc nulls last, p.full_name), '[]'::jsonb)
                 from public.profiles p
                 left join public.manager_catalog_access a on a.manager_id = p.id
                 where p.role::text = 'manager' and not coalesce(p.is_system, false) and not coalesce(p.is_npc, false)),
    -- события превышения лимитов (отдельно, чтобы их не вытесняли изменения доступа)
    'limit_events', (select coalesce(jsonb_agg(jsonb_build_object('at', l.created_at, 'kind', l.metadata->>'kind',
                   'manager', coalesce(nullif(btrim(p.full_name), ''), p.name)) order by l.created_at desc), '[]'::jsonb)
               from (select * from public.audit_logs x where x.action = 'catalog.limit_reached'
                     order by x.created_at desc limit 30) l
               left join public.profiles p on p.id = l.actor_profile_id),
    'access_events', (select coalesce(jsonb_agg(jsonb_build_object('at', l.created_at, 'action', l.action,
                   'manager', coalesce(nullif(btrim(t.full_name), ''), t.name), 'metadata', l.metadata) order by l.created_at desc), '[]'::jsonb)
               from (select * from public.audit_logs x where x.action in ('catalog.access', 'catalog.settings')
                     order by x.created_at desc limit 20) l
               left join public.profiles t on t.id = l.target_profile_id));
end $$;

create or replace function public.voyage_owner_catalog_set_access(
  p_manager uuid, p_status text, p_open_limit integer, p_invite_limit integer,
  p_expires_at timestamptz, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid();
begin
  if public.voyage_ops_role() is distinct from 'owner' then raise exception 'voyage:forbidden' using errcode = '42501'; end if;
  if p_status not in ('active', 'suspended', 'none') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  if p_status = 'active' and not public.voyage_rcat_manager_eligible(p_manager) then
    raise exception 'voyage:manager_not_eligible' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_manager and p.role::text = 'manager') then
    raise exception 'voyage:not_found' using errcode = 'P0002';
  end if;

  if p_status = 'none' then
    delete from public.manager_catalog_access a where a.manager_id = p_manager;
  else
    insert into public.manager_catalog_access as a
      (manager_id, status, daily_open_limit, daily_invite_limit, expires_at, reason, granted_by, updated_by)
    values (p_manager, p_status, p_open_limit, p_invite_limit, p_expires_at, btrim(p_reason), me, me)
    on conflict (manager_id) do update
      set status = excluded.status, daily_open_limit = excluded.daily_open_limit,
          daily_invite_limit = excluded.daily_invite_limit, expires_at = excluded.expires_at,
          reason = excluded.reason, updated_by = me, updated_at = now();
  end if;

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, metadata)
  values ('catalog.access', me, me, 'owner', p_manager,
          jsonb_build_object('status', p_status, 'open_limit', p_open_limit, 'invite_limit', p_invite_limit,
                             'expires_at', p_expires_at, 'reason', btrim(p_reason)));
  return public.voyage_owner_catalog_overview();
end $$;

create or replace function public.voyage_owner_catalog_settings(
  p_enabled boolean, p_open_limit integer, p_invite_limit integer, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare me uuid := auth.uid();
begin
  if public.voyage_ops_role() is distinct from 'owner' then raise exception 'voyage:forbidden' using errcode = '42501'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  update public.resident_catalog_settings s
     set enabled = coalesce(p_enabled, s.enabled),
         default_open_limit = coalesce(p_open_limit, s.default_open_limit),
         default_invite_limit = coalesce(p_invite_limit, s.default_invite_limit),
         updated_by = me, updated_at = now()
   where s.id;
  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, metadata)
  values ('catalog.settings', me, me, 'owner',
          jsonb_build_object('enabled', p_enabled, 'open_limit', p_open_limit, 'invite_limit', p_invite_limit, 'reason', btrim(p_reason)));
  return public.voyage_owner_catalog_overview();
end $$;

-- Строка каталога в /admin/database/[id]
create or replace function public.voyage_staff_catalog_status(p_resident uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v public.resident_visibility%rowtype;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'voyage:forbidden' using errcode = '42501'; end if;
  select * into v from public.resident_visibility x where x.resident_id = p_resident;
  return jsonb_build_object(
    'enabled', coalesce((select s.enabled from public.resident_catalog_settings s where s.id), false),
    'catalog_visible', coalesce(v.catalog_visible, false),
    'paused_until', case when v.paused_until > now() then v.paused_until end,
    'listed', public.voyage_rcat_listed(p_resident),
    'checklist', public.voyage_rcat_checklist(p_resident),
    'video_scope', coalesce(v.video_scope, 'engaged'),
    'views_30d', (select count(distinct pv.viewer_id) from public.resident_profile_views pv
                  where pv.resident_id = p_resident and pv.context = 'catalog' and pv.viewer_kind = 'manager'
                    and pv.viewed_at > now() - interval '30 days'),
    'invites_30d', (select count(*) from public.catalog_invites i
                    where i.resident_id = p_resident and i.created_at > now() - interval '30 days'));
end $$;

/* ── 15. Права на RPC ────────────────────────────────────────────── */

do $$
declare f text;
begin
  foreach f in array array[
    'voyage_rcat_viewer()', 'voyage_rcat_search(jsonb,integer)', 'voyage_rcat_card(uuid)',
    'voyage_rcat_shortlists()', 'voyage_rcat_shortlist_save(uuid,text)', 'voyage_rcat_shortlist_delete(uuid)',
    'voyage_rcat_shortlist_toggle(uuid,uuid,boolean)', 'voyage_rcat_shortlist_items(uuid)', 'voyage_rcat_shortlist_prune(uuid)',
    'voyage_rcat_my_castings()', 'voyage_rcat_invite(uuid,uuid,text)', 'voyage_rcat_invite_withdraw(uuid)',
    'voyage_rcat_sent_invites(integer)',
    'voyage_my_catalog_state()', 'voyage_set_catalog_visibility(boolean,boolean,integer,boolean,boolean)',
    'voyage_set_manager_hidden(uuid,text)', 'voyage_catalog_preview()', 'voyage_my_catalog_invites()',
    'voyage_catalog_invite_respond(uuid,text)',
    'voyage_owner_catalog_overview()', 'voyage_owner_catalog_set_access(uuid,text,integer,integer,timestamptz,text)',
    'voyage_owner_catalog_settings(boolean,integer,integer,text)', 'voyage_staff_catalog_status(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

commit;
