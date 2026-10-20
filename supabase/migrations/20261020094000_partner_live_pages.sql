-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Кабинет менеджера без демо-данных: Кастинги, Манифест, Пульс,
--          Ключи, Blacklist + сторона резидентки (мои туры, оценка менеджера)
-- supabase/migrations/20261020094000_partner_live_pages.sql
--
-- Требует 20261020092000_partner_tour_completion_points.sql.
--
-- Каждая страница получает один RPC под SECURITY DEFINER — те же правила
-- приватности, что в partner_command(): до рукопожатия резидентка видна
-- менеджеру только слепым кодом, имя — по partner_can_reveal().
--
--   partner_castings_list()      все кастинги менеджера (админ — все) + слепые отклики
--   partner_manifest()           все туры менеджера: состав, контракт, готовность, итог
--   partner_pulse()              показатели, отзывы резиденток (анонимно), кого оценить
--   partner_keys()               уровень Ключа и туры в зачёте
--   partner_blacklist_list()     активные записи; админ — все, с доказательствами
--   partner_blacklist_candidates()  кого менеджер может отправить на проверку
--   partner_blacklist_report()   менеджер → заявка (status 'pending') на проверку клубом
--   partner_blacklist_add()      админ → запись сразу
--   partner_blacklist_review()   админ → подтвердить / апелляция / снять / срок
--   partner_resident_tours()     резидентка: мои туры и оценка менеджера
--
-- 'pending' не попадает в partner_is_blacklisted(): пока клуб не проверил
-- жалобу, резидентку ничто не блокирует.
-- ════════════════════════════════════════════════════════════════════

begin;

/* ── Blacklist: статус pending, кто проверил ─────────────────────── */

alter table public.partner_blacklist
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists tour_id uuid references public.partner_tours(id) on delete set null;

alter table public.partner_blacklist drop constraint if exists partner_blacklist_status_check;
alter table public.partner_blacklist add constraint partner_blacklist_status_check
  check (status = any (array['pending', 'confirmed', 'appeal', 'revoked']::text[]));

-- Число доказательств: непустые строки поля evidence (ссылки / описания файлов)
create or replace function public.partner_evidence_count(p_evidence text)
returns integer
language sql immutable
set search_path to ''
as $$
  select count(*)::int
    from regexp_split_to_table(coalesce(p_evidence, ''), '\n') as line
   where btrim(line) <> ''
$$;

/* ── Кастинги ───────────────────────────────────────────────────── */

create or replace function public.partner_castings_list()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_admin boolean;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  v_admin := coalesce(public.is_admin(), false);

  return jsonb_build_object(
    'generated_at', now(),
    'castings', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'city', c.city, 'project', c.project_type,
               'starts_on', c.starts_on, 'ends_on', c.ends_on, 'slots', c.slots,
               'closes_at', c.closes_at, 'stage', c.status,
               'fee_amount', c.fee_amount, 'fee_currency', c.fee_currency,
               'flight_paid_by', c.flight_paid_by, 'hotel_paid_by', c.hotel_paid_by,
               'height_min', c.height_min, 'languages', to_jsonb(c.languages), 'brief', c.brief,
               'tour_id', (select t.id from public.partner_tours t where t.casting_id = c.id
                            order by t.created_at desc limit 1),
               'fresh', (select count(*) from public.partner_casting_responses r
                          where r.casting_id = c.id and r.status = 'ready'
                            and r.created_at > c.manager_seen_at
                            and not public.partner_is_blacklisted(r.resident_id)),
               'responders', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'code', public.partner_blind_code(r.id),
                          'handshake', h.done,
                          'resident_id', case when h.done or v_admin then r.resident_id end,
                          'name', case when h.done or v_admin then public.partner_short_name(p.full_name) end,
                          'snap_at', (select max(s.captured_at) from public.partner_live_snaps s
                                       where s.resident_id = r.resident_id),
                          'trusted', (select t.trusted from public.partner_resident_trust(r.resident_id) t)
                        ) order by h.done desc, r.created_at), '[]'::jsonb)
                 from public.partner_casting_responses r
                 join public.profiles p on p.id = r.resident_id
                 cross join lateral (
                   select exists (
                     select 1 from public.partner_tour_members m
                     join public.partner_tours t on t.id = m.tour_id
                     where t.casting_id = c.id and m.resident_id = r.resident_id
                       and m.status in ('confirmed', 'flown')
                   ) as done
                 ) h
                 where r.casting_id = c.id and r.status in ('ready', 'option', 'selected')
                   and not public.partner_is_blacklisted(r.resident_id)
               )
             ) order by
               case c.status when 'open' then 0 when 'shortlist' then 0 when 'closed' then 1 else 2 end,
               c.closes_at), '[]'::jsonb)
      from public.partner_castings c
      where (c.manager_id = me or v_admin)
        and (c.status in ('open', 'shortlist') or c.updated_at > now() - interval '180 days')
    )
  );
