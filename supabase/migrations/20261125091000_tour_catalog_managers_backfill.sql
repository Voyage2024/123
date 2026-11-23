-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Backfill назначений менеджеров по существующим кастингам
-- supabase/migrations/20261125091000_tour_catalog_managers_backfill.sql
--
-- Решение Vlad 23.11.2026: назначать автоматически только там, где связь
-- однозначна; при сомнениях — никого, тур остаётся на ручное распределение.
--
-- Для каждого тура каталога смотрим авторов его кастингов
-- (partner_castings.manager_id):
--   AUTO    — все авторы — действующие менеджеры (role manager, approved,
--             без бана; VOYAGE Management тоже) и у поездок из этих кастингов
--             тот же менеджер → назначаются ВСЕ авторы (source = 'backfill').
--   MANUAL  — никого не назначаем, если:
--             no_castings          у тура нет кастингов;
--             author_not_manager   автор кастинга — owner/admin/другая роль;
--             author_inactive      автор — менеджер, но заблокирован / не одобрен;
--             trip_manager_differs у поездки из кастинга другой менеджер;
--             already_assigned     у тура уже есть назначения (владелец успел
--                                  распределить вручную — не вмешиваемся).
--
-- Не меняет: авторов кастингов, сами кастинги, поездки, UUID, связи.
-- Пишет только в tour_catalog_managers и audit_logs
-- (action 'tour_catalog.manager_backfill', по строке на тур — это отчёт).
-- Повторный запуск ничего не дублирует (туры с назначениями пропускаются).
--
-- Требует: 20261125090000_tour_catalog_managers.sql
-- Посмотреть результат заранее (только чтение): voyage-checks/
-- TOUR_MANAGERS_DIAGNOSTICS.sql, блок M1.
-- ════════════════════════════════════════════════════════════════════

begin;

do $$ begin
  if to_regclass('public.tour_catalog_managers') is null then
    raise exception 'VOYAGE: сначала примените 20261125090000_tour_catalog_managers.sql';
  end if;
end $$;

create temporary table voyage_backfill_plan on commit drop as
with authors as (
  select c.catalog_tour_id as tour_id,
         c.manager_id,
         count(*) as castings,
         bool_or(exists (select 1 from public.partner_tours pt
                         where pt.casting_id = c.id and pt.manager_id is distinct from c.manager_id)) as trip_differs
  from public.partner_castings c
  where c.catalog_tour_id is not null
  group by 1, 2
),
classified as (
  select a.*,
         p.role::text as role,
         public.voyage_catalog_manager_eligible(a.manager_id) as eligible
  from authors a
  left join public.profiles p on p.id = a.manager_id
)
select t.id as tour_id,
       t.slug,
       coalesce(sum(c.castings), 0)::int as castings,
       coalesce(jsonb_agg(jsonb_build_object(
                  'manager_id', c.manager_id,
                  'name', public.voyage_ops_display_name(c.manager_id),
                  'role', c.role,
                  'eligible', c.eligible,
                  'castings', c.castings,
                  'trip_differs', c.trip_differs)) filter (where c.manager_id is not null), '[]'::jsonb) as authors,
       array_remove(array[
         case when count(c.manager_id) = 0 then 'no_castings' end,
         case when bool_or(c.manager_id is not null and c.role is distinct from 'manager') then 'author_not_manager' end,
         case when bool_or(c.role = 'manager' and not c.eligible) then 'author_inactive' end,
         case when bool_or(c.trip_differs) then 'trip_manager_differs' end,
         case when exists (select 1 from public.tour_catalog_managers m where m.catalog_tour_id = t.id) then 'already_assigned' end
       ], null) as reasons
from public.tour_catalog t
left join classified c on c.tour_id = t.id
group by t.id, t.slug;

-- Назначения: только туры без причин для ручного разбора
insert into public.tour_catalog_managers (catalog_tour_id, manager_id, assigned_by, assign_note, source)
select p.tour_id, (a ->> 'manager_id')::uuid, null,
       'Автоматически по кастингам, созданным до 25.11.2026', 'backfill'
from voyage_backfill_plan p
cross join lateral jsonb_array_elements(p.authors) a
where cardinality(p.reasons) = 0
on conflict do nothing;

-- Отчёт: строка на тур
insert into public.audit_logs (action, actor_role, target_label, metadata)
select 'tour_catalog.manager_backfill', 'system', left(p.slug, 120),
       jsonb_build_object(
         'catalog_tour_id', p.tour_id,
         'result', case when cardinality(p.reasons) = 0 then 'auto' else 'manual' end,
         'reasons', to_jsonb(p.reasons),
         'castings', p.castings,
         'authors', p.authors)
from voyage_backfill_plan p
-- повторный запуск не плодит строки: тур попадает в отчёт один раз
where not exists (select 1 from public.audit_logs l
                  where l.action = 'tour_catalog.manager_backfill'
                    and l.metadata ->> 'catalog_tour_id' = p.tour_id::text);

do $$
declare
  v_tours int; v_auto int; v_assigned int; v_manual text;
begin
  select count(*), count(*) filter (where cardinality(reasons) = 0) into v_tours, v_auto from voyage_backfill_plan;
  select coalesce(sum(jsonb_array_length(authors)), 0) into v_assigned from voyage_backfill_plan where cardinality(reasons) = 0;
  select string_agg(slug || ' (' || array_to_string(reasons, ', ') || ')', '; ' order by slug) into v_manual
    from voyage_backfill_plan where cardinality(reasons) > 0;
  raise notice 'VOYAGE backfill: туров %, назначено автоматически % туров / % назначений; вручную: %',
    v_tours, v_auto, v_assigned, coalesce(v_manual, '—');
end $$;

commit;
