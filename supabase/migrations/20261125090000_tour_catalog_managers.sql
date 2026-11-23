-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Туры каталога: назначенные менеджеры, приватная заметка
--          владельца, история изменений (25.11.2026)
-- supabase/migrations/20261125090000_tour_catalog_managers.sql
--
-- Модель:  Map Location (map_hubs) → Tour Catalog (tour_catalog, направление
--          с базовыми условиями) → Partner Casting (partner_castings, набор
--          под даты) → Partner Tour (partner_tours, поездка из кастинга).
--
-- 1. public.tour_catalog_managers — многие-ко-многим «тур ↔ менеджер» с
--    историей: кто назначил, когда, кто и почему отозвал. Писать — только
--    RPC владельца (is_owner(), НЕ is_admin()). Строки не удаляются, отзыв
--    = is_active false. Один активный менеджер на тур — один раз.
--    Организационный ответственный — существующий системный профиль
--    VOYAGE Management (voyage_management_id(), миграция 20261022090000).
-- 2. public.tour_catalog_owner_notes — внутренняя заметка владельца по туру.
--    Отдельная таблица, RLS только is_owner(): admin, менеджеры, резидентки
--    и все RPC каталога её не видят. Отзыв назначения заметку не трогает.
-- 3. tour_catalog: менеджер видит только туры с активным назначением (и
--    туры своих прежних кастингов — только чтение), правит только
--    назначенные; локация, slug, порядок и служебные поля защищены триггером.
-- 4. partner_castings: менеджер создаёт кастинг только на тур, где у него
--    активное назначение. После отзыва — свои кастинги можно только
--    сворачивать (шорт-лист / закрыть / отменить / архив); поездки и
--    отклики продолжают работать как раньше. Владелец может передать
--    открытые кастинги без поездки другому назначенному менеджеру или
--    VOYAGE Management (voyage_owner_transfer_casting).
-- 5. История изменений тура — существующий append-only public.audit_logs
--    (миграция 20261102100000, читает только owner): триггер пишет автора,
--    его роль, поля, старые и новые значения.
-- 6. Закрыта дыра: TRUNCATE на tour_catalog у authenticated (обходит RLS).
--
-- Права admin не расширяются: admin, как и раньше, правит каталог и
-- создаёт кастинги от VOYAGE Management, но не видит заметок и не
-- управляет назначениями.
--
-- Требует: 20261022090000, 20261102100000, 20261103090000, 20261113090000…
--          и geo-locations-final.zip (20261124090000: несколько туров в
--          локации). Идемпотентна: можно прогнать повторно.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regprocedure('public.voyage_management_id()') is null then
    raise exception 'VOYAGE: сначала примените 20261022090000_voyage_management_organizer.sql';
  end if;
  if to_regclass('public.audit_logs') is null then
    raise exception 'VOYAGE: сначала примените 20261102100000_resident_sizes_dossier_audit.sql';
  end if;
  if to_regprocedure('public.voyage_ops_display_name(uuid)') is null then
    raise exception 'VOYAGE: сначала примените миграции tour-ops-stage1 (20261113090000…095000)';
  end if;
  if to_regclass('public.tour_catalog_map_hub_key') is not null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'map_hubs' and column_name = 'archived_at') then
    raise exception 'VOYAGE: сначала установите geo-locations-final.zip (миграция 20261124090000_geo_multi_tour_archive.sql)';
  end if;
  if not exists (select 1 from public.profiles where id = public.voyage_management_id() and is_system) then
    raise exception 'VOYAGE: нет системного профиля VOYAGE Management (миграция 20261022090000)';
  end if;
end $$;

/* ── 0. Кто может вести тур ────────────────────────────────────────── */

-- Действующий менеджер: роль manager, одобрен, без бана. VOYAGE Management
-- (is_system) подходит. owner/admin/резидентки/операторы/скауты — нет.
create or replace function public.voyage_catalog_manager_eligible(p_profile uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile
      and p.role::text = 'manager'
      and (p.is_system or coalesce(p.status, '') = 'approved')
      and not coalesce(p.is_npc, false)
      and not coalesce(p.ban_permanent, false)
      and (p.banned_until is null or p.banned_until <= now())
  )
$$;

revoke all on function public.voyage_catalog_manager_eligible(uuid) from public, anon, authenticated;
grant execute on function public.voyage_catalog_manager_eligible(uuid) to service_role;

/* ── 1. Назначения менеджеров ──────────────────────────────────────── */

