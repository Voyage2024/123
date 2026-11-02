/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · KYC 3 — VIP-знак в базе резиденток партнёра
 * supabase/migrations/20261102090000_partner_residents_kyc_level.sql
 *
 * partner_residents_list() теперь отдаёт kyc_level, чтобы плитки на
 * /partner/residents показывали золотой знак 3-го уровня и для «своих»
 * резиденток (летавших с этим организатором), у которых KYC может быть < 3.
 * Больше ничего не меняется: фильтр, слепой отбор и права — как в
 * 20261022090000. Хранение уровня прежнее — profiles.kyc_level (0–3),
 * ставит его только персонал через club_admin_set_kyc_level().
 *
 * Без миграции интерфейс тоже работает: не «свои» резидентки попадают
 * в список только с KYC 3, и знак выводится по этому правилу.
 * ──────────────────────────────────────────────────────────────────── */

create or replace function public.partner_residents_list()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
begin
  if me is null or not coalesce(public.has_role('manager', 'admin', 'owner'), false) then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'residents', (
      select coalesce(jsonb_agg(x.j order by x.worked desc, x.verified_at desc nulls last), '[]'::jsonb)
      from (
        select w.worked, s.verified_at,
               jsonb_build_object(
                 'id', p.id,
                 'code', public.partner_blind_code(p.id),
                 'revealed', v_admin or w.worked,
                 'name', case when v_admin or w.worked then public.partner_short_name(p.full_name) end,
                 'height', p.height,
                 'languages', to_jsonb(coalesce(s.languages, '{}'::text[])),
                 'segment', p.segment,
                 'kyc_level', coalesce(p.kyc_level, 0),
                 'open_to_tours', coalesce(s.open_to_tours, false),
                 'verified_at', s.verified_at,
                 'worked_with_me', w.worked,
                 'trust', (select to_jsonb(t) from public.partner_resident_trust(p.id) t)
               ) as j
        from public.profiles p
        left join public.partner_resident_settings s on s.resident_id = p.id
        cross join lateral (
          select exists (
            select 1 from public.partner_tour_members m
            join public.partner_tours t on t.id = m.tour_id
            where m.resident_id = p.id and public.voyage_acts_for(t.manager_id)
          ) as worked
        ) w
        where p.role::text = 'resident'
          and not coalesce(p.is_npc, false)
          and p.status = 'approved'
          and not public.partner_is_blacklisted(p.id)
          and (w.worked or (coalesce(p.kyc_level, 0) >= 3 and coalesce(s.open_to_tours, false)))
        limit 300
      ) x
    )
  );
end $$;

revoke all on function public.partner_residents_list() from public, anon;
grant execute on function public.partner_residents_list() to authenticated;
