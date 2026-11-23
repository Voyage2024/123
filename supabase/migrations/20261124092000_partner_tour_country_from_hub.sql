-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Страна поездки из локации кастинга (24.11.2026) — РЕШЕНИЕ R2
-- supabase/migrations/20261124092000_partner_tour_country_from_hub.sql
--
-- R2 согласовано Владом 23.11.2026. Меняет источник страны для штампа
-- Passport у НОВЫХ поездок. Права не меняются: создать поездку может
-- менеджер своего кастинга или admin/owner (как в 20261022090000),
-- закрыть — менеджер своей поездки или admin/owner, и при закрытии
-- менеджер может указать другую страну (p_country_code заменяет страну).
--
-- Было: partner_create_tour копирует город кастинга, страну не ставит.
--   При закрытии страна = введённый менеджером ISO, иначе game_destinations
--   по названию города. После переименования Vietnam → Da Nang и для новых
--   городов (Ankara, Istanbul) поиск по названию страну не находит.
-- Стало: страна новой поездки = map_hubs.country_code локации кастинга.
--   partner_close_tour(p_country_code) по-прежнему может её заменить.
-- Не меняется: прошлые поездки, начисления, штампы, комбо, формула баллов.
--
-- Порядок: после 20261124091000 (у vietnam/ankara/istanbul/uzbekistan уже есть
-- страна) и до или после 093000 — без разницы: страна читается в момент
-- создания поездки. Тело функции = версия 20261022090000 + 1 select и
-- 1 колонка в insert; сигнатура, гранты и проверки прав те же.
-- Требует 20261106090000 (partner_castings.map_hub_id). Идемпотентна.
-- Откат: применить тело partner_create_tour из 20261022090000.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'partner_castings' and column_name = 'map_hub_id') then
    raise exception 'Сначала примените 20261106090000_map_hub_subscriptions.sql';
  end if;
end $$;

create or replace function public.partner_create_tour(
  p_casting uuid,
  p_departs_at timestamptz,
  p_returns_at timestamptz default null,
  p_flight_no text default null,
  p_iata text default null
)
returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  c public.partner_castings%rowtype;
  v_iata text := nullif(upper(btrim(coalesce(p_iata, ''))), '');
  v_flight text := nullif(upper(btrim(coalesce(p_flight_no, ''))), '');
  v_id uuid;
  v_country text;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  select * into c from public.partner_castings where id = p_casting for update;
  if not found then
    raise exception 'voyage:casting_not_found' using errcode = 'P0002';
  end if;
  if not (c.manager_id = me or coalesce(public.is_admin(), false)) then
    raise exception 'voyage:forbidden_casting_owner' using errcode = '42501';
  end if;
  if c.status = 'cancelled' then
    raise exception 'voyage:casting_cancelled' using errcode = 'P0001';
  end if;
  if p_departs_at is null or (p_returns_at is not null and p_returns_at < p_departs_at) then
    raise exception 'voyage:invalid_dates' using errcode = '22023';
  end if;
  if v_iata is not null and v_iata !~ '^[A-Z]{3}$' then
    raise exception 'voyage:invalid_iata' using errcode = '22023';
  end if;
  if v_flight is not null and length(v_flight) > 12 then
    raise exception 'voyage:invalid_flight' using errcode = '22023';
  end if;

  -- 24.11.2026: страна поездки = страна локации кастинга (map_hubs.country_code),
  -- чтобы штамп Passport не зависел от названия города. При закрытии тура
  -- менеджер по-прежнему может указать другую страну (partner_close_tour).
  select h.country_code into v_country
    from public.map_hubs h
   where h.id = c.map_hub_id and h.country_code ~ '^[A-Z]{2}$';

  insert into public.partner_tours (casting_id, manager_id, city, iata, project_type, flight_no, departs_at, returns_at, status, country_code)
  values (c.id, c.manager_id, c.city, v_iata, c.project_type, v_flight, p_departs_at, p_returns_at, 'confirmed', v_country)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.partner_create_tour(uuid, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.partner_create_tour(uuid, timestamptz, timestamptz, text, text) to authenticated;

commit;