create table if not exists public.tour_catalog_managers (
  id uuid primary key default gen_random_uuid(),
  -- SET NULL: удаление тура или профиля не стирает историю назначений
  catalog_tour_id uuid references public.tour_catalog(id) on delete set null,
  manager_id uuid references public.profiles(id) on delete set null,
  tour_label text not null default '',
  manager_label text not null default '',
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  assign_note text,
  source text not null default 'owner',
  is_active boolean not null default true,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null default now(),
  constraint tour_catalog_managers_state_check check (
    (is_active and revoked_at is null) or (not is_active and revoked_at is not null)
  ),
  constraint tour_catalog_managers_source_check check (source in ('owner', 'backfill')),
  constraint tour_catalog_managers_note_check check (assign_note is null or char_length(assign_note) <= 500),
  constraint tour_catalog_managers_reason_check check (revoke_reason is null or char_length(revoke_reason) <= 500),
  constraint tour_catalog_managers_labels_check check (char_length(tour_label) <= 120 and char_length(manager_label) <= 160)
);

comment on table public.tour_catalog_managers is
  'Менеджеры туров каталога (многие-ко-многим) с историей назначений и отзывов. Пишут только RPC владельца voyage_owner_assign_catalog_manager / voyage_owner_revoke_catalog_manager. Строки не удаляются.';

create unique index if not exists tour_catalog_managers_active_key
  on public.tour_catalog_managers (catalog_tour_id, manager_id)
  where is_active and catalog_tour_id is not null and manager_id is not null;
create index if not exists tour_catalog_managers_manager_idx
  on public.tour_catalog_managers (manager_id, catalog_tour_id) where is_active;
create index if not exists tour_catalog_managers_tour_idx
  on public.tour_catalog_managers (catalog_tour_id, assigned_at desc);

-- Подписи для истории (тур или профиль могут быть удалены позже)
create or replace function public.tour_catalog_managers_labels()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if new.tour_label = '' and new.catalog_tour_id is not null then
    select left(t.slug, 120) into new.tour_label from public.tour_catalog t where t.id = new.catalog_tour_id;
  end if;
  if new.manager_label = '' and new.manager_id is not null then
    new.manager_label := left(public.voyage_ops_display_name(new.manager_id), 160);
  end if;
  new.tour_label := coalesce(new.tour_label, '');
  new.manager_label := coalesce(new.manager_label, '');
  return new;
end $$;

drop trigger if exists tour_catalog_managers_labels on public.tour_catalog_managers;
create trigger tour_catalog_managers_labels
  before insert on public.tour_catalog_managers
  for each row execute function public.tour_catalog_managers_labels();

