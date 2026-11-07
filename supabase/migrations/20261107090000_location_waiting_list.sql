-- ════════════════════════════════════════════════════════════════════
-- supabase/migrations/20261107090000_location_waiting_list.sql
--
-- Лист ожидания локации (owner / admin).
--
-- Источник данных — уже существующие отклики по локации:
--   public.applications (hub_id, status pending/approved).
-- Кнопка «Подтвердить готовность к локации» на /destinations/* пишет
-- именно сюда (server action submitMapHubApplication), поэтому продолжают
-- работать: уведомление ответственным за локацию, отказ с паузой в месяц,
-- одобрение / завершение тура с баллами в /admin/applications и
-- /admin/map-locations. Отдельной копии данных нет.
--
-- 1. view public.location_waiting_list — активные отклики (pending +
--    approved) с городом и страной; security_invoker, то есть права
--    те же, что у applications (admin видит всё, менеджер — свои локации,
--    резидентка — свои строки).
-- 2. voyage_location_waiting_list(filters, limit, offset) — таблица для
--    админки с фильтрами: локация, страна, регион, статус, параметры,
--    KYC, возраст, дата подачи, подписка на обновления.
-- 3. voyage_location_open_castings(hub) — открытые кастинги этой локации
--    для кнопки «Пригласить в тур / кастинг» (приглашение — существующая
--    RPC voyage_invite_residents).
--
-- Требует 20261106090000_map_hub_subscriptions.sql. Идемпотентна.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regclass('public.map_hub_subscriptions') is null then
    raise exception 'Сначала примените 20261106090000_map_hub_subscriptions.sql';
  end if;
end $$;

create index if not exists applications_hub_waiting_idx
  on public.applications (hub_id, created_at desc)
  where status in ('pending', 'approved');

/* ── 1. View ───────────────────────────────────────────────────────── */

create or replace view public.location_waiting_list
with (security_invoker = true) as
select a.id          as application_id,
       a.user_id     as profile_id,
       a.hub_id,
       h.region,
       h.country_code,
       h.name        as hub_name,
       a.status,
       a.created_at  as applied_at
  from public.applications a
  join public.map_hubs h on h.id = a.hub_id
 where a.status in ('pending', 'approved');

comment on view public.location_waiting_list is
  'Лист ожидания локации: активные отклики (applications pending/approved) — кнопка «Подтвердить готовность к локации». Права как у applications.';

revoke all on public.location_waiting_list from public, anon;
grant select on public.location_waiting_list to authenticated, service_role;

/* ── 2. Таблица для админки ────────────────────────────────────────── */