end;
$$;

/* ── Манифест ───────────────────────────────────────────────────── */

create or replace function public.partner_manifest()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_admin boolean;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  v_admin := coalesce(public.is_admin(), false);

  return jsonb_build_object(
    'generated_at', now(),
    'tours', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', tr.id, 'city', tr.city, 'iata', tr.iata, 'project', tr.project_type,
               'flight_no', tr.flight_no, 'departs_at', tr.departs_at, 'returns_at', tr.returns_at,
               'status', tr.status, 'country_code', tr.country_code,
               'readiness', case when tr.status <> 'confirmed' then null
                                 when x.replacement is not null then 'replacement'
                                 when ct.id is null or x.signed < x.crew + 1 then 'contract'
                                 when x.no_docs > 0 then 'docs'
                                 else 'confirmed' end,
               'replacement', x.replacement,
               'replacement_id', x.replacement_id,
               'crew', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'id', m.resident_id,
                          'name', public.partner_short_name(p.full_name),
                          'docs', m.docs_verified_at is not null,
                          'signed', ct.id is not null and exists (
                                      select 1 from public.partner_contract_signatures s
                                      where s.contract_id = ct.id and s.signer_id = m.resident_id),
                          'status', m.status
                        ) order by m.joined_at), '[]'::jsonb)
                 from public.partner_tour_members m
                 join public.profiles p on p.id = m.resident_id
                 where m.tour_id = tr.id
                   and (m.status in ('confirmed', 'flown')
                        or (tr.status = 'closed' and m.status in ('late_drop', 'no_show')))
               ),
               'contract', case when ct.id is null then null else jsonb_build_object(
                             'version', ct.version, 'terms', ct.terms,
                             'signed', x.signed, 'required', x.crew + 1,
                             'sealed_at', case when x.signed >= x.crew + 1 then x.last_signed_at end
                           ) end,
               'outcome', case when tr.status = 'closed' then jsonb_build_object(
                            'flown', x.flown, 'dropped', x.dropped) end
             ) order by
               case tr.status when 'in_tour' then 0 when 'confirmed' then 1 when 'closed' then 2 else 3 end,
               case when tr.status in ('in_tour', 'confirmed') then extract(epoch from tr.departs_at)
                    else -extract(epoch from tr.departs_at) end), '[]'::jsonb)
      from public.partner_tours tr
      left join lateral (
        select c.id, c.version, c.terms from public.partner_contracts c
        where c.tour_id = tr.id order by c.version desc limit 1
      ) ct on true
      cross join lateral (
        select
          (select count(*) from public.partner_tour_members m
            where m.tour_id = tr.id and m.status in ('confirmed', 'flown'))::int as crew,
          (select count(*) from public.partner_tour_members m
            where m.tour_id = tr.id and m.status = 'confirmed' and m.docs_verified_at is null)::int as no_docs,
          (select count(*) from public.partner_tour_members m
            where m.tour_id = tr.id and m.status = 'flown')::int as flown,
          (select count(*) from public.partner_tour_members m
            where m.tour_id = tr.id and m.status in ('late_drop', 'no_show'))::int as dropped,
          (select count(*) from public.partner_contract_signatures s
            where s.contract_id = ct.id
              and (s.signer_id = tr.manager_id or s.signer_id in (
                    select m.resident_id from public.partner_tour_members m
                    where m.tour_id = tr.id and m.status in ('confirmed', 'flown'))))::int as signed,
          (select max(s.signed_at) from public.partner_contract_signatures s
            where s.contract_id = ct.id) as last_signed_at,
          rp.name as replacement,
          rp.id as replacement_id
        from (select 1) one
        left join lateral (
          select public.partner_short_name(p.full_name) as name, p.id
          from public.partner_tour_members m
          join public.profiles p on p.id = m.resident_id
          where m.tour_id = tr.id and m.replaces_member_id is not null
            and m.status in ('confirmed', 'flown')
          order by m.joined_at desc limit 1
        ) rp on true
      ) x
      where (tr.manager_id = me or v_admin)
        and (tr.status in ('confirmed', 'in_tour') or tr.departs_at > now() - interval '24 months')
    )
  );