-- История неизменяема: удалять нельзя; менять можно только «активно → отозвано»
-- и обнулять ссылки (ON DELETE SET NULL при удалении тура или профиля).
create or replace function public.tour_catalog_managers_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if current_setting('voyage.audit_maintenance', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'voyage:assignment_history_immutable' using errcode = '42501';
  end if;
  if new.id <> old.id
     or new.tour_label <> old.tour_label
     or new.manager_label <> old.manager_label
     or new.assigned_at <> old.assigned_at
     or new.assign_note is distinct from old.assign_note
     or new.source <> old.source
     or new.created_at <> old.created_at
     or (new.catalog_tour_id is distinct from old.catalog_tour_id and new.catalog_tour_id is not null)
     or (new.manager_id is distinct from old.manager_id and new.manager_id is not null)
     or (new.assigned_by is distinct from old.assigned_by and new.assigned_by is not null) then
    raise exception 'voyage:assignment_history_immutable' using errcode = '42501';
  end if;
  if not old.is_active and (
       new.is_active
       or new.revoked_at is distinct from old.revoked_at
       or new.revoke_reason is distinct from old.revoke_reason
       or (new.revoked_by is distinct from old.revoked_by and new.revoked_by is not null)) then
    raise exception 'voyage:assignment_history_immutable' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists tour_catalog_managers_guard on public.tour_catalog_managers;
create trigger tour_catalog_managers_guard
  before update or delete on public.tour_catalog_managers
  for each row execute function public.tour_catalog_managers_guard();

alter table public.tour_catalog_managers enable row level security;

drop policy if exists tour_catalog_managers_select on public.tour_catalog_managers;
create policy tour_catalog_managers_select on public.tour_catalog_managers
  for select to authenticated
  using ((select public.is_owner()) or manager_id = (select auth.uid()));

-- Прямой записи у клиентов нет: только RPC ниже (SECURITY DEFINER, owner)
revoke all on table public.tour_catalog_managers from public, anon, authenticated;
grant select on table public.tour_catalog_managers to authenticated;
grant all on table public.tour_catalog_managers to service_role;

-- Активное назначение текущего пользователя на тур (только про себя)
create or replace function public.voyage_catalog_i_manage(p_tour uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.tour_catalog_managers m
       where m.catalog_tour_id = p_tour and m.manager_id = auth.uid() and m.is_active
     )
     and public.voyage_catalog_manager_eligible(auth.uid())
$$;

-- Менеджер читает тур: активное назначение ИЛИ свой кастинг на этом туре.
-- Второе важно: триггер partner_castings_sync_i18n (SECURITY INVOKER) читает
-- тур при каждой правке кастинга, и после отзыва он должен видеть тур.
create or replace function public.voyage_catalog_manager_can_read(p_tour uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select auth.uid() is not null and (
    public.voyage_catalog_i_manage(p_tour)
    or exists (select 1 from public.partner_castings c
               where c.catalog_tour_id = p_tour and c.manager_id = auth.uid())
  )
$$;

revoke all on function public.voyage_catalog_i_manage(uuid) from public, anon;
revoke all on function public.voyage_catalog_manager_can_read(uuid) from public, anon;
grant execute on function public.voyage_catalog_i_manage(uuid) to authenticated, service_role;
grant execute on function public.voyage_catalog_manager_can_read(uuid) to authenticated, service_role;

/* ── 2. Внутренняя заметка владельца ───────────────────────────────── */

create table if not exists public.tour_catalog_owner_notes (
  id uuid primary key default gen_random_uuid(),
  -- SET NULL: заметка переживает даже удаление тура (видна владельцу по tour_label)
  catalog_tour_id uuid references public.tour_catalog(id) on delete set null,
  tour_label text not null default '',
  body text not null default '',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_catalog_owner_notes_tour_key unique (catalog_tour_id),
  constraint tour_catalog_owner_notes_body_check check (char_length(body) <= 8000)
);

comment on table public.tour_catalog_owner_notes is
  'Приватная заметка владельца VOYAGE по туру каталога (контакты, договорённости с менеджерами). Только owner (RLS is_owner()). Не входит ни в один RPC и не попадает в уведомления.';

create or replace function public.tour_catalog_owner_notes_touch()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  if new.catalog_tour_id is not null and (tg_op = 'INSERT' or new.catalog_tour_id is distinct from old.catalog_tour_id or new.tour_label = '') then
    select left(t.slug, 120) into new.tour_label from public.tour_catalog t where t.id = new.catalog_tour_id;
  end if;
  new.tour_label := coalesce(new.tour_label, '');
  return new;
end $$;

drop trigger if exists tour_catalog_owner_notes_touch on public.tour_catalog_owner_notes;
create trigger tour_catalog_owner_notes_touch
  before insert or update on public.tour_catalog_owner_notes
  for each row execute function public.tour_catalog_owner_notes_touch();

alter table public.tour_catalog_owner_notes enable row level security;

drop policy if exists tour_catalog_owner_notes_select on public.tour_catalog_owner_notes;
create policy tour_catalog_owner_notes_select on public.tour_catalog_owner_notes
  for select to authenticated using ((select public.is_owner()));
drop policy if exists tour_catalog_owner_notes_insert on public.tour_catalog_owner_notes;
create policy tour_catalog_owner_notes_insert on public.tour_catalog_owner_notes
  for insert to authenticated with check ((select public.is_owner()));
drop policy if exists tour_catalog_owner_notes_update on public.tour_catalog_owner_notes;
create policy tour_catalog_owner_notes_update on public.tour_catalog_owner_notes
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
drop policy if exists tour_catalog_owner_notes_delete on public.tour_catalog_owner_notes;
create policy tour_catalog_owner_notes_delete on public.tour_catalog_owner_notes
  for delete to authenticated using ((select public.is_owner()));

revoke all on table public.tour_catalog_owner_notes from public, anon, authenticated;
grant select, delete on table public.tour_catalog_owner_notes to authenticated;
grant insert (catalog_tour_id, body) on table public.tour_catalog_owner_notes to authenticated;
grant update (body) on table public.tour_catalog_owner_notes to authenticated;
grant all on table public.tour_catalog_owner_notes to service_role;

-- В журнал — только факт и длина, без текста заметки
create or replace function public.tour_catalog_owner_notes_audit()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  if tg_op = 'UPDATE' and new.body = old.body then
    return new;
  end if;
  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_label, metadata)
  values ('tour_catalog.owner_note', auth.uid(), auth.uid(),
          coalesce(public.current_user_role()::text, 'system'),
          left(coalesce(new.tour_label, old.tour_label), 120),
          jsonb_build_object('catalog_tour_id', coalesce(new.catalog_tour_id, old.catalog_tour_id),
                             'op', lower(tg_op),
                             'length', char_length(coalesce(new.body, ''))));
  return new;
end $$;

drop trigger if exists tour_catalog_owner_notes_audit on public.tour_catalog_owner_notes;
create trigger tour_catalog_owner_notes_audit
  after insert or update of body on public.tour_catalog_owner_notes
  for each row execute function public.tour_catalog_owner_notes_audit();

/* ── 3. tour_catalog: чтение и правка для назначенных менеджеров ───── */

-- Было: is_active OR is_staff() — любой менеджер видел весь каталог.
drop policy if exists tour_catalog_select on public.tour_catalog;
create policy tour_catalog_select on public.tour_catalog
  for select to authenticated
  using (
    (select public.is_admin())
    or case
         when (select public.current_user_role()) = 'manager'::public.app_role
           then public.voyage_catalog_manager_can_read(id)
         else is_active
       end
  );

-- Было: только is_admin(). Теперь + менеджер с активным назначением.
drop policy if exists tour_catalog_update on public.tour_catalog;
create policy tour_catalog_update on public.tour_catalog
  for update to authenticated
  using ((select public.is_admin()) or public.voyage_catalog_i_manage(id))
  with check ((select public.is_admin()) or public.voyage_catalog_i_manage(id));

-- insert / delete — без изменений (is_admin()).

-- TRUNCATE обходит RLS — клиентам он не нужен
revoke truncate, references, trigger on table public.tour_catalog from public, anon, authenticated;

-- Менеджер не меняет локацию, адрес, порядок и служебные поля.
-- Имя «zz» — триггер идёт последним среди BEFORE UPDATE (после sync_hub и touch).
-- city / region / country_code вычисляет tour_catalog_sync_hub из map_hub_id.
create or replace function public.tour_catalog_manager_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    return new;
  end if;
  if new.id <> old.id
     or new.slug <> old.slug
     or new.map_hub_id is distinct from old.map_hub_id
     or new.destination_id is distinct from old.destination_id
     or new.cover_url is distinct from old.cover_url
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at
     or new.sort_order <> old.sort_order then
    raise exception 'voyage:catalog_field_forbidden' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists tour_catalog_zz_manager_guard on public.tour_catalog;
create trigger tour_catalog_zz_manager_guard
  before update on public.tour_catalog
  for each row execute function public.tour_catalog_manager_guard();

/* ── 4. История изменений тура → audit_logs ────────────────────────── */

create or replace function public.tour_catalog_audit()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  v_fields constant text[] := array[
    'title_i18n', 'description_i18n', 'requirements_i18n', 'conditions_i18n',
    'project_type', 'audience_segment', 'source_lang',
    'fee_amount', 'fee_currency', 'height_min', 'flight_paid_by', 'hotel_paid_by', 'languages',
    'is_active', 'sort_order', 'map_hub_id', 'slug', 'city', 'country_code', 'region',
    'cover_url', 'destination_id'
  ];
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_changes jsonb := '{}'::jsonb;
  v_field text;
  v_role text;
begin
  foreach v_field in array v_fields loop
    if (v_old -> v_field) is distinct from (v_new -> v_field) then
      v_changes := v_changes || jsonb_build_object(v_field, jsonb_build_object('old', v_old -> v_field, 'new', v_new -> v_field));
    end if;
  end loop;
  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return null;
  end if;
  v_role := coalesce(public.current_user_role()::text,
                     case when coalesce(auth.role(), '') = 'service_role' then 'service' else 'system' end);
  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_label, metadata)
  values ('tour_catalog.' || case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
          auth.uid(), auth.uid(), v_role,
          left(coalesce(v_new ->> 'slug', v_old ->> 'slug'), 120),
          jsonb_build_object(
            'catalog_tour_id', coalesce(v_new ->> 'id', v_old ->> 'id'),
            'changes', v_changes,
            -- cascade — правка пришла из другого триггера (например, переименование локации)
            'source', case when pg_trigger_depth() > 1 then 'cascade' else 'direct' end,
            'as_assigned_manager', coalesce(v_role = 'manager' and public.voyage_catalog_i_manage((coalesce(v_new ->> 'id', v_old ->> 'id'))::uuid), false)
          ));
  return null;
