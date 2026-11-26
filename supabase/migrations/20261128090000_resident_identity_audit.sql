-- ════════════════════════════════════════════════════════════════════
-- VOYAGE · Идентификационные данные резидентки (гражданство, дата рождения):
--          блокировка с момента отправки KYC + атомарный журнал
-- supabase/migrations/20261128090000_resident_identity_audit.sql
--
-- 1. voyage_identity_locked(profile) — данные «под KYC», если kyc_level ≥ 1
--    или есть заявка kyc_submissions в статусе pending ИЛИ approved
--    (с момента отправки документов). Только отклонённые заявки не блокируют.
-- 2. Триггер profiles_identity_audit: ЛЮБОЕ изменение citizenship/birth_date
--    (кем угодно и каким угодно путём) пишет запись 'profile.identity_change'
--    в audit_logs в той же транзакции. Не записалась запись — откатывается и
--    изменение профиля; откатился UPDATE — записи нет.
-- 3. voyage_staff_set_resident_identity(...) — owner/admin меняют гражданство
--    и дату рождения с обязательной причиной (единый путь для карточки
--    резидентки и справочника /admin).
-- 4. voyage_resident_set_identity(...) — резидентка меняет их сама, только
--    пока данные не «под KYC»; проверка блокировки и UPDATE — в одной функции.
-- 5. club_admin_update_profile: смена гражданства через это RPC больше не
--    принимается (voyage:identity_requires_audit) — только через п. 3.
--    Тот же самый гражданство в патче (форма отправляет все поля) — пропускается.
--
-- Схема таблиц, RLS, гранты на таблицы, KYC-функции и данные НЕ меняются.
-- Идемпотентна. Откат: supabase/rollback/20261128090000_resident_identity_audit.rollback.sql
-- ════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Блокировка ───────────────────────────────────────────────────
create or replace function public.voyage_identity_locked(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((select coalesce(p.kyc_level, 0) >= 1 from public.profiles p where p.id = p_profile), false)
      or exists (
           select 1 from public.kyc_submissions k
           where k.profile_id = p_profile and k.status in ('pending', 'approved')
         );
$$;
revoke all on function public.voyage_identity_locked(uuid) from public, anon, authenticated;
grant execute on function public.voyage_identity_locked(uuid) to service_role;

-- ── Проверка значений (те же правила, что в lib/resident-profile-fields.ts) ──
create or replace function public.voyage_identity_normalize(p_patch jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $$
declare
  k text;
  v text;
  d date;
  out jsonb := '{}'::jsonb;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = 'P0001', message = 'voyage:invalid_patch';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k not in ('citizenship', 'birth_date') then
      raise exception using errcode = 'P0001', message = 'voyage:field_not_allowed', detail = k;
    end if;
    if jsonb_typeof(p_patch -> k) not in ('string', 'null') then
      raise exception using errcode = '22023', message = 'voyage:invalid_value', detail = k;
    end if;
    v := nullif(btrim(regexp_replace(coalesce(p_patch ->> k, ''), '\s+', ' ', 'g')), '');
    if k = 'citizenship' then
      if v is not null and (char_length(v) > 100 or v !~ '^[[:alpha:]][[:alpha:] .,''’()/-]*$') then
        raise exception using errcode = '22023', message = 'voyage:invalid_value', detail = k;
      end if;
      out := out || jsonb_build_object(k, v);
    else
      if v is not null then
        if v !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception using errcode = '22023', message = 'voyage:invalid_value', detail = k;
        end if;
        begin
          d := v::date;
        exception when others then
          raise exception using errcode = '22023', message = 'voyage:invalid_value', detail = k;
        end;
        if to_char(d, 'YYYY-MM-DD') <> v or d < date '1900-01-01' or d > current_date then
          raise exception using errcode = '22023', message = 'voyage:invalid_value', detail = k;
        end if;
      end if;
      out := out || jsonb_build_object(k, v);
    end if;
  end loop;
  if out = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'voyage:nothing_to_change';
  end if;
  return out;
end;
$$;
revoke all on function public.voyage_identity_normalize(jsonb) from public, anon, authenticated;

-- ── 2. Журнал любого изменения (триггер) ────────────────────────────
create or replace function public.voyage_audit_profile_identity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_actor uuid;
  v_actor_role text;
  v_source text := nullif(current_setting('voyage.identity_source', true), '');
begin
  if old.citizenship is distinct from new.citizenship then
    v_changes := v_changes || jsonb_build_object('citizenship', jsonb_build_object('from', old.citizenship, 'to', new.citizenship));
  end if;
  if old.birth_date is distinct from new.birth_date then
    v_changes := v_changes || jsonb_build_object('birth_date', jsonb_build_object('from', old.birth_date, 'to', new.birth_date));
  end if;
  if v_changes = '{}'::jsonb then
    return new;
  end if;

  v_actor := public.voyage_current_profile_id();
  if v_actor is not null then
    select p.role::text into v_actor_role from public.profiles p where p.id = v_actor;
  end if;

  insert into public.audit_logs (action, actor_profile_id, actor_user_id, actor_email, actor_role,
                                 target_profile_id, target_label, ip, user_agent, metadata)
  values (
    'profile.identity_change',
    v_actor,
    auth.uid(),
    nullif(current_setting('voyage.identity_actor_email', true), ''),
    coalesce(v_actor_role, case when auth.uid() is null then 'system' end),
    new.id,
    left(coalesce(nullif(btrim(new.full_name), ''), nullif(btrim(new.name), ''), new.id::text), 200),
    left(nullif(current_setting('voyage.identity_ip', true), ''), 128),
    left(nullif(current_setting('voyage.identity_user_agent', true), ''), 512),
    jsonb_build_object(
      'changes', v_changes,
      'reason', nullif(current_setting('voyage.identity_reason', true), ''),
      'source', coalesce(v_source, case when auth.uid() is null then 'service_or_sql' else 'direct' end),
      'kyc_level', coalesce(new.kyc_level, 0),
      'identity_locked', public.voyage_identity_locked(new.id)
    )
  );
  return new;
end;
$$;
revoke all on function public.voyage_audit_profile_identity() from public, anon, authenticated;

drop trigger if exists profiles_identity_audit on public.profiles;
create trigger profiles_identity_audit
  after update of citizenship, birth_date on public.profiles
  for each row
  when (old.citizenship is distinct from new.citizenship or old.birth_date is distinct from new.birth_date)
  execute function public.voyage_audit_profile_identity();

-- ── 3. Правка командой клуба ────────────────────────────────────────
create or replace function public.voyage_staff_set_resident_identity(
  p_profile uuid,
  p_patch jsonb,
  p_reason text,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_patch jsonb;
  v_reason text := nullif(btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g')), '');
  v_set_cit boolean;
  v_set_dob boolean;
  v_new_cit text;
  v_new_dob date;
  v_audit bigint;
begin
  select * into v_actor from public.profiles where id = public.voyage_current_profile_id();
  if v_actor.id is null then
    raise exception using errcode = '28000', message = 'voyage:unauthenticated';
  end if;
  if v_actor.role::text not in ('owner', 'admin')
     or coalesce(v_actor.ban_permanent, false)
     or (v_actor.banned_until is not null and v_actor.banned_until > now()) then
    raise exception using errcode = '42501', message = 'voyage:forbidden';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'voyage:reason_required';
  end if;
  v_patch := public.voyage_identity_normalize(p_patch);

  select * into v_target from public.profiles where id = p_profile for update;
  if v_target.id is null or coalesce(v_target.is_system, false) then
    raise exception using errcode = 'P0002', message = 'voyage:not_found';
  end if;
  if v_target.role::text = 'owner' and v_actor.role::text <> 'owner' then
    raise exception using errcode = '42501', message = 'voyage:forbidden';
  end if;

  v_set_cit := v_patch ? 'citizenship' and (v_patch ->> 'citizenship') is distinct from v_target.citizenship;
  v_set_dob := v_patch ? 'birth_date' and (v_patch ->> 'birth_date')::date is distinct from v_target.birth_date;
  if not v_set_cit and not v_set_dob then
    raise exception using errcode = 'P0001', message = 'voyage:nothing_to_change';
  end if;
  v_new_cit := case when v_set_cit then v_patch ->> 'citizenship' else v_target.citizenship end;
  v_new_dob := case when v_set_dob then (v_patch ->> 'birth_date')::date else v_target.birth_date end;

  -- Контекст для триггера журнала (только до конца этой транзакции)
  perform set_config('voyage.identity_source', 'staff', true);
  perform set_config('voyage.identity_reason', v_reason, true);
  perform set_config('voyage.identity_ip', coalesce(left(p_ip, 128), ''), true);
  perform set_config('voyage.identity_user_agent', coalesce(left(p_user_agent, 512), ''), true);
  perform set_config('voyage.identity_actor_email', coalesce((select u.email from auth.users u where u.id = auth.uid()), ''), true);

  update public.profiles
     set citizenship = v_new_cit,
         birth_date = v_new_dob,
         updated_at = now()
   where id = v_target.id;

  select a.id into v_audit from public.audit_logs a
   where a.action = 'profile.identity_change' and a.target_profile_id = v_target.id
   order by a.id desc limit 1;

  return jsonb_build_object(
    'profile_id', v_target.id,
    'citizenship', v_new_cit,
    'birth_date', to_char(v_new_dob, 'YYYY-MM-DD'),
    'audit_id', v_audit
  );
end;
$$;
revoke all on function public.voyage_staff_set_resident_identity(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.voyage_staff_set_resident_identity(uuid, jsonb, text, text, text) to authenticated, service_role;

-- ── 4. Самостоятельная правка резидентки (пока данные не «под KYC») ──
create or replace function public.voyage_resident_set_identity(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_me public.profiles%rowtype;
  v_patch jsonb;
begin
  select * into v_me from public.profiles where id = public.voyage_current_profile_id() for update;
  if v_me.id is null then
    raise exception using errcode = '28000', message = 'voyage:unauthenticated';
  end if;
  if v_me.role::text <> 'resident'
     or coalesce(v_me.ban_permanent, false)
     or (v_me.banned_until is not null and v_me.banned_until > now()) then
    raise exception using errcode = '42501', message = 'voyage:forbidden';
  end if;
  v_patch := public.voyage_identity_normalize(p_patch);
  if public.voyage_identity_locked(v_me.id) then
    raise exception using errcode = 'P0001', message = 'voyage:identity_locked';
  end if;

  perform set_config('voyage.identity_source', 'resident_self', true);
  update public.profiles
     set citizenship = case when v_patch ? 'citizenship' then v_patch ->> 'citizenship' else citizenship end,
         birth_date  = case when v_patch ? 'birth_date' then (v_patch ->> 'birth_date')::date else birth_date end,
         updated_at  = now()
   where id = v_me.id
  returning * into v_me;

  return jsonb_build_object(
    'citizenship', v_me.citizenship,
    'birth_date', to_char(v_me.birth_date, 'YYYY-MM-DD')
  );
end;
$$;
revoke all on function public.voyage_resident_set_identity(jsonb) from public, anon;
grant execute on function public.voyage_resident_set_identity(jsonb) to authenticated;

-- ── 5. Справочник /admin: гражданство только через аудируемый путь ──
create or replace function public.club_admin_update_profile(p_profile uuid, p_patch jsonb) returns jsonb
    language plpgsql security definer
    set search_path to 'public'
    as $_$
declare
  allowed constant text[] := array['full_name', 'location', 'citizenship', 'status', 'kyc_level'];
  k       text;
  sets    text[] := '{}';
  val     text;
  lvl     integer;
  n       integer;
  out_row jsonb;
begin
  if not public.club_is_admin() then
    raise exception using errcode = '42501', message = 'voyage:forbidden';
  end if;
  if p_profile is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = 'P0001', message = 'voyage:invalid_patch';
  end if;

  for k in select jsonb_object_keys(p_patch) loop
    if not k = any (allowed) then
      raise exception using errcode = 'P0001', message = 'voyage:field_not_allowed', detail = k;
    end if;
    if not public.club_profile_has(k) then
      continue;   -- такой колонки в profiles нет — пропускаем молча
    end if;
    if k = 'kyc_level' then
      lvl := (p_patch ->> k)::integer;
      if lvl is null or lvl not between 1 and 3 then
        raise exception using errcode = 'P0001', message = 'voyage:invalid_kyc_level';
      end if;
      sets := sets || format('%I = %s', k, lvl);
    else
      val := nullif(btrim(regexp_replace(coalesce(p_patch ->> k, ''), '\s+', ' ', 'g')), '');
      if val is not null and char_length(val) > 200 then
        raise exception using errcode = 'P0001', message = 'voyage:value_too_long', detail = k;
      end if;
      -- VOYAGE 20261128090000: гражданство — идентификационные данные, меняются
      -- только через voyage_staff_set_resident_identity (причина + журнал).
      -- Неизменённое значение (форма шлёт все поля) просто пропускаем.
      if k = 'citizenship' then
        if val is distinct from (select p.citizenship from public.profiles p where p.id = p_profile) then
          raise exception using errcode = 'P0001', message = 'voyage:identity_requires_audit', detail = k;
        end if;
        continue;
      end if;
      sets := sets || format('%I = %L', k, val);
    end if;
  end loop;

  if cardinality(sets) > 0 then
    execute format('update public.profiles set %s where id = $1', array_to_string(sets, ', ')) using p_profile;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception using errcode = 'P0001', message = 'voyage:not_found';
    end if;
  end if;

  select to_jsonb(d) into out_row from public.v_admin_directory d where d.id = p_profile;
  return out_row;
end;
$_$;

commit;
