-- ════════════════════════════════════════════════════════════════════
-- ОТКАТ 20261127090000_manager_candidate_profile.sql
-- Возвращает partner_manager_get_responses к версии дампа 20.10 (тело,
-- сигнатура и права — как были, включая EXECUTE для anon), удаляет
-- partner_manager_candidate_profile и voyage_casting_profile_access.
-- Записи 'casting.candidate_profile_view' в audit_logs остаются: журнал
-- append-only, удаление запрещено триггером audit_logs_immutable.
-- После отката верните файлы фронтенда из предыдущей поставки
-- (app/(dashboard)/partner/castings/[id]/page.tsx).
-- ════════════════════════════════════════════════════════════════════

begin;

drop function if exists public.partner_manager_candidate_profile(uuid, uuid);
drop function if exists public.partner_manager_get_responses(uuid);

CREATE FUNCTION public.partner_manager_get_responses(p_casting_id uuid) RETURNS TABLE(response_id uuid, casting_id uuid, resident_id uuid, status text, option_expires_at timestamp with time zone, response_created_at timestamp with time zone, response_updated_at timestamp with time zone, full_name text, avatar_url text, photo_urls text[], height numeric, languages text[], kyc_level integer, circle text, influence_index integer, reliability numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_manager uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'voyage:not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT COALESCE(public.has_role('manager'::public.app_role, 'admin'::public.app_role, 'owner'::public.app_role), false) THEN
    RAISE EXCEPTION 'voyage:forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT c.manager_id INTO v_manager
  FROM public.partner_castings c
  WHERE c.id = p_casting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:casting_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Managers may only inspect their own casting. Admin/owner may operate across teams.
  IF NOT COALESCE(public.is_admin(), false) AND v_manager <> v_actor THEN
    RAISE EXCEPTION 'voyage:forbidden_casting_owner' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.casting_id,
    r.resident_id,
    r.status,
    r.option_expires_at,
    r.created_at,
    r.updated_at,
    COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.name), ''), 'Резидентка'),
    p.avatar_url,
    COALESCE(p.photo_urls, ARRAY[]::text[]),
    p.height,
    COALESCE(s.languages, ARRAY[]::text[]),
    COALESCE(p.kyc_level, 0),
    COALESCE(p.circle, 'voyager'),
    COALESCE(p.influence_index, 0),
    COALESCE(p.reliability, 100.00)
  FROM public.partner_casting_responses r
  JOIN public.profiles p ON p.id = r.resident_id
  LEFT JOIN public.partner_resident_settings s ON s.resident_id = p.id
  WHERE r.casting_id = p_casting_id
    AND p.role::text = 'resident'
    -- Match the existing casting feed: residents in the active Blacklist are not candidates.
    AND NOT public.partner_is_blacklisted(r.resident_id)
  ORDER BY
    CASE r.status WHEN 'ready' THEN 0 WHEN 'option' THEN 1 WHEN 'selected' THEN 2 WHEN 'declined' THEN 3 ELSE 4 END,
    r.created_at ASC;
END;
$$;


ALTER FUNCTION public.partner_manager_get_responses(p_casting_id uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_manager_get_responses(p_casting_id uuid) IS 'Returns response-board profile details only to the casting owner or admin/owner roles; excludes Blacklist candidates as the existing casting feed does.';
REVOKE ALL ON FUNCTION public.partner_manager_get_responses(p_casting_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.partner_manager_get_responses(p_casting_id uuid) TO anon;
GRANT ALL ON FUNCTION public.partner_manager_get_responses(p_casting_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.partner_manager_get_responses(p_casting_id uuid) TO service_role;

drop function if exists public.voyage_casting_profile_access(uuid);

commit;