end $$;

drop trigger if exists tour_catalog_audit on public.tour_catalog;
create trigger tour_catalog_audit
  after insert or update or delete on public.tour_catalog
  for each row execute function public.tour_catalog_audit();

create index if not exists audit_logs_catalog_tour_idx
  on public.audit_logs ((metadata ->> 'catalog_tour_id'), created_at desc)
  where action like 'tour_catalog.%';

/* ── 5. partner_castings: кастинг — только по активному назначению ─── */

-- Имя «catalog_assignment» — триггер идёт раньше check_organizer и sync_i18n.
create or replace function public.partner_castings_catalog_assignment()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_tour uuid;
  v_skip constant text[] := array['status', 'manager_seen_at', 'updated_at', 'city', 'map_hub_id', 'brief', 'closes_at'];
begin
  -- owner/admin и серверные процессы (auth.uid() null) — как раньше
  if auth.uid() is null or coalesce(public.is_admin(), false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Без тура кастинг не примет partner_castings_sync_i18n (catalog_tour_required)
    if new.catalog_tour_id is not null and not public.voyage_catalog_i_manage(new.catalog_tour_id) then
      raise exception 'voyage:catalog_tour_not_assigned' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Перенос кастинга на другой тур — только на назначенный
  if new.catalog_tour_id is distinct from old.catalog_tour_id
     and new.catalog_tour_id is not null
     and not public.voyage_catalog_i_manage(new.catalog_tour_id) then
    raise exception 'voyage:catalog_tour_not_assigned' using errcode = '42501';
  end if;

  v_tour := coalesce(new.catalog_tour_id, old.catalog_tour_id);
  -- Старые кастинги без тура и кастинги по действующему назначению — без изменений
  if v_tour is null or public.voyage_catalog_i_manage(v_tour) then
    return new;
  end if;
  -- Кастинг, созданный до назначений (тур ещё не распределён владельцем):
  -- работа действующего менеджера не прерывается, ограничение — только после
  -- явного отзыва назначения владельцем.
  if not exists (select 1 from public.tour_catalog_managers m
                 where m.catalog_tour_id = v_tour and m.manager_id = auth.uid() and not m.is_active) then
    return new;
  end if;

  -- Назначение отозвано: набор можно только сворачивать.
  if new.status is distinct from old.status
     and not (new.status in ('closed', 'cancelled', 'archived') or (old.status = 'open' and new.status = 'shortlist')) then
    raise exception 'voyage:catalog_assignment_revoked' using errcode = '42501';
  end if;
  -- Продлить приём откликов нельзя (минута — запас на округление формы)
  if new.closes_at > old.closes_at + interval '1 minute' then
    raise exception 'voyage:catalog_assignment_revoked' using errcode = '42501';
  end if;
  -- Условия набора не меняются (brief пересчитывает sync_i18n из brief_i18n)
  if (to_jsonb(new) - v_skip) is distinct from (to_jsonb(old) - v_skip) then
    raise exception 'voyage:catalog_assignment_revoked' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists partner_castings_catalog_assignment on public.partner_castings;
create trigger partner_castings_catalog_assignment
  before insert or update on public.partner_castings
  for each row execute function public.partner_castings_catalog_assignment();

/* ── 6. RPC владельца ──────────────────────────────────────────────── */

create or replace function public.voyage_catalog_assignment_json(p_row public.tour_catalog_managers)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'catalog_tour_id', p_row.catalog_tour_id,
    'tour_label', p_row.tour_label,
    'manager_id', p_row.manager_id,
    'manager_name', coalesce(case when p_row.manager_id is not null then public.voyage_ops_display_name(p_row.manager_id) end, nullif(p_row.manager_label, ''), '—'),
    'manager_is_system', coalesce((select p.is_system from public.profiles p where p.id = p_row.manager_id), false),
    'manager_eligible', public.voyage_catalog_manager_eligible(p_row.manager_id),
    'assigned_by', p_row.assigned_by,
    'assigned_by_name', case when p_row.assigned_by is not null then public.voyage_ops_display_name(p_row.assigned_by) end,
    'assigned_at', p_row.assigned_at,
    'assign_note', p_row.assign_note,
    'source', p_row.source,
    'is_active', p_row.is_active,
    'revoked_at', p_row.revoked_at,
    'revoked_by', p_row.revoked_by,
    'revoked_by_name', case when p_row.revoked_by is not null then public.voyage_ops_display_name(p_row.revoked_by) end,
    'revoke_reason', p_row.revoke_reason
  )
