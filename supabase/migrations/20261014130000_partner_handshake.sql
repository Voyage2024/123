-- VOYAGE Partner Handshake RPC
-- Implements expiring soft options and the final casting -> tour handshake
-- using the existing partner_* tables only. No contract/event table is mutated.

BEGIN;

CREATE OR REPLACE FUNCTION public.partner_set_option(
  p_casting_id uuid,
  p_resident_id uuid,
  p_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := COALESCE(public.is_admin(), false);
  v_casting public.partner_castings%ROWTYPE;
  v_response public.partner_casting_responses%ROWTYPE;
  v_reserved integer;
  v_expires timestamptz;
BEGIN
  IF v_actor IS NULL
     OR NOT COALESCE(public.has_role('manager', 'admin', 'owner'), false) THEN
    RAISE EXCEPTION 'voyage:forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_casting_id IS NULL OR p_resident_id IS NULL
     OR p_hours IS NULL OR p_hours < 1 OR p_hours > 72 THEN
    RAISE EXCEPTION 'voyage:invalid_option' USING ERRCODE = '22023';
  END IF;

  -- Serialize slot allocation so concurrent options cannot overbook a casting.
  SELECT c.* INTO v_casting
  FROM public.partner_castings AS c
  WHERE c.id = p_casting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:casting_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_admin AND v_casting.manager_id <> v_actor THEN
    RAISE EXCEPTION 'voyage:forbidden_casting_owner' USING ERRCODE = '42501';
  END IF;

  IF v_casting.status NOT IN ('open', 'shortlist') OR v_casting.closes_at <= now() THEN
    RAISE EXCEPTION 'voyage:casting_closed' USING ERRCODE = 'P0001';
  END IF;

  SELECT r.* INTO v_response
  FROM public.partner_casting_responses AS r
  WHERE r.casting_id = p_casting_id
    AND r.resident_id = p_resident_id
  FOR UPDATE;

  IF NOT FOUND OR v_response.status NOT IN ('ready', 'option') THEN
    RAISE EXCEPTION 'voyage:candidate_not_available' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = p_resident_id
      AND p.role::text = 'resident'
      AND COALESCE(p.kyc_level, 0) >= 3
  ) OR public.partner_is_blacklisted(p_resident_id) THEN
    RAISE EXCEPTION 'voyage:candidate_not_eligible' USING ERRCODE = '42501';
  END IF;

  -- Count selected candidates and non-expired options, excluding this candidate's
  -- current option so an option can be renewed without consuming another slot.
  SELECT COUNT(*)::integer INTO v_reserved
  FROM public.partner_casting_responses AS r
  WHERE r.casting_id = p_casting_id
    AND r.resident_id <> p_resident_id
    AND (
      r.status = 'selected'
      OR (r.status = 'option' AND r.option_expires_at > now())
    );

  IF v_reserved >= v_casting.slots THEN
    RAISE EXCEPTION 'voyage:casting_full' USING ERRCODE = 'P0001';
  END IF;

  v_expires := now() + make_interval(hours => p_hours);

  UPDATE public.partner_casting_responses
  SET status = 'option', option_expires_at = v_expires
  WHERE id = v_response.id;

  RETURN jsonb_build_object(
    'ok', true,
    'casting_id', p_casting_id,
    'resident_id', p_resident_id,
    'status', 'option',
    'option_expires_at', v_expires
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.partner_handshake(
  p_casting_id uuid,
  p_tour_id uuid,
  p_resident_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := COALESCE(public.is_admin(), false);
  v_casting public.partner_castings%ROWTYPE;
  v_tour public.partner_tours%ROWTYPE;
  v_response public.partner_casting_responses%ROWTYPE;
  v_member_id uuid;
  v_selected integer;
  v_other_reserved integer;
  v_casting_closed boolean := false;
BEGIN
  IF v_actor IS NULL
     OR NOT COALESCE(public.has_role('manager', 'admin', 'owner'), false) THEN
    RAISE EXCEPTION 'voyage:forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_casting_id IS NULL OR p_tour_id IS NULL OR p_resident_id IS NULL THEN
    RAISE EXCEPTION 'voyage:invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Lock casting first: option and handshake calls for this casting serialize.
  SELECT c.* INTO v_casting
  FROM public.partner_castings AS c
  WHERE c.id = p_casting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:casting_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT t.* INTO v_tour
  FROM public.partner_tours AS t
  WHERE t.id = p_tour_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:tour_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- A casting and its tour must have the same owner. A regular manager may only
  -- complete handshakes for records that both belong to the authenticated user.
  IF v_casting.manager_id <> v_tour.manager_id THEN
    RAISE EXCEPTION 'voyage:casting_tour_owner_mismatch' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_admin
     AND (v_casting.manager_id <> v_actor OR v_tour.manager_id <> v_actor) THEN
    RAISE EXCEPTION 'voyage:forbidden_owner' USING ERRCODE = '42501';
  END IF;

  IF v_tour.city IS DISTINCT FROM v_casting.city
     OR v_tour.project_type IS DISTINCT FROM v_casting.project_type THEN
    RAISE EXCEPTION 'voyage:tour_casting_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_tour.casting_id IS NOT NULL AND v_tour.casting_id <> v_casting.id THEN
    RAISE EXCEPTION 'voyage:tour_linked_to_other_casting' USING ERRCODE = '22023';
  END IF;

  SELECT r.* INTO v_response
  FROM public.partner_casting_responses AS r
  WHERE r.casting_id = p_casting_id
    AND r.resident_id = p_resident_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:response_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent retry: a previously completed handshake returns its existing member.
  IF v_response.status = 'selected' THEN
    SELECT m.id INTO v_member_id
    FROM public.partner_tour_members AS m
    WHERE m.tour_id = p_tour_id AND m.resident_id = p_resident_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'already_processed', true,
        'casting_id', p_casting_id,
        'tour_id', p_tour_id,
        'resident_id', p_resident_id,
        'member_id', v_member_id,
        'casting_closed', v_casting.status = 'closed'
      );
    END IF;

    RAISE EXCEPTION 'voyage:response_state_inconsistent' USING ERRCODE = 'P0001';
  END IF;

  IF v_response.status NOT IN ('ready', 'option') THEN
    RAISE EXCEPTION 'voyage:candidate_not_available' USING ERRCODE = 'P0001';
  END IF;

  IF v_casting.status NOT IN ('open', 'shortlist') OR v_casting.closes_at <= now() THEN
    RAISE EXCEPTION 'voyage:casting_closed' USING ERRCODE = 'P0001';
  END IF;

  IF v_tour.status <> 'confirmed' THEN
    RAISE EXCEPTION 'voyage:tour_locked' USING ERRCODE = 'P0001';
  END IF;

  IF v_response.status = 'option' AND v_response.option_expires_at <= now() THEN
    RAISE EXCEPTION 'voyage:option_expired' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = p_resident_id
      AND p.role::text = 'resident'
      AND COALESCE(p.kyc_level, 0) >= 3
  ) OR public.partner_is_blacklisted(p_resident_id) THEN
    RAISE EXCEPTION 'voyage:candidate_not_eligible' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::integer INTO v_selected
  FROM public.partner_casting_responses AS r
  WHERE r.casting_id = p_casting_id AND r.status = 'selected';

  SELECT COUNT(*)::integer INTO v_other_reserved
  FROM public.partner_casting_responses AS r
  WHERE r.casting_id = p_casting_id
    AND r.resident_id <> p_resident_id
    AND r.status = 'option'
    AND r.option_expires_at > now();

  IF v_selected + v_other_reserved >= v_casting.slots THEN
    RAISE EXCEPTION 'voyage:casting_full_or_slots_reserved' USING ERRCODE = 'P0001';
  END IF;

  -- Link an unlinked tour to this casting. Never move a tour already linked elsewhere.
  IF v_tour.casting_id IS NULL THEN
    UPDATE public.partner_tours AS t
    SET casting_id = v_casting.id
    WHERE t.id = v_tour.id;
  END IF;

  UPDATE public.partner_casting_responses AS r
  SET status = 'selected', option_expires_at = NULL
  WHERE r.id = v_response.id;

  INSERT INTO public.partner_tour_members (tour_id, resident_id, status)
  VALUES (v_tour.id, p_resident_id, 'confirmed')
  RETURNING id INTO v_member_id;

  SELECT COUNT(*)::integer INTO v_selected
  FROM public.partner_casting_responses AS r
  WHERE r.casting_id = p_casting_id AND r.status = 'selected';

  IF v_selected >= v_casting.slots THEN
    UPDATE public.partner_castings AS c
    SET status = 'closed'
    WHERE c.id = v_casting.id;

    -- Release other options because all casting slots have been filled.
    UPDATE public.partner_casting_responses AS r
    SET status = 'declined', option_expires_at = NULL
    WHERE r.casting_id = p_casting_id
      AND r.status = 'option'
      AND r.resident_id <> p_resident_id;

    v_casting_closed := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'casting_id', p_casting_id,
    'tour_id', p_tour_id,
    'resident_id', p_resident_id,
    'member_id', v_member_id,
    'status', 'selected',
    'casting_closed', v_casting_closed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_set_option(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_handshake(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_set_option(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_handshake(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.partner_set_option(uuid, uuid, integer) IS
  'voyage:partner · reserve one casting response for 1–72 hours; validates manager ownership and slot capacity.';
COMMENT ON FUNCTION public.partner_handshake(uuid, uuid, uuid) IS
  'voyage:partner · finalizes a casting response into a tour member. Manager must own both casting and tour; admin/owner can operate across managers but the casting and tour owner must still match.';

COMMIT;
