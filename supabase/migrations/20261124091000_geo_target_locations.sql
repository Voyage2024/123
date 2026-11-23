-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Целевая география по утверждённому списку (24.11.2026)
-- supabase/migrations/20261124091000_geo_target_locations.sql
--
-- Источник: список Влада от 23.11.2026 (voyage-geo/APPROVED_LOCATIONS_VLAD_2026-11-23.md)
-- и выгрузка Production G1/G2 от 24.11.2026 (54 локации).
--
-- 1. Новые локации MENA: ankara, istanbul (TR), uzbekistan (UZ, одна точка
--    на страну). Координаты — по реальной географии, пересчитаны в систему
--    X/Y карты MENA по 13 существующим точкам (невязка ~0,6 %).
--    Рассылка tour_published о новых локациях НЕ отправляется (решение R1):
--    на время вставки отключается триггер voyage_notify_tour_published.
-- 2. vietnam → Da Nang: id «vietnam» сохраняется (на него ссылаются заявки,
--    подписки, кастинги, URL); меняются название, страна VN и точка
--    (Хошимин → Дананг). Название и подзаголовок заменяются целиком на
--    4 языках (RU/EN/ES/PT): старые «Вьетнам» и «KTV и Отели Хошимина»
--    не остаются ни в одном языке. Города туров и открытых кастингов обновит триггер
--    map_hubs_sync_tour_catalog; закрытые поездки хранят свой город.
-- 3. Архив (is_active = false, без удаления): turkey (преемники ankara,
--    istanbul), lebanon, belgium, pattaya, phuket + любая активная локация,
--    которой нет в утверждённом списке. Подписки, заявки, туры, кастинги,
--    поездки и история остаются на старых id — ничего не переносится.
-- 4. Остальные 49 локаций не меняются: координаты проверены, подзаголовки
--    Europe/Americas/APAC на RU уже совпадают со списком.
-- 5. Проверка CHECK map_hubs_active_xy_check (из 20261124090000).
-- 6. Контроль: 52 активных; у ankara/istanbul/uzbekistan/vietnam
--    название и подзаголовок заполнены на всех 4 языках; в названии и
--    подзаголовке vietnam нет Хошимина/Сайгона (иначе откат). Если Хошимин
--    найден в описании/проживании/услугах vietnam — NOTICE со списком полей
--    (тексты описаний миграция не переписывает, их правят в админке).
--
-- Подзаголовки (утверждены Владом 23.11.2026, RU; EN/ES/PT — перевод):
--   ankara     Деловая столица Турции / Turkey's Business Capital /
--              La capital de negocios de Turquía / A capital de negócios da Turquia
--   istanbul   Босфорский премиум / Bosphorus Premium /
--              Prémium del Bósforo / Premium do Bósforo
--   uzbekistan Центральноазиатский хаб / Central Asian Hub /
--              Hub de Asia Central / Hub da Ásia Central
--   vietnam    Побережье Центрального Вьетнама / Central Vietnam Coast /
--   (Da Nang)  Costa del centro de Vietnam / Litoral do centro do Vietnã
--
-- Требует 20261124090000_geo_multi_tour_archive.sql. Идемпотентна.
-- Откат: см. README (включить архивные, выключить новые; название и
-- подзаголовок vietnam вернуть из резервной выгрузки G4, сделанной до установки). Удалять новые локации после появления подписок нельзя.
-- ════════════════════════════════════════════════════════════════════

begin;

/* ── 0. Предпроверки ───────────────────────────────────────────────── */

do $$
declare
  v_missing text;
begin
  if to_regprocedure('public.map_hubs_archive_stamp()') is null then
    raise exception 'Сначала примените 20261124090000_geo_multi_tour_archive.sql';
  end if;

  select string_agg(e.hub_id, ', ') into v_missing
    from unnest(array[
      'armenia','bahrain','cyprus_greek','cyprus_turkish','dubai','egypt','georgia','israel','jordan','qatar','saudi',
      'lebanon','turkey',
      'albania','bosnia','czechia','estonia','germany','greece','italy','latvia','lithuania','london','monaco',
      'montenegro','nice','norway','paris','serbia','spain','sweden','switzerland','belgium',
      'la_coast','los_angeles','philadelphia','portland','san_diego','san_francisco','seattle','toronto','vancouver','washington',
      'australia','bali','bangkok','cambodia','china','macau','malaysia','south_korea','vietnam','pattaya','phuket'
    ]) as e(hub_id)
   where not exists (select 1 from public.map_hubs h where h.id = e.hub_id);
  if v_missing is not null then
    raise exception 'VOYAGE: в map_hubs нет ожидаемых локаций: % (сверьте с выгрузкой G1)', v_missing;
  end if;

  -- Новые id не должны быть заняты чем-то другим
  if exists (select 1 from public.map_hubs h where h.id in ('ankara', 'istanbul', 'uzbekistan') and h.region <> 'mena') then
    raise exception 'VOYAGE: id ankara/istanbul/uzbekistan уже заняты локацией другого региона';
  end if;
