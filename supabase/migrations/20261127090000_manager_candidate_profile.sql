-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Анкета кандидатки для менеджера кастинга (27.11.2026)
-- supabase/migrations/20261127090000_manager_candidate_profile.sql
--
-- Решение Vlad 24.11.2026: Blind Selection пересмотрен. Менеджер,
-- ответственный за кастинг, видит анкету каждой откликнувшейся резидентки
-- ДО рукопожатия: имя, фото, возраст, параметры, языки, город, «о себе»,
-- KYC и Trusted. Контакты, документы и финансы закрыты всегда.
--
-- 1. public.voyage_casting_profile_access(casting) — кто вправе смотреть
--    анкеты откликов кастинга:
--      • owner / admin — как и раньше, по любому кастингу;
--      • manager — только автор (partner_castings.manager_id = он сам).
--        Передача кастинга другому менеджеру сразу закрывает доступ
--        прежнему (проверка «вживую», без кэша);
--      • если установлен пакет tour-catalog-managers и владелец ОТОЗВАЛ
--        назначение менеджера на тур каталога этого кастинга — доступ
--        к анкетам закрыт (статусы и действия отбора не трогаем).
-- 2. public.partner_manager_candidate_profile(casting, resident) — анкета
--    одной кандидатки. Только резидентка с откликом на этот кастинг
--    (ready / option / selected / declined; отозвавшая отклик — закрыта),
--    не из Blacklist. Белый список полей, profiles целиком не открывается.
--    Каждый просмотр пишется в audit_logs (читает только owner),
--    повтор того же просмотра в течение часа не дублируется.
-- 3. public.partner_manager_get_responses — те же строки и порядок, плюс
--    age, trusted, profile_available. Имя и фото маскируются, если доступа
--    к анкетам нет (назначение отозвано) или отклик отозван резиденткой.
--    EXECUTE больше не выдаётся anon.
--
-- НЕ меняется: статусы откликов, partner_set_option, partner_handshake,
-- partner_manager_decline_response, RLS таблиц profiles / partner_*,
-- баллы, финансы, права владельца.
--
-- Никогда не отдаются: email, телефон, telegram_id / username,
-- partner_contact, usdt_wallet, точная дата рождения (только возраст),
-- гражданство (паспортные данные), temp_password, документы и видео KYC,
-- Personal Vault, баны, UTM, scout_manager_id, invited_by.
--
-- Требует: 36 миграций Production (20261020090000…20261115092000).
-- Пакет tour-catalog-managers (20261125090000) НЕ обязателен.
-- Идемпотентна. Откат: supabase/rollback/20261127090000_manager_candidate_profile.rollback.sql
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regclass('public.partner_casting_responses') is null
     or to_regprocedure('public.partner_resident_trust(uuid)') is null then
    raise exception 'VOYAGE: нет таблиц/функций кастингов из дампа 20.10';
  end if;
  if to_regclass('public.audit_logs') is null then
    raise exception 'VOYAGE: сначала примените 20261102100000_resident_sizes_dossier_audit.sql';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'partner_castings' and column_name = 'min_kyc_level') then
    raise exception 'VOYAGE: сначала примените 20261114100000_casting_min_kyc_level.sql';
  end if;
end $$;

/* ── 1. Право смотреть анкеты откликов кастинга ─────────────────────── */

create or replace function public.voyage_casting_profile_access(p_casting uuid)
returns boolean
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_manager uuid;
  v_tour uuid;
  v_revoked boolean := false;
begin
  if me is null or p_casting is null then
    return false;
  end if;
  if coalesce(public.is_admin(), false) then
    return exists (select 1 from public.partner_castings c where c.id = p_casting);
  end if;
  if not coalesce(public.has_role('manager'::public.app_role), false) then
    return false;
  end if;

  select c.manager_id, c.catalog_tour_id into v_manager, v_tour
  from public.partner_castings c where c.id = p_casting;
  if not found or v_manager is distinct from me then
    return false;
  end if;

  -- Пакет tour-catalog-managers: явный отзыв назначения на тур закрывает анкеты.
  -- Менеджер, которого на тур ещё не распределяли, работает как раньше.
  if v_tour is not null and to_regclass('public.tour_catalog_managers') is not null then
    execute $q$
      select exists (select 1 from public.tour_catalog_managers m
                     where m.catalog_tour_id = $1 and m.manager_id = $2 and not m.is_active)
         and not exists (select 1 from public.tour_catalog_managers m
                         where m.catalog_tour_id = $1 and m.manager_id = $2 and m.is_active)
    $q$ into v_revoked using v_tour, me;
  end if;
  return not coalesce(v_revoked, false);
