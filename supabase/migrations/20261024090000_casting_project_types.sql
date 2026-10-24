/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · типы проектов кастинга: только «Тур» и «Ивент»
 * supabase/migrations/20261024090000_casting_project_types.sql
 *
 *   tour  — 1–2 недели, поездка с проживанием
 *   event — от нескольких часов до 1 дня
 *
 * Старые значения shoot / show / campaign переводятся в tour, event
 * остаётся event. Перевод одинаковый для partner_castings и partner_tours,
 * поэтому проверка «тип тура = тип кастинга» в рукопожатии не ломается.
 * RLS и права на колонки не меняются: GRANT INSERT/UPDATE(project_type)
 * остаются как были, новые значения ограничивает CHECK.
 *
 * Клиент (lib/project-types.ts) понимает старые значения и до миграции,
 * поэтому порядок «сначала код, потом миграция» безопасен.
 * Миграцию можно запускать повторно.
 * ──────────────────────────────────────────────────────────────────── */

alter table public.partner_castings drop constraint if exists partner_castings_project_type_check;
alter table public.partner_tours    drop constraint if exists partner_tours_project_type_check;

update public.partner_castings
   set project_type = 'tour'
 where project_type is distinct from 'event' and project_type is distinct from 'tour';

update public.partner_tours
   set project_type = 'tour'
 where project_type is distinct from 'event' and project_type is distinct from 'tour';

alter table public.partner_castings
  add constraint partner_castings_project_type_check check (project_type in ('tour', 'event'));
alter table public.partner_tours
  add constraint partner_tours_project_type_check check (project_type in ('tour', 'event'));

comment on column public.partner_castings.project_type is
  'tour — 1–2 недели с проживанием; event — до 1 дня. До 2026-10-24: shoot/show/campaign (→ tour).';
comment on column public.partner_tours.project_type is
  'Копия project_type кастинга: tour | event.';

/* ── Подпись начисления за партнёрский тур ───────────────────────────
 * voyage_award_partner_member из 20261020092000: меняется только v_label
 * («Париж · Тур» / «Дубай · Ивент»), остальное тело без изменений. */

create or replace function public.voyage_award_partner_member(p_member uuid)
returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare
  m public.partner_tour_members%rowtype;
  t public.partner_tours%rowtype;
  v_country text;
  v_value numeric(12,2);
  v_reliability numeric(5,2);
  v_label text;
  v_activity uuid;
begin
  select * into m from public.partner_tour_members where id = p_member;
  if not found or m.status <> 'flown' then return null; end if;
  select * into t from public.partner_tours where id = m.tour_id;
  if not found or t.status <> 'closed' then return null; end if;

  -- Только резидентки клуба
  if not exists (select 1 from public.profiles p where p.id = m.resident_id and p.role = 'resident') then
    return null;
  end if;

  v_country := t.country_code;
  if v_country is null then
    select upper(coalesce(nullif(d.country_code, ''), case when d.code ~* '^[A-Z]{2}$' then d.code end))
      into v_country
      from public.game_destinations d
     where d.active and lower(btrim(d.name)) = lower(btrim(t.city))
     order by d.sort_order
     limit 1;
  end if;
  if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;

  select case when (c.terms ->> 'fee_amount') ~ '^\d+(\.\d+)?$' then (c.terms ->> 'fee_amount')::numeric end
    into v_value
    from public.partner_contracts c
   where c.tour_id = t.id
   order by c.version desc
   limit 1;
  if v_value is null and t.casting_id is not null then
    select pc.fee_amount into v_value from public.partner_castings pc where pc.id = t.casting_id;
  end if;
  v_value := least(greatest(coalesce(v_value, 0), 0), 100000000);

  select coalesce(p.reliability, 100)::numeric(5,2) into v_reliability
    from public.profiles p where p.id = m.resident_id;

  v_label := t.city || ' · ' || case t.project_type
    when 'tour' then 'Тур' when 'event' then 'Ивент' else t.project_type end;

  insert into public.resident_activities (
    profile_id, activity_type, source_partner_member_id, source_partner_tour_id, source_label,
    destination_code, commercial_value, complexity_score, reliability_snapshot, completed_by, completed_at
  ) values (
    m.resident_id, 'tour', m.id, t.id, v_label,
    v_country, v_value, greatest(1, least(3, coalesce(t.complexity_score, 1))),
    coalesce(v_reliability, 100), coalesce(t.closed_by, auth.uid(), t.manager_id), coalesce(t.closed_at, now())
  )
  on conflict (source_partner_member_id) do nothing
  returning id into v_activity;

  if v_activity is not null then
    perform public.resident_process_activity(v_activity);
  end if;
  return v_activity;
end;
$$;

revoke all on function public.voyage_award_partner_member(uuid) from public, anon, authenticated;
grant execute on function public.voyage_award_partner_member(uuid) to service_role;