end $$;

/* ── 1. Новые локации (без рассылки, решение R1) ───────────────────── */

alter table public.map_hubs disable trigger voyage_notify_tour_published;

insert into public.map_hubs (id, region, name, subtitle, description, accommodation, services, rates,
                             x, y, is_active, country_code, notify_responsibles)
values
  ('ankara', 'mena',
   '{"RU":"АНКАРА","EN":"ANKARA","ES":"ANKARA","PT":"ANCARA"}',
   '{"RU":"Деловая столица Турции","EN":"Turkey''s Business Capital","ES":"La capital de negocios de Turquía","PT":"A capital de negócios da Turquia"}',
   '{}', '{}', '{}', '{}',
   24.4, 7.5, true, 'TR', true),
  ('istanbul', 'mena',
   '{"RU":"СТАМБУЛ","EN":"ISTANBUL","ES":"ESTAMBUL","PT":"ISTAMBUL"}',
   '{"RU":"Босфорский премиум","EN":"Bosphorus Premium","ES":"Prémium del Bósforo","PT":"Premium do Bósforo"}',
   '{}', '{}', '{}', '{}',
   15.4, 4.0, true, 'TR', true),
  ('uzbekistan', 'mena',
   '{"RU":"УЗБЕКИСТАН","EN":"UZBEKISTAN","ES":"UZBEKISTÁN","PT":"UZBEQUISTÃO"}',
   '{"RU":"Центральноазиатский хаб","EN":"Central Asian Hub","ES":"Hub de Asia Central","PT":"Hub da Ásia Central"}',
   '{}', '{}', '{}', '{}',
   97.4, 2.8, true, 'UZ', true)
on conflict (id) do nothing;

-- Повторный запуск поверх ранней версии пакета (вставка с пустым подзаголовком):
-- дописываем только недостающие языки, правки из админки не затираются.
update public.map_hubs h
   set subtitle = v.sub || coalesce(h.subtitle, '{}'::jsonb)
  from (values
    ('ankara',     '{"RU":"Деловая столица Турции","EN":"Turkey''s Business Capital","ES":"La capital de negocios de Turquía","PT":"A capital de negócios da Turquia"}'::jsonb),
    ('istanbul',   '{"RU":"Босфорский премиум","EN":"Bosphorus Premium","ES":"Prémium del Bósforo","PT":"Premium do Bósforo"}'::jsonb),
    ('uzbekistan', '{"RU":"Центральноазиатский хаб","EN":"Central Asian Hub","ES":"Hub de Asia Central","PT":"Hub da Ásia Central"}'::jsonb)
  ) v(id, sub)
 where h.id = v.id
   and exists (select 1 from jsonb_object_keys(v.sub) k
                where coalesce(btrim(h.subtitle ->> k), '') = '');

/* ── 2. Vietnam → Da Nang (id сохраняется) ─────────────────────────── */

-- Название и подзаголовок меняются целиком, пока в них осталось старое
-- («Вьетнам»/«Vietnam», Хошимин/Сайгон) или не хватает языка. Повторный
-- запуск после правки в админке её не затирает.
update public.map_hubs
   set name = '{"RU":"ДАНАНГ","EN":"DA NANG","ES":"DA NANG","PT":"DA NANG"}'::jsonb
 where id = 'vietnam'
   and (coalesce(name, '{}'::jsonb)::text ~* '(вьетнам|Вьетнам|ВЬЕТНАМ|vietnam|vietnã|VIETNÃ|vietname)'
        or exists (select 1 from unnest(array['RU','EN','ES','PT']) l
                    where coalesce(btrim(name ->> l), '') = ''));

update public.map_hubs
   set subtitle = '{"RU":"Побережье Центрального Вьетнама","EN":"Central Vietnam Coast","ES":"Costa del centro de Vietnam","PT":"Litoral do centro do Vietnã"}'::jsonb
 where id = 'vietnam'
   and (coalesce(subtitle, '{}'::jsonb)::text ~* '(хошимин|Хошимин|ХОШИМИН|сайгон|Сайгон|САЙГОН|chi minh|saigon|sài gòn|hồ chí minh|Sài Gòn|Hồ Chí Minh)'
        or exists (select 1 from unnest(array['RU','EN','ES','PT']) l
                    where coalesce(btrim(subtitle ->> l), '') = ''));

update public.map_hubs
   set country_code = 'VN',
       x = 40.4,
       y = 36.6
 where id = 'vietnam'
   and (country_code is distinct from 'VN' or x is distinct from 40.4 or y is distinct from 36.6);