end;
$$;

/* ── Пульс ──────────────────────────────────────────────────────── */

create or replace function public.partner_pulse()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  st record;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  select * into st from public.partner_manager_stats(me);

  return jsonb_build_object(
    'generated_at', now(),
    'manager', jsonb_build_object(
      'tier', st.tier, 'next_tier', st.next_tier,
      'tours_done', st.tours_done, 'tours_for_next', st.tours_for_next,
      'flown', st.flown, 'confirmed', st.confirmed,
      'rating', st.rating, 'reviews', st.reviews
    ),

    -- 12 месяцев по месяцу вылета: долетели / сорвались
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'start', to_char(g.m, 'YYYY-MM-DD'),
               'flown', coalesce(x.flown, 0), 'dropped', coalesce(x.dropped, 0)
             ) order by g.m), '[]'::jsonb)
      from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') g(m)
      left join (
        select date_trunc('month', tr.departs_at) as m,
               count(*) filter (where mb.status = 'flown')::int as flown,
               count(*) filter (where mb.status in ('late_drop', 'no_show'))::int as dropped
        from public.partner_tour_members mb
        join public.partner_tours tr on tr.id = mb.tour_id
        where tr.manager_id = me and tr.status in ('in_tour', 'closed')
        group by 1
      ) x on x.m = g.m
    ),

    'replacements', (
      select jsonb_build_object(
        'total', count(*) filter (where mb.status in ('late_drop', 'no_show'))::int,
        'closed', count(*) filter (where mb.status in ('late_drop', 'no_show') and exists (
                    select 1 from public.partner_tour_members r
                    where r.replaces_member_id = mb.id and r.status in ('confirmed', 'flown')))::int
      )
      from public.partner_tour_members mb
      join public.partner_tours tr on tr.id = mb.tour_id
      where tr.manager_id = me and tr.departs_at > now() - interval '12 months'
    ),

    'criteria', (
      select coalesce(jsonb_agg(jsonb_build_object('key', x.tag, 'count', x.n) order by x.n desc), '[]'::jsonb)
      from (
        select t.tag, count(*)::int as n
        from public.partner_reviews rv
        cross join lateral unnest(rv.tags) as t(tag)
        where rv.subject_id = me and rv.direction = 'resident_to_manager' and rv.status = 'published'
        group by t.tag
      ) x
    ),

    -- Отзывы резиденток — без автора: резидентка не должна бояться оценить
    'feedback', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', v.id, 'rating', v.rating, 'tags', to_jsonb(v.tags), 'quote', v.comment,
               'city', v.city, 'project', v.project_type, 'at', v.created_at
             ) order by v.created_at desc), '[]'::jsonb)
      from (
        select rv.id, rv.rating, rv.tags, rv.comment, rv.created_at, tr.city, tr.project_type
        from public.partner_reviews rv
        join public.partner_tours tr on tr.id = rv.tour_id
        where rv.subject_id = me and rv.direction = 'resident_to_manager' and rv.status = 'published'
        order by rv.created_at desc
        limit 20
      ) v
    ),

    -- Закрытые туры, где менеджер ещё не оценил участниц
    'pending', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'tour_id', tr.id, 'city', tr.city, 'project', tr.project_type,
               'returned_at', coalesce(tr.returns_at, tr.closed_at, tr.departs_at),
               'participants', ps.list
             ) order by coalesce(tr.returns_at, tr.closed_at, tr.departs_at) desc), '[]'::jsonb)
      from public.partner_tours tr
      cross join lateral (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', m.resident_id, 'name', public.partner_short_name(p.full_name),
                 'status', m.status,
                 'trust', (select to_jsonb(t) from public.partner_resident_trust(m.resident_id) t)
               ) order by m.joined_at), '[]'::jsonb) as list,
               count(*) as n
        from public.partner_tour_members m
        join public.profiles p on p.id = m.resident_id
        where m.tour_id = tr.id and m.status in ('flown', 'late_drop', 'no_show')
          and not exists (
            select 1 from public.partner_reviews rv
            where rv.tour_id = tr.id and rv.author_id = me and rv.subject_id = m.resident_id
              and rv.direction = 'manager_to_resident')
      ) ps
      where tr.manager_id = me and tr.status = 'closed'
        and coalesce(tr.closed_at, tr.departs_at) > now() - interval '60 days'
        and ps.n > 0
    ),

    'crew', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.resident_id, 'name', c.name, 'tours', c.tours, 'last_at', c.last_at,
               'trust', (select to_jsonb(t) from public.partner_resident_trust(c.resident_id) t)
             ) order by c.tours desc, c.last_at desc), '[]'::jsonb)
      from (
        select m.resident_id, public.partner_short_name(p.full_name) as name,
               count(*)::int as tours, max(tr.departs_at) as last_at
        from public.partner_tour_members m
        join public.partner_tours tr on tr.id = m.tour_id
        join public.profiles p on p.id = m.resident_id
        where tr.manager_id = me and tr.status = 'closed' and m.status = 'flown'
        group by m.resident_id, p.full_name
        order by count(*) desc, max(tr.departs_at) desc
        limit 6
      ) c
    )
  );