$$;

revoke all on function public.voyage_catalog_assignment_json(public.tour_catalog_managers) from public, anon, authenticated;
grant execute on function public.voyage_catalog_assignment_json(public.tour_catalog_managers) to service_role;

-- Кандидаты в менеджеры тура (поиск по имени, агентству, Telegram, e-mail)
create or replace function public.voyage_owner_catalog_manager_candidates(p_query text default null, p_limit integer default 20)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if auth.uid() is null or not coalesce(public.is_owner(), false) then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.sys desc, x.name)
    from (
      select p.is_system as sys,
             public.voyage_ops_display_name(p.id) as name,
             jsonb_build_object(
               'id', p.id,
               'name', public.voyage_ops_display_name(p.id),
               'agency', nullif(p.agency_name, ''),
               'telegram', nullif(p.telegram_username, ''),
               'is_system', p.is_system
             ) as j
      from public.profiles p
      where public.voyage_catalog_manager_eligible(p.id)
        and (v_q is null
             or p.full_name ilike '%' || v_q || '%'
             or p.name ilike '%' || v_q || '%'
             or p.agency_name ilike '%' || v_q || '%'
             or p.telegram_username ilike '%' || v_q || '%'
             or p.email ilike '%' || v_q || '%')
      order by p.is_system desc, 2
      limit v_limit
    ) x
  ), '[]'::jsonb);