create or replace function public.voyage_location_waiting_list(
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_q text := nullif(btrim(f ->> 'q'), '');
  v_hub text := nullif(f ->> 'hub', '');
  v_country text := upper(nullif(f ->> 'country', ''));
  v_region text := nullif(f ->> 'region', '');
  v_status text := nullif(f ->> 'status', '');
  v_segment text := nullif(f ->> 'segment', '');
  v_kyc integer := coalesce(nullif(f ->> 'kyc_min', '')::integer, 0);
  v_hmin numeric := nullif(f ->> 'height_min', '')::numeric;
  v_hmax numeric := nullif(f ->> 'height_max', '')::numeric;
  v_amin integer := nullif(f ->> 'age_min', '')::integer;
  v_amax integer := nullif(f ->> 'age_max', '')::integer;
  v_sizes text[] := array(select jsonb_array_elements_text(case when jsonb_typeof(f -> 'clothing_sizes') = 'array' then f -> 'clothing_sizes' else '[]'::jsonb end));
  v_from date := nullif(f ->> 'from', '')::date;
  v_to date := nullif(f ->> 'to', '')::date;
  v_subscribed boolean := nullif(f ->> 'subscribed', '')::boolean;
  v_sort text := coalesce(nullif(f ->> 'sort', ''), 'newest');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 300);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
  v_total integer;
  v_hubs jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if v_status is not null and v_status not in ('pending', 'approved') then
    v_status := null;
  end if;

  with base as (
    select w.application_id, w.hub_id, w.hub_name, w.region, w.country_code, w.status, w.applied_at,
           p.id as profile_id, p.full_name, p.name, p.email, p.telegram_username, p.avatar_url, p.photo_urls,
           p.segment, p.level, coalesce(p.kyc_level, 0) as kyc_level, p.height, p.clothing_size, p.shoe_size,
           p.citizenship, p.location, p.reliability, p.last_seen_at,
           case when p.birth_date is null then null
                else extract(year from age(current_date, p.birth_date))::integer end as age,
           coalesce(s.open_to_tours, false) as open_to_tours,
           coalesce(s.languages, '{}'::text[]) as languages,
           public.voyage_invite_target_ok(p.id) as eligible,
           exists (select 1 from public.map_hub_subscriptions ms
                    where ms.profile_id = p.id and ms.hub_id = w.hub_id) as subscribed,
           (select count(*) from public.partner_tour_members m
             where m.resident_id = p.id and m.status = 'flown')::integer as tours_done,
           (select jsonb_build_object('status', i.status, 'at', i.created_at, 'casting_id', i.casting_id)
              from public.partner_casting_invites i
              join public.partner_castings c on c.id = i.casting_id
             where i.resident_id = p.id and c.map_hub_id = w.hub_id
             order by i.created_at desc
             limit 1) as last_invite
      from public.location_waiting_list w
      join public.profiles p on p.id = w.profile_id
      left join public.partner_resident_settings s on s.resident_id = p.id
     where p.role::text = 'resident'
       and not coalesce(p.is_npc, false)
  ),
  filtered as (
    select b.* from base b
     where (v_q is null
            or coalesce(b.full_name, '') ilike '%' || v_q || '%'
            or coalesce(b.name, '') ilike '%' || v_q || '%'
            or coalesce(b.email, '') ilike '%' || v_q || '%'
            or coalesce(b.telegram_username, '') ilike '%' || ltrim(v_q, '@') || '%')
       and (v_hub is null or b.hub_id = v_hub)
       and (v_country is null or b.country_code = v_country)
       and (v_region is null or b.region = v_region)
       and (v_status is null or b.status = v_status)
       and (v_segment is null or b.segment = v_segment)
       and b.kyc_level >= v_kyc
       and (v_hmin is null or b.height >= v_hmin)
       and (v_hmax is null or b.height <= v_hmax)
       and (v_amin is null or b.age >= v_amin)
       and (v_amax is null or b.age <= v_amax)
       and (cardinality(v_sizes) = 0 or b.clothing_size = any (v_sizes))
       and (v_from is null or b.applied_at >= v_from::timestamptz)
       and (v_to is null or b.applied_at < (v_to + 1)::timestamptz)
       and (v_subscribed is null or b.subscribed = v_subscribed)
  ),
  paged as (
    select x.*, count(*) over () as total
      from filtered x
     order by case when v_sort = 'oldest' then x.applied_at end asc,
              case when v_sort = 'kyc' then x.kyc_level end desc,
              x.applied_at desc
     limit v_limit offset v_offset
  )
  select coalesce(max(pg.total), 0)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'application_id', pg.application_id,
           'hub_id', pg.hub_id,
           'hub_name', pg.hub_name,
           'region', pg.region,
           'country_code', pg.country_code,
           'status', pg.status,
           'applied_at', pg.applied_at,
           'id', pg.profile_id,
           'name', coalesce(nullif(btrim(pg.full_name), ''), pg.name),
           'telegram', pg.telegram_username,
           'photo', coalesce((select u from unnest(pg.photo_urls) u where u is not null and u <> '' limit 1), pg.avatar_url),
           'segment', pg.segment,
           'level', pg.level,
           'kyc_level', pg.kyc_level,
           'height', pg.height,
           'clothing_size', pg.clothing_size,
           'shoe_size', pg.shoe_size,
           'age', pg.age,
           'languages', to_jsonb(pg.languages),
           'citizenship', pg.citizenship,
           'location', pg.location,
           'reliability', pg.reliability,
           'open_to_tours', pg.open_to_tours,
           'eligible', pg.eligible,
           'subscribed', pg.subscribed,
           'tours_done', pg.tours_done,
           'last_invite', pg.last_invite,
           'last_seen_at', pg.last_seen_at
         ) order by
             case when v_sort = 'oldest' then pg.applied_at end asc,
             case when v_sort = 'kyc' then pg.kyc_level end desc,
             pg.applied_at desc), '[]'::jsonb)
    into v_total, v_rows
    from paged pg;

  -- Локации с активным листом ожидания (для фильтра и счётчиков)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.hub_id, 'name', h.hub_name, 'region', h.region,
           'country_code', h.country_code, 'waiting', h.waiting
         ) order by h.waiting desc, h.hub_id), '[]'::jsonb)
    into v_hubs
    from (
      select w.hub_id, max(w.hub_name::text)::jsonb as hub_name, max(w.region) as region,
             max(w.country_code) as country_code, count(*)::integer as waiting
        from public.location_waiting_list w
        join public.profiles p on p.id = w.profile_id
       where p.role::text = 'resident' and not coalesce(p.is_npc, false)
       group by w.hub_id
    ) h;

  return jsonb_build_object('generated_at', now(), 'total', v_total, 'rows', v_rows, 'hubs', v_hubs);
end;
$$;

revoke all on function public.voyage_location_waiting_list(jsonb, integer, integer) from public, anon;
grant execute on function public.voyage_location_waiting_list(jsonb, integer, integer) to authenticated;

/* ── 3. Открытые кастинги локации для приглашения ──────────────────── */

create or replace function public.voyage_location_open_castings(p_hub text)
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
             'id', c.id,
             'city', c.city,
             'project_type', c.project_type,
             'starts_on', c.starts_on,
             'ends_on', c.ends_on,
             'closes_at', c.closes_at,
             'status', c.status,
             'title_i18n', case when public.voyage_i18n_has_text(c.title_i18n) then c.title_i18n
                                else coalesce(t.title_i18n, '{}'::jsonb) end
           ) order by c.starts_on nulls last, c.closes_at)
      from public.partner_castings c
      left join public.tour_catalog t on t.id = c.catalog_tour_id
     where c.map_hub_id = p_hub
       and c.status in ('open', 'shortlist')
       and c.closes_at > now()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.voyage_location_open_castings(text) from public, anon;
grant execute on function public.voyage_location_open_castings(text) to authenticated;

commit;