end;
$$;

/* ── Ключи ──────────────────────────────────────────────────────── */

create or replace function public.partner_keys()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  st record;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  select * into st from public.partner_manager_stats(me);

  return jsonb_build_object(
    'generated_at', now(),
    'manager', jsonb_build_object(
      'tier', st.tier, 'next_tier', st.next_tier,
      'tours_done', st.tours_done, 'tours_for_next', st.tours_for_next,
      'flown', st.flown, 'confirmed', st.confirmed,
      'rating', st.rating, 'reviews', st.reviews
    ),
    'closed_total', (select count(*)::int from public.partner_tours t
                      where t.manager_id = me and t.status = 'closed'),
    'closed_year', (select count(*)::int from public.partner_tours t
                     where t.manager_id = me and t.status = 'closed'
                       and t.departs_at > now() - interval '12 months'),
    'counted', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'city', t.city, 'project', t.project_type,
               'departs_at', t.departs_at, 'expires_at', t.departs_at + interval '12 months'
             ) order by t.departs_at), '[]'::jsonb)
      from public.partner_tours t
      where t.manager_id = me and t.status = 'closed'
        and t.departs_at > now() - interval '12 months'
    )
  );
end;
$$;

/* ── Blacklist ──────────────────────────────────────────────────── */

create or replace function public.partner_blacklist_list()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_admin boolean;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  v_admin := coalesce(public.is_admin(), false);

  return jsonb_build_object(
    'generated_at', now(),
    'is_admin', v_admin,
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', b.id, 'code', public.partner_blind_code(b.id, 'R'),
               'reason', b.reason, 'status', b.status, 'at', b.created_at, 'expires_at', b.expires_at,
               'evidence', public.partner_evidence_count(b.evidence),
               'resident_id', case when b.revealed then b.resident_id end,
               'name', case when b.revealed then public.partner_short_name(p.full_name) end,
               'mine', b.created_by = me,
               -- Админу — подробности для решения
               'evidence_text', case when v_admin then b.evidence end,
               'reporter', case when v_admin then public.partner_short_name(rp.full_name) end,
               'reviewed_at', case when v_admin then b.reviewed_at end
             ) order by
               case b.status when 'pending' then 0 when 'appeal' then 1 when 'confirmed' then 2 else 3 end,
               b.created_at desc), '[]'::jsonb)
      from (
        select bl.*, public.partner_can_reveal(bl.resident_id) as revealed
        from public.partner_blacklist bl
        where (
          v_admin
          or (bl.status in ('confirmed', 'appeal') and (bl.expires_at is null or bl.expires_at > now()))
          or (bl.created_by = me and bl.status = 'pending')
        )
        order by bl.created_at desc
        limit 300
      ) b
      join public.profiles p on p.id = b.resident_id
      left join public.profiles rp on rp.id = b.created_by
    ),
    'clean', not exists (
      select 1 from public.partner_tour_members m
      join public.partner_tours tr on tr.id = m.tour_id
      where tr.manager_id = me and tr.status in ('confirmed', 'in_tour') and m.status = 'confirmed'
        and public.partner_is_blacklisted(m.resident_id)
    ) and not exists (
      select 1 from public.partner_casting_responses r
      join public.partner_castings c on c.id = r.casting_id
      where c.manager_id = me and c.status in ('open', 'shortlist')
        and r.status in ('option', 'selected')
        and public.partner_is_blacklisted(r.resident_id)
    )
  );
