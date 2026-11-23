-- =====================================================================================================
-- VOYAGE · Менеджеры туров каталога: read-only проверки Production (25.11.2026)
-- Запуск: Supabase SQL Editor, каждый блок (между ">>> BLOCK" и "<<< END") отдельно, Export → CSV
-- с именем блока (M1.csv …). Ничего не пишет: блок открывает READ ONLY и останавливается с ошибкой
-- "VOYAGE GUARD", если защита не включилась.
--   M1 — ДО установки: прогноз backfill (какие туры назначатся автоматически, какие — вручную).
--        Работает и без новых миграций.
--   M2 — ПОСЛЕ установки: объекты, политики, гранты, триггеры на месте.
--   M3 — ПОСЛЕ установки: итог backfill (из audit_logs) и активные назначения.
--   M4 — ПОСЛЕ установки: утечки — кто может читать заметки и назначения, TRUNCATE, EXECUTE у anon.
-- В M1/M3 есть имена менеджеров (агентство / имя) — это ваши же данные, не пересылайте CSV третьим лицам.
-- =====================================================================================================

-- >>> BLOCK M1
-- M1 · Прогноз backfill: те же правила, что в 20261125091000_tour_catalog_managers_backfill.sql.
set transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
set local search_path = pg_catalog, pg_temp;
with guard as (
  select case when current_setting('transaction_read_only') <> 'on'
                then (current_setting('transaction_read_only') || ' :: VOYAGE GUARD: транзакция не READ ONLY')::boolean
              when replace(current_setting('search_path'), ' ', '') <> 'pg_catalog,pg_temp'
                then ('search_path=' || current_setting('search_path') || ' :: VOYAGE GUARD')::boolean
              else true end as ok
),
authors as (
  select c.catalog_tour_id as tour_id, c.manager_id, count(*) as castings,
         bool_or(exists (select 1 from public.partner_tours pt
                         where pt.casting_id = c.id and pt.manager_id is distinct from c.manager_id)) as trip_differs
    from public.partner_castings c
   where c.catalog_tour_id is not null
   group by 1, 2
),
classified as (
  select a.*, p.role::text as role,
         coalesce(nullif(p.agency_name, ''), nullif(p.full_name, ''), nullif(p.name, ''), a.manager_id::text) as label,
         (p.role::text = 'manager'
          and (p.is_system or coalesce(p.status, '') = 'approved')
          and not coalesce(p.is_npc, false)
          and not coalesce(p.ban_permanent, false)
          and (p.banned_until is null or p.banned_until <= now())) as eligible
    from authors a
    left join public.profiles p on p.id = a.manager_id
),
plan as (
  select t.slug, t.is_active, count(c.manager_id) as authors_count, coalesce(sum(c.castings), 0) as castings,
         string_agg(c.label || ' [' || coalesce(c.role, '?') || case when c.eligible then '' else ', неактивен' end
                    || case when c.trip_differs then ', поездка у другого' else '' end
                    || ', кастингов ' || c.castings || ']', '; ' order by c.label) as authors,
         array_remove(array[
           case when count(c.manager_id) = 0 then 'no_castings' end,
           case when bool_or(c.manager_id is not null and c.role is distinct from 'manager') then 'author_not_manager' end,
           case when bool_or(c.role = 'manager' and not c.eligible) then 'author_inactive' end,
           case when bool_or(c.trip_differs) then 'trip_manager_differs' end
         ], null) as reasons
    from public.tour_catalog t
    left join classified c on c.tour_id = t.id
   group by t.id, t.slug, t.is_active
)
select 'M1' as block, p.slug, p.is_active as tour_active,
       case when cardinality(p.reasons) = 0 then 'AUTO' else 'MANUAL' end as result,
       case when cardinality(p.reasons) = 0 then p.authors_count else 0 end as will_assign,
       array_to_string(p.reasons, ', ') as reasons,
       p.castings, p.authors
  from plan p, guard g
 where g.ok
 order by result desc, p.slug;
-- <<< END M1