end $$;

-- Назначения: по туру (p_tour) или все (null). Включая отозванные — это история.
create or replace function public.voyage_owner_catalog_assignments(p_tour uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not coalesce(public.is_owner(), false) then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.voyage_catalog_assignment_json(m) order by m.is_active desc, m.assigned_at desc)
    from public.tour_catalog_managers m
    where p_tour is null or m.catalog_tour_id = p_tour
  ), '[]'::jsonb);
end $$;

create or replace function public.voyage_owner_assign_catalog_manager(p_tour uuid, p_manager uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_tour public.tour_catalog%rowtype;
  v_row public.tour_catalog_managers%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_owner(), false) then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  select * into v_tour from public.tour_catalog t where t.id = p_tour for update;
  if not found then
    raise exception 'voyage:catalog_tour_not_found' using errcode = 'P0002';
  end if;
  if p_manager is null or not public.voyage_catalog_manager_eligible(p_manager) then
    raise exception 'voyage:manager_not_eligible' using errcode = '22023';
  end if;
  if exists (select 1 from public.tour_catalog_managers m
             where m.catalog_tour_id = p_tour and m.manager_id = p_manager and m.is_active) then
    raise exception 'voyage:manager_already_assigned' using errcode = '23505';
  end if;

  insert into public.tour_catalog_managers (catalog_tour_id, manager_id, assigned_by, assign_note, source)
  values (p_tour, p_manager, auth.uid(), nullif(left(btrim(coalesce(p_note, '')), 500), ''), 'owner')
  returning * into v_row;

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, target_label, metadata)
  values ('tour_catalog.manager_assign', auth.uid(), auth.uid(), 'owner', p_manager, left(v_tour.slug, 120),
          jsonb_build_object('catalog_tour_id', p_tour, 'assignment_id', v_row.id,
                             'manager_name', v_row.manager_label,
                             'is_system', p_manager = public.voyage_management_id()));
  return public.voyage_catalog_assignment_json(v_row);
end $$;

-- Передать кастинг (ещё без поездки) другому ответственному.
-- p_to: VOYAGE Management или менеджер с активным назначением на тур кастинга.
create or replace function public.voyage_owner_transfer_casting(p_casting uuid, p_to uuid)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_casting public.partner_castings%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_owner(), false) then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  select * into v_casting from public.partner_castings c where c.id = p_casting for update;
  if not found then
    raise exception 'voyage:casting_not_found' using errcode = 'P0002';
  end if;
  if p_to is null or not public.voyage_catalog_manager_eligible(p_to) then
    raise exception 'voyage:manager_not_eligible' using errcode = '22023';
  end if;
  if p_to <> public.voyage_management_id() and not exists (
       select 1 from public.tour_catalog_managers m
       where m.catalog_tour_id = v_casting.catalog_tour_id and m.manager_id = p_to and m.is_active) then
    raise exception 'voyage:manager_not_assigned' using errcode = '22023';
  end if;
  if v_casting.manager_id = p_to then
    return jsonb_build_object('id', v_casting.id, 'manager_id', p_to, 'changed', false);
  end if;
  if exists (select 1 from public.partner_tours t where t.casting_id = v_casting.id) then
    raise exception 'voyage:casting_has_tour' using errcode = 'P0001';
  end if;

  update public.partner_castings set manager_id = p_to where id = v_casting.id;

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, target_label, metadata)
  values ('tour_catalog.casting_transfer', auth.uid(), auth.uid(), 'owner', p_to,
          left(coalesce((select t.slug from public.tour_catalog t where t.id = v_casting.catalog_tour_id), v_casting.city), 120),
          jsonb_build_object('catalog_tour_id', v_casting.catalog_tour_id, 'casting_id', v_casting.id,
                             'from_manager_id', v_casting.manager_id, 'to_manager_id', p_to));
  return jsonb_build_object('id', v_casting.id, 'manager_id', p_to, 'changed', true);