end;
$$;

-- Кого можно отправить на проверку: участницы туров менеджера (админ — все резидентки)
create or replace function public.partner_blacklist_candidates()
returns table(resident_id uuid, name text, last_tour_id uuid, last_city text, last_at timestamptz, last_status text)
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_admin boolean;
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  v_admin := coalesce(public.is_admin(), false);

  return query
  select distinct on (p.id)
         p.id, coalesce(public.partner_short_name(p.full_name), 'Резидентка'),
         tr.id, tr.city, tr.departs_at, m.status
    from public.profiles p
    left join public.partner_tour_members m on m.resident_id = p.id
    left join public.partner_tours tr on tr.id = m.tour_id and (v_admin or tr.manager_id = me)
   where p.role = 'resident'
     and (v_admin or tr.id is not null)
     and not public.partner_is_blacklisted(p.id)
   order by p.id, tr.departs_at desc nulls last
   limit 1000;
end;
$$;

create or replace function public.partner_blacklist_report(
  p_resident uuid, p_reason text, p_evidence text, p_tour uuid default null
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
  v_evidence text := nullif(btrim(coalesce(p_evidence, '')), '');
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_reason not in ('no_show', 'fake_photos', 'fraud') then
    raise exception 'voyage:invalid_reason' using errcode = '22023';
  end if;
  if v_evidence is null or length(v_evidence) < 10 or length(v_evidence) > 4000 then
    raise exception 'voyage:evidence_required' using errcode = '22023';
  end if;
  -- Только бывшая участница своих туров (админ — любая резидентка)
  if not public.partner_can_reveal(p_resident)
     or not exists (select 1 from public.profiles p where p.id = p_resident and p.role = 'resident') then
    raise exception 'voyage:forbidden_resident' using errcode = '42501';
  end if;
  if p_tour is not null and not exists (
    select 1 from public.partner_tours t
    join public.partner_tour_members m on m.tour_id = t.id and m.resident_id = p_resident
    where t.id = p_tour and (t.manager_id = me or coalesce(public.is_admin(), false))
  ) then
    raise exception 'voyage:forbidden_tour' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.partner_blacklist b
    where b.resident_id = p_resident and b.created_by = me and b.status = 'pending'
  ) then
    raise exception 'voyage:report_already_pending' using errcode = 'P0001';
  end if;

  insert into public.partner_blacklist (resident_id, reason, status, evidence, created_by, tour_id)
  values (p_resident, p_reason, 'pending', v_evidence, me, p_tour)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending',
                            'code', public.partner_blind_code(v_id, 'R'));
end;
$$;

create or replace function public.partner_blacklist_add(
  p_resident uuid, p_reason text, p_evidence text, p_expires_at timestamptz default null
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_id uuid;
begin
  if me is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_reason not in ('no_show', 'fake_photos', 'fraud') then
    raise exception 'voyage:invalid_reason' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_resident and p.role = 'resident') then
    raise exception 'voyage:resident_not_found' using errcode = 'P0002';
  end if;

  insert into public.partner_blacklist (resident_id, reason, status, evidence, created_by, expires_at, reviewed_by, reviewed_at)
  values (p_resident, p_reason, 'confirmed', nullif(btrim(coalesce(p_evidence, '')), ''), me, p_expires_at, me, now())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'confirmed');
end;
$$;

