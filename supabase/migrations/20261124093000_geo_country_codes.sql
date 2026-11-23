-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Страна у локаций без country_code (24.11.2026) — РЕШЕНИЕ R4
-- supabase/migrations/20261124093000_geo_country_codes.sql
--
-- R4 согласовано Владом 23.11.2026. На Production у 42 из 54 локаций
-- нет страны (G1), поэтому на них нельзя создать тур каталога
-- (voyage:map_hub_country_required). Страна взята из утверждённого
-- списка 23.11.2026 (страна или город → страна), а не угадана по
-- названию: каждая строка ниже — явная пара id → ISO 3166-1 alpha-2.
--
-- Меняется только пустая страна (country_code IS NULL). Уже заполненные
-- не трогаются. Побочные эффекты: туров на этих локациях нет (G1), триггер
-- map_hubs_sync_tour_catalog ничего не обновит; уведомлений нет;
-- начисления и штампы прошлых поездок не меняются.
--
-- Список = все 41 локация с пустой страной из G1, кроме vietnam: VN ставит
-- основная миграция 20261124091000 (переименование в Da Nang).
--
-- cyprus_turkish → CY: у северной части Кипра нет своего кода ISO (подтверждено вместе с R4).
--
-- Требует 20261106090000 (map_hubs.country_code). Идемпотентна.
-- Откат: тем же списком set country_code = null (только где нет туров).
-- ════════════════════════════════════════════════════════════════════

begin;

-- Снимок уже заполненных стран: после обновления они обязаны совпасть
create temp table _voyage_cc_before on commit drop as
  select id, country_code from public.map_hubs where country_code is not null;

with cc(hub_id, code) as (values
  -- MENA
  ('armenia','AM'), ('cyprus_greek','CY'), ('cyprus_turkish','CY'), ('egypt','EG'), ('georgia','GE'),
  ('israel','IL'), ('jordan','JO'), ('qatar','QA'), ('saudi','SA'),
  ('lebanon','LB'), ('turkey','TR'),
  -- Europe
  ('albania','AL'), ('bosnia','BA'), ('czechia','CZ'), ('estonia','EE'), ('germany','DE'), ('greece','GR'),
  ('italy','IT'), ('latvia','LV'), ('lithuania','LT'), ('montenegro','ME'), ('norway','NO'), ('serbia','RS'),
  ('spain','ES'), ('sweden','SE'), ('switzerland','CH'), ('belgium','BE'),
  -- Americas
  ('la_coast','US'), ('philadelphia','US'), ('portland','US'), ('san_diego','US'), ('san_francisco','US'),
  ('seattle','US'), ('vancouver','CA'), ('washington','US'),
  -- APAC
  ('australia','AU'), ('cambodia','KH'), ('china','CN'), ('malaysia','MY'), ('south_korea','KR'), ('pattaya','TH')
)
update public.map_hubs h
   set country_code = cc.code
  from cc
 where h.id = cc.hub_id
   and h.country_code is null;

do $$
declare v_left text; v_changed text;
begin
  select string_agg(b.id, ', ') into v_changed
    from _voyage_cc_before b
    join public.map_hubs h on h.id = b.id
   where h.country_code is distinct from b.country_code;
  if v_changed is not null then
    raise exception 'VOYAGE: изменилась уже заполненная страна: %', v_changed;
  end if;

  select string_agg(id, ', ') into v_left from public.map_hubs where country_code is null and coalesce(is_active, true);
  if v_left is not null then
    raise notice 'VOYAGE: активные локации без страны: %', v_left;
  else
    raise notice 'VOYAGE: у всех активных локаций есть страна';
  end if;
end $$;

commit;