end $$;

comment on function public.voyage_casting_profile_access(uuid) is
  'true, если текущий пользователь вправе смотреть анкеты откликов кастинга: owner/admin — любой кастинг; manager — только свой (manager_id) и без отозванного назначения на тур каталога.';

revoke all on function public.voyage_casting_profile_access(uuid) from public, anon;
grant execute on function public.voyage_casting_profile_access(uuid) to authenticated, service_role;

/* ── 2. Анкета кандидатки ──────────────────────────────────────────── */

create or replace function public.partner_manager_candidate_profile(p_casting uuid, p_resident uuid)
returns jsonb
language plpgsql volatile security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  c public.partner_castings%rowtype;
  r public.partner_casting_responses%rowtype;
  p public.profiles%rowtype;
  s public.partner_resident_settings%rowtype;
  v_age integer;
  v_trust jsonb;
  v_snaps jsonb;
begin
  if me is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if p_casting is null or p_resident is null then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;
  if not coalesce(public.has_role('manager'::public.app_role, 'admin'::public.app_role, 'owner'::public.app_role), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  select * into c from public.partner_castings x where x.id = p_casting;
  if not found then
    raise exception 'voyage:casting_not_found' using errcode = 'P0002';
  end if;
  if not public.voyage_casting_profile_access(p_casting) then
    raise exception 'voyage:forbidden_casting_owner' using errcode = '42501';
  end if;

  -- Только кандидатка этого кастинга. Отозвавшая отклик и Blacklist — закрыты.
  select * into r from public.partner_casting_responses x
  where x.casting_id = p_casting and x.resident_id = p_resident;
  if not found then
    raise exception 'voyage:candidate_not_found' using errcode = 'P0002';
  end if;
  if r.status not in ('ready', 'option', 'selected', 'declined') then
    raise exception 'voyage:candidate_withdrawn' using errcode = '42501';
  end if;

  select * into p from public.profiles x where x.id = p_resident and x.role::text = 'resident';
  if not found or public.partner_is_blacklisted(p_resident) then
    raise exception 'voyage:candidate_not_found' using errcode = 'P0002';
  end if;
  select * into s from public.partner_resident_settings x where x.resident_id = p_resident;

  if p.birth_date is not null then
    v_age := extract(year from age(current_date, p.birth_date))::integer;
    if v_age < 16 or v_age > 99 then v_age := null; end if;
  end if;
  select to_jsonb(t) into v_trust from public.partner_resident_trust(p_resident) t;
  select coalesce(jsonb_agg(jsonb_build_object('path', z.storage_path, 'captured_at', z.captured_at)
                            order by z.captured_at desc), '[]'::jsonb)
    into v_snaps
  from (select ls.storage_path, ls.captured_at from public.partner_live_snaps ls
        where ls.resident_id = p_resident order by ls.captured_at desc limit 6) z;

  -- Журнал просмотров (owner читает audit_logs). Тот же просмотр в течение часа не дублируется.
  if not exists (
    select 1 from public.audit_logs a
    where a.action = 'casting.candidate_profile_view'
      and a.actor_profile_id = me
      and a.target_profile_id = p_resident
      and a.created_at > now() - interval '1 hour'
      and a.metadata ->> 'casting_id' = p_casting::text
  ) then
    insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_role, target_profile_id, target_label, metadata)
    values ('casting.candidate_profile_view', me, me, public.current_user_role()::text, p_resident,
            left(coalesce(c.city, ''), 120),
            jsonb_build_object('casting_id', p_casting, 'response_status', r.status));
  end if;

  return jsonb_build_object(
    'resident_id', p.id,
    'code', public.partner_blind_code(p.id),
    'name', coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''), 'Резидентка'),
    'response', jsonb_build_object(
      'status', r.status,
      'option_expires_at', r.option_expires_at,
      'created_at', r.created_at,
      'updated_at', r.updated_at
    ),
    'photos', to_jsonb(array(
      select u from unnest(coalesce(p.photo_urls, '{}'::text[]) || case when p.avatar_url is not null then array[p.avatar_url] else '{}'::text[] end) with ordinality as x(u, n)
      where nullif(btrim(u), '') is not null
      group by u order by min(n) limit 13
    )),
    'snaps', v_snaps,
    'age', v_age,
    'height', p.height,
    'weight', p.weight,
    'measurements', nullif(btrim(coalesce(p.measurements, '')), ''),
    'clothing_size', p.clothing_size,
    'shoe_size', p.shoe_size,
    'smoking', p.smoking,
    'alcohol', p.alcohol,
    'location', nullif(btrim(coalesce(p.location, '')), ''),
    'about', nullif(btrim(coalesce(p.about, '')), ''),
    'achievements', to_jsonb(coalesce(p.achievements, '{}'::text[])),
    'languages', to_jsonb(coalesce(s.languages, '{}'::text[])),
    'segment', p.segment,
    'circle', coalesce(p.circle, 'voyager'),
    'kyc_level', coalesce(p.kyc_level, 0),
    'min_kyc_level', c.min_kyc_level,
    'below_kyc', coalesce(p.kyc_level, 0) < coalesce(c.min_kyc_level, 3),
    'verified_at', s.verified_at,
    'open_to_tours', coalesce(s.open_to_tours, false),
    'influence_index', coalesce(p.influence_index, 0),
    'reliability', coalesce(p.reliability, 100.00),
    'trust', v_trust
  );