-- p_expires_at: null — не менять; p_clear_expiry = true — бессрочно
create or replace function public.partner_blacklist_review(
  p_id uuid, p_status text, p_expires_at timestamptz default null, p_clear_expiry boolean default false
)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  b public.partner_blacklist%rowtype;
begin
  if me is null or not coalesce(public.is_admin(), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  if p_status not in ('confirmed', 'appeal', 'revoked') then
    raise exception 'voyage:invalid_status' using errcode = '22023';
  end if;

  select * into b from public.partner_blacklist where id = p_id for update;
  if not found then raise exception 'voyage:entry_not_found' using errcode = 'P0002'; end if;

  update public.partner_blacklist
     set status = p_status,
         expires_at = case
           when p_clear_expiry then null
           when p_expires_at is not null then p_expires_at
           -- Подтверждённая неявка без срока — 12 месяцев, как при прямом добавлении
           when p_status = 'confirmed' and b.status = 'pending' and b.reason = 'no_show' and b.expires_at is null
             then now() + interval '12 months'
           else expires_at end,
         reviewed_by = me,
         reviewed_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'status', p_status);
end;
$$;

/* ── Резидентка: мои туры и оценка менеджера ────────────────────── */

create or replace function public.partner_resident_tours()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me and p.role = 'resident') then
    raise exception 'voyage:resident_only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'tours', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', tr.id, 'city', tr.city, 'project', tr.project_type,
               'departs_at', tr.departs_at, 'returns_at', tr.returns_at,
               'tour_status', tr.status, 'my_status', m.status,
               'manager', (select jsonb_build_object(
                             'name', public.partner_short_name(mp.full_name),
                             'tier', st.tier, 'rating', st.rating)
                           from public.profiles mp
                           cross join lateral public.partner_manager_stats(tr.manager_id) st
                           where mp.id = tr.manager_id),
               'points', (select a.points_awarded from public.resident_activities a
                           where a.source_partner_member_id = m.id),
               'can_review', public.partner_can_review(tr.id, tr.manager_id, 'resident_to_manager')
                             and not exists (select 1 from public.partner_reviews rv
                                             where rv.tour_id = tr.id and rv.author_id = me
                                               and rv.direction = 'resident_to_manager'),
               'my_review', (select jsonb_build_object('rating', rv.rating, 'status', rv.status, 'at', rv.created_at)
                              from public.partner_reviews rv
                             where rv.tour_id = tr.id and rv.author_id = me
                               and rv.direction = 'resident_to_manager'
                             order by rv.created_at desc limit 1),
               'manager_id', tr.manager_id
             ) order by tr.departs_at desc), '[]'::jsonb)
      from public.partner_tour_members m
      join public.partner_tours tr on tr.id = m.tour_id
      where m.resident_id = me and tr.status <> 'cancelled'
    )
  );
end;
$$;

/* ── Права ──────────────────────────────────────────────────────── */

revoke all on function public.partner_castings_list() from public, anon;
revoke all on function public.partner_manifest() from public, anon;
revoke all on function public.partner_pulse() from public, anon;
revoke all on function public.partner_keys() from public, anon;
revoke all on function public.partner_blacklist_list() from public, anon;
revoke all on function public.partner_blacklist_candidates() from public, anon;
revoke all on function public.partner_blacklist_report(uuid, text, text, uuid) from public, anon;
revoke all on function public.partner_blacklist_add(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.partner_blacklist_review(uuid, text, timestamptz, boolean) from public, anon;
revoke all on function public.partner_resident_tours() from public, anon;

grant execute on function public.partner_castings_list() to authenticated, service_role;
grant execute on function public.partner_manifest() to authenticated, service_role;
grant execute on function public.partner_pulse() to authenticated, service_role;
grant execute on function public.partner_keys() to authenticated, service_role;
grant execute on function public.partner_blacklist_list() to authenticated, service_role;
grant execute on function public.partner_blacklist_candidates() to authenticated, service_role;
grant execute on function public.partner_blacklist_report(uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.partner_blacklist_add(uuid, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.partner_blacklist_review(uuid, text, timestamptz, boolean) to authenticated, service_role;
grant execute on function public.partner_resident_tours() to authenticated, service_role;

commit;
