-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Прозрачная история баллов резидентки
-- supabase/migrations/20261020093000_points_history.sql
--
-- Требует 20261020092000_partner_tour_completion_points.sql
-- (resident_activities.source_partner_tour_id).
--
--   get_my_points_history(p_limit, p_before, p_profile) → jsonb
--     items    строки ledger (resident_score_events) новыми сверху, у каждой —
--              откуда баллы: тур на карте (map_hubs), тусовка (global_events),
--              тур менеджера (partner_tours), штамп страны, комбо, ачивка,
--              корректировка клуба
--     totals   сумма по категориям за всё время + общий итог
--     next_before  курсор для «Показать ещё» (id последней строки) или null
--
--   p_profile — чужая история доступна только персоналу клуба.
-- ════════════════════════════════════════════════════════════════════

begin;

create or replace function public.get_my_points_history(
  p_limit integer default 30,
  p_before bigint default null,
  p_profile uuid default null
)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_profile uuid := coalesce(p_profile, auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_items jsonb;
  v_totals jsonb;
  v_count integer;
  v_last bigint;
begin
  if me is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if v_profile <> me and not coalesce(public.game_is_staff(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  with page as (
    select e.*
      from public.resident_score_events e
     where e.profile_id = v_profile
       and (p_before is null or e.id < p_before)
     order by e.id desc
     limit v_limit
  ), described as (
    select pg.id, pg.created_at, pg.category, pg.points, pg.reason, pg.activity_id,
           case
             when ap.id is not null then jsonb_build_object(
               'kind', 'tour', 'ref_id', h.id,
               'title', coalesce(h.name ->> 'RU', h.name ->> 'EN', ap.hub_id), 'title_i18n', h.name,
               'region', h.region)
             when ea.id is not null then jsonb_build_object(
               'kind', 'party', 'ref_id', ge.id, 'title', ge.title, 'region', ge.region)
             when a.source_partner_tour_id is not null then jsonb_build_object(
               'kind', 'partner_tour', 'ref_id', a.source_partner_tour_id,
               'title', coalesce(pt.city, a.source_label), 'project', pt.project_type)
             when pg.metadata ? 'destination_id' then jsonb_build_object(
               'kind', 'passport', 'ref_id', pg.metadata ->> 'destination_id',
               'title', coalesce(gd.name, pg.metadata ->> 'destination_id'))
             when pg.category = 'combo' then jsonb_build_object('kind', 'combo', 'title', pg.reason)
             when pg.category = 'achievement' then jsonb_build_object('kind', 'achievement', 'title', pg.reason)
             when pg.category = 'adjustment' then jsonb_build_object('kind', 'adjustment', 'title', pg.reason)
             when a.id is not null then jsonb_build_object('kind', a.activity_type, 'title', a.source_label)
             else jsonb_build_object('kind', pg.category, 'title', pg.reason)
           end as source,
           upper(coalesce(pg.metadata ->> 'country_code', a.destination_code)) as country_code,
           case when a.id is not null then jsonb_build_object(
             'commercial_value', a.commercial_value,
             'reliability', a.reliability_snapshot,
             'complexity', a.complexity_score,
             'completed_at', a.completed_at
           ) end as formula
      from page pg
      left join public.resident_activities a on a.id = pg.activity_id
      left join public.applications ap on ap.id = a.source_application_id
      left join public.map_hubs h on h.id = ap.hub_id
      left join public.event_applications ea on ea.id = a.source_event_application_id
      left join public.global_events ge on ge.id = ea.event_id
      left join public.partner_tours pt on pt.id = a.source_partner_tour_id
      left join public.game_destinations gd on gd.id = pg.metadata ->> 'destination_id'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'at', d.created_at, 'category', d.category, 'points', d.points,
           'reason', d.reason, 'activity_id', d.activity_id, 'source', d.source,
           'country_code', d.country_code, 'formula', d.formula
         ) order by d.id desc), '[]'::jsonb),
         count(*)::int,
         min(d.id)
    into v_items, v_count, v_last
    from described d;

  select jsonb_build_object(
           'total', coalesce(sum(x.points), 0)::int,
           'events', coalesce(sum(x.events), 0)::int,
           'by_category', coalesce(jsonb_object_agg(x.category, x.points), '{}'::jsonb)
         )
    into v_totals
    from (
      select s.category, sum(s.points)::int as points, count(*)::int as events
        from public.resident_score_events s
       where s.profile_id = v_profile
       group by s.category
    ) x;

  return jsonb_build_object(
    'generated_at', now(),
    'profile_id', v_profile,
    'items', v_items,
    'totals', v_totals,
    'next_before', case when v_count = v_limit then v_last end
  );
end;
$$;

revoke all on function public.get_my_points_history(integer, bigint, uuid) from public, anon;
grant execute on function public.get_my_points_history(integer, bigint, uuid) to authenticated, service_role;

commit;
