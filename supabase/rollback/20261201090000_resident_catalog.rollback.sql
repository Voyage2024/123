-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · откат этапа 2 (каталог резиденток)
-- supabase/rollback/20261201090000_resident_catalog.rollback.sql
--
-- Удаляет всё, что добавила 20261201090000: таблицы каталога (подборки,
-- приглашения из каталога, скрытия, открытия, доступы менеджеров,
-- общий выключатель), функции voyage_rcat_*, voyage_*catalog*,
-- 3 колонки в resident_visibility. Возвращает две функции этапа 1
-- (voyage_media_access, voyage_resident_media_for_viewer) в точности
-- к версии 20261130090000.
-- Этап 1 (видео, «Кто смотрел», настройки видимости) остаётся как есть.
-- ВНИМАНИЕ: подборки, приглашения из каталога и выданные доступы
-- удаляются безвозвратно. Журнал «Кто смотрел» и audit_logs не трогаются.
-- ════════════════════════════════════════════════════════════════════

begin;

-- 1. Этап 1: функции видео без ветки каталога (копия из 20261130090000)
create or replace function public.voyage_media_access(p_resident uuid, p_context text, p_context_id uuid)
returns text
language plpgsql stable security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_scope text;
  v_consent timestamptz;
begin
  if me is null or p_resident is null then
    return null;
  end if;
  if me = p_resident then
    return 'self';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_resident and p.role::text = 'resident') then
    return null;
  end if;
  if coalesce(public.is_admin(), false) then
    return 'staff';
  end if;
  if public.voyage_ops_role() is distinct from 'manager' then
    return null;
  end if;

  select v.video_scope, v.video_consent_at into v_scope, v_consent
  from public.resident_visibility v where v.resident_id = p_resident;
  if v_consent is null or coalesce(v_scope, 'engaged') = 'hidden' then
    return null;
  end if;
  if public.partner_is_blacklisted(p_resident) then
    return null;
  end if;

  if p_context = 'casting' and p_context_id is not null then
    if public.voyage_casting_profile_access(p_context_id)
       and exists (select 1 from public.partner_casting_responses r
                   where r.casting_id = p_context_id and r.resident_id = p_resident
                     and r.status in ('ready', 'option', 'selected', 'declined')) then
      return 'casting';
    end if;
    return null;
  end if;

  if p_context = 'tour' then
    if exists (select 1 from public.partner_tour_members m
               join public.partner_tours t on t.id = m.tour_id
               where m.resident_id = p_resident
                 and (p_context_id is null or t.id = p_context_id)
                 and public.voyage_acts_for(t.manager_id)) then
      return 'tour';
    end if;
    return null;
  end if;

  return null;
end $$;

comment on function public.voyage_media_access(uuid, text, uuid) is
  'VOYAGE Video Identity: основание просмотра видео резидентки текущим пользователем (self/staff/casting/tour) или null.';

revoke all on function public.voyage_media_access(uuid, text, uuid) from public, anon;
grant execute on function public.voyage_media_access(uuid, text, uuid) to authenticated, service_role;

create or replace function public.voyage_resident_media_for_viewer(
  p_resident uuid, p_context text default null, p_context_id uuid default null)
returns jsonb
language plpgsql volatile security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  v_access text;
  v_items jsonb;
  v_scope text;
  v_consent timestamptz;
begin
  if me is null then
    raise exception 'voyage:not_authenticated' using errcode = '28000';
  end if;
  if p_resident is null or (p_context is not null and p_context not in ('casting', 'tour', 'admin')) then
    raise exception 'voyage:invalid_arguments' using errcode = '22023';
  end if;

  v_access := public.voyage_media_access(p_resident, p_context, p_context_id);
  if v_access is null then
    raise exception 'voyage:forbidden' using errcode = '42501';
  end if;

  select v.video_scope, v.video_consent_at into v_scope, v_consent
  from public.resident_visibility v where v.resident_id = p_resident;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'kind', m.kind, 'source', m.source, 'topic', m.topic,
           'storage_path', m.storage_path, 'poster_path', m.poster_path, 'mime', m.mime,
           'duration_ms', m.duration_ms, 'width', m.width, 'height', m.height,
           'status', m.status,
           'hidden_reason', case when v_access in ('self', 'staff') then m.hidden_reason end,
           'recorded_at', m.recorded_at)
         order by case m.kind when 'intro' then 0 else 1 end, m.position, m.recorded_at desc), '[]'::jsonb)
    into v_items
  from public.resident_media m
  where m.profile_id = p_resident
    and (v_access in ('self', 'staff') or m.status = 'active');

  if v_access in ('casting', 'tour', 'staff') and jsonb_array_length(v_items) > 0 then
    perform public.voyage_log_profile_view(p_resident, v_access, p_context, p_context_id, 'video');
  end if;

  return jsonb_build_object(
    'access', v_access,
    'scope', coalesce(v_scope, 'engaged'),
    'consent', v_consent is not null,
    'items', v_items,
    'latest_at', (select max(m.recorded_at) from public.resident_media m
                  where m.profile_id = p_resident and m.status = 'active'));
end $$;

comment on function public.voyage_resident_media_for_viewer(uuid, text, uuid) is
  'VOYAGE Video Identity: видео резидентки для текущего пользователя. Право — voyage_media_access. Возвращает пути, подписывает их сервер. Просмотр менеджером/персоналом пишется в resident_profile_views и audit_logs.';

revoke all on function public.voyage_resident_media_for_viewer(uuid, text, uuid) from public, anon;
grant execute on function public.voyage_resident_media_for_viewer(uuid, text, uuid) to authenticated, service_role;

-- 2. Функции этапа 2
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and (p.proname like 'voyage\_rcat\_%'
                  or p.proname in ('voyage_my_catalog_state', 'voyage_set_catalog_visibility', 'voyage_set_manager_hidden',
                                   'voyage_catalog_preview', 'voyage_my_catalog_invites', 'voyage_catalog_invite_respond',
                                   'voyage_owner_catalog_overview', 'voyage_owner_catalog_set_access',
                                   'voyage_owner_catalog_settings', 'voyage_staff_catalog_status'))
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

-- 3. Таблицы этапа 2
drop table if exists public.catalog_invites;
drop table if exists public.manager_shortlist_items;
drop table if exists public.manager_shortlists;
drop table if exists public.manager_catalog_opens;
drop table if exists public.resident_hidden_managers;
drop table if exists public.manager_catalog_access;
drop table if exists public.resident_catalog_settings;

-- 4. Колонки этапа 2 в таблице этапа 1
alter table public.resident_visibility drop column if exists catalog_since;
alter table public.resident_visibility drop column if exists catalog_prompt_dismissed_at;
alter table public.resident_visibility drop column if exists preview_seen_at;

commit;