/* ── 3. Архив ──────────────────────────────────────────────────────── */

update public.map_hubs
   set is_active = false,
       successor_hub_ids = array['ankara', 'istanbul'],
       archive_note = 'Разделена на Ankara и Istanbul (23.11.2026). Подписки и заявки сохранены на этой записи до отдельного решения.'
 where id = 'turkey' and (is_active or successor_hub_ids <> array['ankara', 'istanbul']);

update public.map_hubs
   set is_active = false,
       archive_note = 'Нет в утверждённом списке локаций (23.11.2026). Связи сохранены.'
 where coalesce(is_active, true)
   and id not in (
     'armenia','bahrain','cyprus_greek','cyprus_turkish','dubai','egypt','georgia','israel','jordan','qatar','saudi',
     'ankara','istanbul','uzbekistan',
     'albania','bosnia','czechia','estonia','germany','greece','italy','latvia','lithuania','london','monaco',
     'montenegro','nice','norway','paris','serbia','spain','sweden','switzerland',
     'la_coast','los_angeles','philadelphia','portland','san_diego','san_francisco','seattle','toronto','vancouver','washington',
     'australia','bali','bangkok','cambodia','china','macau','malaysia','south_korea','vietnam'
   );

alter table public.map_hubs enable trigger voyage_notify_tour_published;

/* ── 4. Координаты активных ────────────────────────────────────────── */

alter table public.map_hubs validate constraint map_hubs_active_xy_check;

/* ── 5. Контроль ───────────────────────────────────────────────────── */

do $$
declare
  v_active int;
  v_by_region text;
begin
  select count(*) into v_active from public.map_hubs where coalesce(is_active, true);
  select string_agg(region || '=' || n, ', ' order by region) into v_by_region
    from (select region, count(*) n from public.map_hubs where coalesce(is_active, true) group by region) s;
  if v_active <> 52 then
    raise exception 'VOYAGE: активных локаций %, ожидалось 52 (%)', v_active, v_by_region;
  end if;
  raise notice 'VOYAGE: активных локаций 52 (%)', v_by_region;

  -- Название и подзаголовок на всех 4 языках
  select string_agg(h.id || '.' || f.col || '.' || l.lang, ', ') into v_by_region
    from public.map_hubs h
   cross join (values ('name'), ('subtitle')) f(col)
   cross join (values ('RU'), ('EN'), ('ES'), ('PT')) l(lang)
   where h.id in ('ankara', 'istanbul', 'uzbekistan', 'vietnam')
     and coalesce(btrim(case f.col when 'name' then h.name else h.subtitle end ->> l.lang), '') = '';
  if v_by_region is not null then
    raise exception 'VOYAGE: не заполнены переводы: %', v_by_region;
  end if;

  -- Хошимин: в названии/подзаголовке недопустим, в остальных текстах — предупреждение
  if exists (select 1 from public.map_hubs
              where id = 'vietnam'
                and (coalesce(name, '{}')::text || coalesce(subtitle, '{}')::text)
                    ~* '(хошимин|Хошимин|ХОШИМИН|сайгон|Сайгон|САЙГОН|chi minh|saigon|sài gòn|hồ chí minh|Sài Gòn|Hồ Chí Minh)') then
    raise exception 'VOYAGE: в названии или подзаголовке vietnam остался Хошимин';
  end if;
  select string_agg(e.col || '.' || e.lang, ', ') into v_by_region
    from public.map_hubs h
   cross join lateral (
     select 'description' col, j.key lang, j.value from jsonb_each_text(case when jsonb_typeof(h.description) = 'object' then h.description else '{}' end) j
     union all
     select 'accommodation', j.key, j.value from jsonb_each_text(case when jsonb_typeof(h.accommodation) = 'object' then h.accommodation else '{}' end) j
     union all
     select 'services', j.key, j.value from jsonb_each_text(case when jsonb_typeof(h.services) = 'object' then h.services else '{}' end) j
     union all
     select 'rates', j.key, j.value from jsonb_each_text(case when jsonb_typeof(h.rates) = 'object' then h.rates else '{}' end) j
   ) e
   where h.id = 'vietnam'
     and e.value ~* '(хошимин|Хошимин|ХОШИМИН|сайгон|Сайгон|САЙГОН|chi minh|saigon|sài gòn|hồ chí minh|Sài Gòn|Hồ Chí Minh)';
  if v_by_region is not null then
    raise notice 'VOYAGE: ВНИМАНИЕ — Хошимин упоминается в текстах Da Nang (vietnam): %. Исправьте в /admin/map-locations.', v_by_region;
  else
    raise notice 'VOYAGE: упоминаний Хошимина у Da Nang нет';
  end if;
end $$;

commit;