end $$;

-- Отозвать назначение. p_transfer_to (необязательно) — кому передать открытые
-- кастинги этого менеджера по туру, у которых ещё нет поездки.
create or replace function public.voyage_owner_revoke_catalog_manager(p_assignment uuid, p_reason text default null, p_transfer_to uuid default null)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  v_row public.tour_catalog_managers%rowtype;
  v_casting record;
  v_transferred uuid[] := '{}';
  v_kept uuid[] := '{}';
begin
  if auth.uid() is null or not coalesce(public.is_owner(), false) then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  select * into v_row from public.tour_catalog_managers m where m.id = p_assignment for update;
  if not found then
    raise exception 'voyage:assignment_not_found' using errcode = 'P0002';
  end if;
  if not v_row.is_active then
    raise exception 'voyage:assignment_not_active' using errcode = 'P0001';
  end if;
  if p_transfer_to is not null and p_transfer_to = v_row.manager_id then
    raise exception 'voyage:transfer_to_same_manager' using errcode = '22023';
  end if;

  update public.tour_catalog_managers
     set is_active = false,
         revoked_at = now(),
         revoked_by = auth.uid(),
         revoke_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
   where id = v_row.id
  returning * into v_row;

  if v_row.catalog_tour_id is not null and v_row.manager_id is not null then
    for v_casting in
      select c.id, exists (select 1 from public.partner_tours t where t.casting_id = c.id) as has_trip
      from public.partner_castings c
      where c.catalog_tour_id = v_row.catalog_tour_id
        and c.manager_id = v_row.manager_id
        and c.status in ('open', 'shortlist')
      order by c.starts_on
    loop
      if p_transfer_to is not null and not v_casting.has_trip then
        perform public.voyage_owner_transfer_casting(v_casting.id, p_transfer_to);
        v_transferred := v_transferred || v_casting.id;
      else
        v_kept := v_kept || v_casting.id;
      end if;
    end loop;
  end if;

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, target_label, metadata)
  values ('tour_catalog.manager_revoke', auth.uid(), auth.uid(), 'owner', v_row.manager_id, left(v_row.tour_label, 120),
          jsonb_build_object('catalog_tour_id', v_row.catalog_tour_id, 'assignment_id', v_row.id,
                             'manager_name', v_row.manager_label, 'reason', v_row.revoke_reason,
                             'transfer_to', p_transfer_to,
                             'transferred_castings', to_jsonb(v_transferred),
                             'kept_castings', to_jsonb(v_kept)));
  return jsonb_build_object(
    'assignment', public.voyage_catalog_assignment_json(v_row),
    'transferred', to_jsonb(v_transferred),
    'kept', to_jsonb(v_kept)
  );
end $$;

-- История тура для владельца: изменения условий, назначения, отзывы, передачи
create or replace function public.voyage_owner_catalog_tour_history(p_tour uuid, p_limit integer default 100)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if auth.uid() is null or not coalesce(public.is_owner(), false) then
    raise exception 'voyage:owner_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select a.created_at,
             jsonb_build_object(
               'id', a.id,
               'at', a.created_at,
               'action', a.action,
               'actor_id', a.actor_profile_id,
               'actor_name', case when a.actor_profile_id is not null then public.voyage_ops_display_name(a.actor_profile_id) end,
               'actor_role', a.actor_role,
               'metadata', a.metadata
             ) as j
      from public.audit_logs a
      where a.action like 'tour_catalog.%'
        and a.metadata ->> 'catalog_tour_id' = p_tour::text
      order by a.created_at desc
      limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) x
  ), '[]'::jsonb);