-- >>> BLOCK M2
-- M2 · Объекты новой миграции на месте (ожидается: все строки status = OK).
set transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
set local search_path = pg_catalog, pg_temp;
with guard as (
  select case when current_setting('transaction_read_only') <> 'on'
                then (current_setting('transaction_read_only') || ' :: VOYAGE GUARD: транзакция не READ ONLY')::boolean
              when replace(current_setting('search_path'), ' ', '') <> 'pg_catalog,pg_temp'
                then ('search_path=' || current_setting('search_path') || ' :: VOYAGE GUARD')::boolean
              else true end as ok
),
checks(kind, name, present) as (
  values
  ('table',    'tour_catalog_managers',             to_regclass('public.tour_catalog_managers') is not null),
  ('table',    'tour_catalog_owner_notes',          to_regclass('public.tour_catalog_owner_notes') is not null),
  ('index',    'tour_catalog_managers_active_key',  to_regclass('public.tour_catalog_managers_active_key') is not null),
  ('function', 'voyage_catalog_i_manage(uuid)',     to_regprocedure('public.voyage_catalog_i_manage(uuid)') is not null),
  ('function', 'voyage_owner_assign_catalog_manager', to_regprocedure('public.voyage_owner_assign_catalog_manager(uuid,uuid,text)') is not null),
  ('function', 'voyage_owner_revoke_catalog_manager', to_regprocedure('public.voyage_owner_revoke_catalog_manager(uuid,text,uuid)') is not null),
  ('function', 'voyage_owner_transfer_casting',     to_regprocedure('public.voyage_owner_transfer_casting(uuid,uuid)') is not null),
  ('function', 'voyage_owner_catalog_tour_history', to_regprocedure('public.voyage_owner_catalog_tour_history(uuid,integer)') is not null),
  ('function', 'voyage_my_catalog_tours()',         to_regprocedure('public.voyage_my_catalog_tours()') is not null),
  ('function', 'voyage_catalog_tours_for_casting()', to_regprocedure('public.voyage_catalog_tours_for_casting()') is not null),
  ('trigger',  'tour_catalog_zz_manager_guard',     exists (select 1 from pg_trigger where tgname = 'tour_catalog_zz_manager_guard' and not tgisinternal)),
  ('trigger',  'tour_catalog_audit',                exists (select 1 from pg_trigger where tgname = 'tour_catalog_audit' and not tgisinternal)),
  ('trigger',  'partner_castings_catalog_assignment', exists (select 1 from pg_trigger where tgname = 'partner_castings_catalog_assignment' and not tgisinternal)),
  ('trigger',  'tour_catalog_managers_guard',       exists (select 1 from pg_trigger where tgname = 'tour_catalog_managers_guard' and not tgisinternal)),
  ('policy',   'tour_catalog_select uses voyage_catalog_manager_can_read',
               exists (select 1 from pg_policy where polrelid = 'public.tour_catalog'::regclass and polname = 'tour_catalog_select'
                         and pg_get_expr(polqual, polrelid) like '%voyage_catalog_manager_can_read%')),
  ('policy',   'tour_catalog_update uses voyage_catalog_i_manage',
               exists (select 1 from pg_policy where polrelid = 'public.tour_catalog'::regclass and polname = 'tour_catalog_update'
                         and pg_get_expr(polqual, polrelid) like '%voyage_catalog_i_manage%')),
  ('rls',      'tour_catalog_managers RLS on',      coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.tour_catalog_managers')), false)),
  ('rls',      'tour_catalog_owner_notes RLS on',   coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.tour_catalog_owner_notes')), false))
)
select 'M2' as block, c.kind, c.name, case when c.present then 'OK' else 'MISSING' end as status
  from checks c, guard g
 where g.ok
 order by c.kind, c.name;
-- <<< END M2

-- >>> BLOCK M3
-- M3 · Итог backfill и все назначения (активные и отозванные).
set transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
set local search_path = pg_catalog, pg_temp;
with guard as (
  select case when current_setting('transaction_read_only') <> 'on'
                then (current_setting('transaction_read_only') || ' :: VOYAGE GUARD: транзакция не READ ONLY')::boolean
              when replace(current_setting('search_path'), ' ', '') <> 'pg_catalog,pg_temp'
                then ('search_path=' || current_setting('search_path') || ' :: VOYAGE GUARD')::boolean
              else true end as ok
)
select 'M3' as block, x.* from (
  select 'backfill' as kind, l.target_label as tour, l.metadata ->> 'result' as result,
         (select string_agg(r, ', ') from jsonb_array_elements_text(l.metadata -> 'reasons') r) as details,
         l.created_at as at
    from public.audit_logs l
   where l.action = 'tour_catalog.manager_backfill'
  union all
  select 'assignment', m.tour_label, case when m.is_active then 'active' else 'revoked' end,
         m.manager_label || ' · ' || m.source, coalesce(m.revoked_at, m.assigned_at)
    from public.tour_catalog_managers m
) x, guard g
 where g.ok
 order by x.kind, x.tour, x.at;
-- <<< END M3

-- >>> BLOCK M4
-- M4 · Утечки. Ожидается: пустой результат (каждая строка — проблема).
set transaction read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
set local search_path = pg_catalog, pg_temp;
with guard as (
  select case when current_setting('transaction_read_only') <> 'on'
                then (current_setting('transaction_read_only') || ' :: VOYAGE GUARD: транзакция не READ ONLY')::boolean
              when replace(current_setting('search_path'), ' ', '') <> 'pg_catalog,pg_temp'
                then ('search_path=' || current_setting('search_path') || ' :: VOYAGE GUARD')::boolean
              else true end as ok
),
issues as (
  -- Табличные права у anon / лишние у authenticated
  select 'grant' as kind, g.table_name || ': ' || g.grantee || ' ' || g.privilege_type as detail
    from information_schema.role_table_grants g
   where g.table_schema = 'public'
     and g.table_name in ('tour_catalog_managers', 'tour_catalog_owner_notes', 'tour_catalog')
     and (g.grantee in ('anon', 'PUBLIC')
          or (g.grantee = 'authenticated' and g.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER'))
          or (g.grantee = 'authenticated' and g.table_name = 'tour_catalog_managers' and g.privilege_type <> 'SELECT'))
  union all
  -- Политики заметок должны опираться только на is_owner()
  select 'policy', p.polname || ': ' || coalesce(pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid))
    from pg_policy p
   where p.polrelid = to_regclass('public.tour_catalog_owner_notes')
     and coalesce(pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)) not like '%is_owner()%'
  union all
  -- EXECUTE новых функций у anon
  select 'execute', r.routine_name || ': ' || r.grantee
    from information_schema.routine_privileges r
   where r.routine_schema = 'public' and r.grantee in ('anon', 'PUBLIC')
     and (r.routine_name like 'voyage_owner_%catalog%' or r.routine_name like 'voyage_catalog_%'
          or r.routine_name in ('voyage_my_catalog_tours', 'voyage_owner_transfer_casting'))
  union all
  -- Слово «note» не должно встречаться в RPC, которые видят менеджеры и резидентки
  select 'rpc_leak', p.proname
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosrc ilike '%tour_catalog_owner_notes%'
     and p.proname not in ('tour_catalog_owner_notes_touch', 'tour_catalog_owner_notes_audit')
)
select 'M4' as block, i.kind, i.detail from issues i, guard g where g.ok order by 2, 3;
-- <<< END M4
