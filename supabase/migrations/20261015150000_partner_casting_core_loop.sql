-- VOYAGE · Core Loop: resident casting responses + manager response board
-- Uses the canonical statuses already present in partner_casting_responses:
-- ready | option | selected | declined | withdrawn.
-- `pending` is a UI label; it is not a valid database status.

CREATE OR REPLACE FUNCTION public.partner_resident_my_responses()
RETURNS TABLE (
  response_id uuid,
  casting_id uuid,
  city text,
  project_type text,
  starts_on date,
  ends_on date,
  fee_amount numeric,
  fee_currency text,
  status text,
  option_expires_at timestamptz,
  response_created_at timestamptz,
  response_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'voyage:not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_actor AND p.role::text = 'resident'
  ) THEN
    RAISE EXCEPTION 'voyage:resident_only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    c.id,
    c.city,
    c.project_type,
    c.starts_on,
    c.ends_on,
    c.fee_amount,
    c.fee_currency,
    r.status,
    r.option_expires_at,
    r.created_at,
    r.updated_at
  FROM public.partner_casting_responses r
  JOIN public.partner_castings c ON c.id = r.casting_id
  WHERE r.resident_id = v_actor
  ORDER BY r.updated_at DESC, r.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.partner_resident_my_responses() IS
  'Returns only the authenticated resident''s casting responses and non-sensitive casting details.';

REVOKE ALL ON FUNCTION public.partner_resident_my_responses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_resident_my_responses() TO authenticated;


CREATE OR REPLACE FUNCTION public.partner_manager_get_responses(p_casting_id uuid)
RETURNS TABLE (
  response_id uuid,
  casting_id uuid,
  resident_id uuid,
  status text,
  option_expires_at timestamptz,
  response_created_at timestamptz,
  response_updated_at timestamptz,
  full_name text,
  avatar_url text,
  photo_urls text[],
  height numeric,
  languages text[],
  kyc_level integer,
  circle text,
  influence_index integer,
  reliability numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
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

COMMENT ON FUNCTION public.partner_manager_get_responses(uuid) IS
  'Returns response-board profile details only to the casting owner or admin/owner roles; excludes Blacklist candidates as the existing casting feed does.';

REVOKE ALL ON FUNCTION public.partner_manager_get_responses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_manager_get_responses(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.partner_manager_decline_response(
  p_casting_id uuid,
  p_resident_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_manager uuid;
  v_old_status text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'voyage:not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT COALESCE(public.has_role('manager'::public.app_role, 'admin'::public.app_role, 'owner'::public.app_role), false) THEN
    RAISE EXCEPTION 'voyage:forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT c.manager_id INTO v_manager
  FROM public.partner_castings c
  WHERE c.id = p_casting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:casting_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(public.is_admin(), false) AND v_manager <> v_actor THEN
    RAISE EXCEPTION 'voyage:forbidden_casting_owner' USING ERRCODE = '42501';
  END IF;

  SELECT r.status INTO v_old_status
  FROM public.partner_casting_responses r
  WHERE r.casting_id = p_casting_id AND r.resident_id = p_resident_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:response_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_status NOT IN ('ready', 'option') THEN
    RAISE EXCEPTION 'voyage:response_not_declineable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.partner_casting_responses r
  SET status = 'declined', option_expires_at = NULL, updated_at = now()
  WHERE r.casting_id = p_casting_id AND r.resident_id = p_resident_id;

  RETURN jsonb_build_object(
    'ok', true,
    'casting_id', p_casting_id,
    'resident_id', p_resident_id,
    'previous_status', v_old_status,
    'status', 'declined'
  );
END;
$$;

COMMENT ON FUNCTION public.partner_manager_decline_response(uuid, uuid) IS
  'Declines an active ready/option response after checking casting ownership. Selected/terminal responses cannot be silently overwritten.';

REVOKE ALL ON FUNCTION public.partner_manager_decline_response(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_manager_decline_response(uuid, uuid) TO authenticated;

-- Deliberately do not add broad table-level RLS policies here. Manager profile
-- access is exposed through a narrowly scoped SECURITY DEFINER RPC; all mutations
-- use the existing partner_set_option / partner_handshake checks or the decline RPC.