end $$;

/* ── 7. RPC менеджера ──────────────────────────────────────────────── */

-- «Мои направления»: туры с активным назначением, соведущие, кастинги по туру.
-- Без заметок владельца и без откликов; чужой кастинг — только даты и статус.
create or replace function public.voyage_my_catalog_tours()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or not public.voyage_catalog_manager_eligible(v_me) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.city, x.sort_order)
    from (
      select t.city, t.sort_order,
             (to_jsonb(t) - 'created_by')
             || jsonb_build_object(
                  'assigned_at', m.assigned_at,
                  'co_managers', coalesce((
                    select jsonb_agg(jsonb_build_object(
                             'name', public.voyage_ops_display_name(o.manager_id),
                             'is_system', coalesce(p.is_system, false),
                             'is_me', o.manager_id = v_me,
                             'assigned_at', o.assigned_at) order by o.assigned_at)
                    from public.tour_catalog_managers o
                    left join public.profiles p on p.id = o.manager_id
                    where o.catalog_tour_id = t.id and o.is_active and o.manager_id is not null
                  ), '[]'::jsonb),
                  'castings', coalesce((
                    select jsonb_agg(jsonb_build_object(
                             'id', c.id,
                             'starts_on', c.starts_on,
                             'ends_on', c.ends_on,
                             'status', c.status,
                             'slots', c.slots,
                             'closes_at', c.closes_at,
                             'is_mine', c.manager_id = v_me,
                             'organizer', public.voyage_ops_display_name(c.manager_id)) order by c.starts_on desc)
                    from public.partner_castings c
                    where c.catalog_tour_id = t.id
                  ), '[]'::jsonb)
                ) as j
      from public.tour_catalog_managers m
      join public.tour_catalog t on t.id = m.catalog_tour_id
      where m.manager_id = v_me and m.is_active
    ) x
  ), '[]'::jsonb);
end $$;

-- Туры, под которые текущий пользователь может создать кастинг (форма кастинга).
-- owner/admin — все активные туры на локациях; менеджер — только назначенные.
create or replace function public.voyage_catalog_tours_for_casting()
returns setof public.tour_catalog
language sql stable
set search_path to ''
as $$
  select t.*
  from public.tour_catalog t
  where t.is_active
    and t.map_hub_id is not null
    and (coalesce(public.is_admin(), false) or public.voyage_catalog_i_manage(t.id))
  order by t.city, t.sort_order
$$;

revoke all on function public.voyage_owner_catalog_manager_candidates(text, integer) from public, anon;
revoke all on function public.voyage_owner_catalog_assignments(uuid) from public, anon;
revoke all on function public.voyage_owner_assign_catalog_manager(uuid, uuid, text) from public, anon;
revoke all on function public.voyage_owner_transfer_casting(uuid, uuid) from public, anon;
revoke all on function public.voyage_owner_revoke_catalog_manager(uuid, text, uuid) from public, anon;
revoke all on function public.voyage_owner_catalog_tour_history(uuid, integer) from public, anon;
revoke all on function public.voyage_my_catalog_tours() from public, anon;
revoke all on function public.voyage_catalog_tours_for_casting() from public, anon;
grant execute on function public.voyage_owner_catalog_manager_candidates(text, integer) to authenticated, service_role;
grant execute on function public.voyage_owner_catalog_assignments(uuid) to authenticated, service_role;
grant execute on function public.voyage_owner_assign_catalog_manager(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.voyage_owner_transfer_casting(uuid, uuid) to authenticated, service_role;
grant execute on function public.voyage_owner_revoke_catalog_manager(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.voyage_owner_catalog_tour_history(uuid, integer) to authenticated, service_role;
grant execute on function public.voyage_my_catalog_tours() to authenticated, service_role;
grant execute on function public.voyage_catalog_tours_for_casting() to authenticated, service_role;

-- Триггерные функции клиентам не нужны
revoke all on function public.tour_catalog_managers_labels() from public, anon, authenticated;
revoke all on function public.tour_catalog_managers_guard() from public, anon, authenticated;
revoke all on function public.tour_catalog_owner_notes_touch() from public, anon, authenticated;
revoke all on function public.tour_catalog_owner_notes_audit() from public, anon, authenticated;
revoke all on function public.tour_catalog_manager_guard() from public, anon, authenticated;
revoke all on function public.tour_catalog_audit() from public, anon, authenticated;
revoke all on function public.partner_castings_catalog_assignment() from public, anon, authenticated;

commit;