end $$;

comment on function public.partner_manager_candidate_profile(uuid, uuid) is
  'Анкета кандидатки для ответственного за кастинг (voyage_casting_profile_access). Белый список полей: без контактов, документов, финансов и точной даты рождения. Просмотр пишется в audit_logs.';

revoke all on function public.partner_manager_candidate_profile(uuid, uuid) from public, anon;
grant execute on function public.partner_manager_candidate_profile(uuid, uuid) to authenticated, service_role;

/* ── 3. Доска откликов: + возраст, Trusted, доступность анкеты ────────── */

drop function if exists public.partner_manager_get_responses(uuid);

create function public.partner_manager_get_responses(p_casting_id uuid)
returns table(
  response_id uuid, casting_id uuid, resident_id uuid, status text,
  option_expires_at timestamptz, response_created_at timestamptz, response_updated_at timestamptz,
  full_name text, avatar_url text, photo_urls text[], height numeric, languages text[],
  kyc_level integer, circle text, influence_index integer, reliability numeric,
  age integer, trusted boolean, profile_available boolean
)
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_manager uuid;
  v_access boolean;
begin
  if v_actor is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if not coalesce(public.has_role('manager'::public.app_role, 'admin'::public.app_role, 'owner'::public.app_role), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  select c.manager_id into v_manager from public.partner_castings c where c.id = p_casting_id;
  if not found then
    raise exception 'voyage:casting_not_found' using errcode = 'P0002';
  end if;
  -- Как раньше: менеджер — только свой кастинг, admin/owner — любой.
  if not coalesce(public.is_admin(), false) and v_manager is distinct from v_actor then
    raise exception 'voyage:forbidden_casting_owner' using errcode = '42501';
  end if;
  v_access := public.voyage_casting_profile_access(p_casting_id);

  return query
  select
    r.id, r.casting_id, r.resident_id, r.status, r.option_expires_at, r.created_at, r.updated_at,
    case when x.open then coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.name), ''), 'Резидентка')
         else 'Резидентка ' || public.partner_blind_code(p.id) end,
    case when x.open then p.avatar_url end,
    case when x.open then coalesce(p.photo_urls, array[]::text[]) else array[]::text[] end,
    p.height,
    coalesce(s.languages, array[]::text[]),
    coalesce(p.kyc_level, 0),
    coalesce(p.circle, 'voyager'),
    coalesce(p.influence_index, 0),
    coalesce(p.reliability, 100.00),
    case when p.birth_date is not null
          and extract(year from age(current_date, p.birth_date)) between 16 and 99
         then extract(year from age(current_date, p.birth_date))::integer end,
    coalesce((select t.trusted from public.partner_resident_trust(p.id) t), false),
    x.open
  from public.partner_casting_responses r
  join public.profiles p on p.id = r.resident_id
  left join public.partner_resident_settings s on s.resident_id = p.id
  cross join lateral (select (v_access and r.status <> 'withdrawn') as open) x
  where r.casting_id = p_casting_id
    and p.role::text = 'resident'
    and not public.partner_is_blacklisted(r.resident_id)
  order by
    case r.status when 'ready' then 0 when 'option' then 1 when 'selected' then 2 when 'declined' then 3 else 4 end,
    r.created_at asc;
end $$;

comment on function public.partner_manager_get_responses(uuid) is
  'Доска откликов кастинга: автор кастинга или admin/owner. Имя и фото — при voyage_casting_profile_access и неотозванном отклике; Blacklist исключён.';

revoke all on function public.partner_manager_get_responses(uuid) from public, anon;
grant execute on function public.partner_manager_get_responses(uuid) to authenticated, service_role;

commit;
