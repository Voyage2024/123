-- ════════════════════════════════════════════════════════════════════
-- ОТКАТ 20261128090000_resident_identity_audit.sql
-- Удаляет триггер журнала и функции идентификационных данных и возвращает
-- club_admin_update_profile дословно из дампа 20.10 (гражданство снова можно
-- менять через справочник без журнала).
-- Записи 'profile.identity_change' в audit_logs остаются (журнал неизменяем).
-- ВНИМАНИЕ: перед откатом БД верните код (rollback/ в архиве), иначе
-- анкета и карточка резидентки будут вызывать удалённые функции.
-- ════════════════════════════════════════════════════════════════════
begin;
drop trigger if exists profiles_identity_audit on public.profiles;
drop function if exists public.voyage_audit_profile_identity();
drop function if exists public.voyage_staff_set_resident_identity(uuid, jsonb, text, text, text);
drop function if exists public.voyage_resident_set_identity(jsonb);
drop function if exists public.voyage_identity_normalize(jsonb);
drop function if exists public.voyage_identity_locked(uuid);

CREATE OR REPLACE FUNCTION public.club_admin_update_profile(p_profile uuid, p_patch jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
