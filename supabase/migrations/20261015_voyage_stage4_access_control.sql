-- VOYAGE Stage 4: segmented access control and resident event teasers
-- Idempotent migration. Safe to re-run; does not delete or rewrite existing applications.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '90s';

-- ---------------------------------------------------------------------------
-- 1. Audience targeting columns. Existing tours/castings are legacy Working
-- opportunities by default; events keep the existing default of All.
-- ---------------------------------------------------------------------------
ALTER TABLE public.global_events
  ADD COLUMN IF NOT EXISTS minimum_level smallint DEFAULT 1;
UPDATE public.global_events SET minimum_level = 1 WHERE minimum_level IS NULL;
ALTER TABLE public.global_events
  ALTER COLUMN minimum_level SET DEFAULT 1,
  ALTER COLUMN minimum_level SET NOT NULL;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS audience_segment text DEFAULT 'working';
UPDATE public.tours SET audience_segment = 'working' WHERE audience_segment IS NULL;
ALTER TABLE public.tours
  ALTER COLUMN audience_segment SET DEFAULT 'working',
  ALTER COLUMN audience_segment SET NOT NULL;

ALTER TABLE public.partner_castings
  ADD COLUMN IF NOT EXISTS audience_segment text DEFAULT 'working';
UPDATE public.partner_castings SET audience_segment = 'working' WHERE audience_segment IS NULL;
ALTER TABLE public.partner_castings
  ALTER COLUMN audience_segment SET DEFAULT 'working',
  ALTER COLUMN audience_segment SET NOT NULL;

DO $stage4_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.global_events'::regclass AND conname = 'global_events_minimum_level_chk') THEN
    ALTER TABLE public.global_events ADD CONSTRAINT global_events_minimum_level_chk CHECK (minimum_level BETWEEN 1 AND 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.global_events'::regclass AND conname = 'global_events_audience_segment_check') THEN
    ALTER TABLE public.global_events ADD CONSTRAINT global_events_audience_segment_check CHECK (audience_segment IN ('all', 'working', 'elite'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.tours'::regclass AND conname = 'tours_audience_segment_check') THEN
    ALTER TABLE public.tours ADD CONSTRAINT tours_audience_segment_check CHECK (audience_segment IN ('all', 'working', 'elite'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.partner_castings'::regclass AND conname = 'partner_castings_audience_segment_check') THEN
    ALTER TABLE public.partner_castings ADD CONSTRAINT partner_castings_audience_segment_check CHECK (audience_segment IN ('all', 'working', 'elite'));
  END IF;
END;
$stage4_constraints$;

CREATE INDEX IF NOT EXISTS global_events_audience_active_idx
  ON public.global_events (audience_segment, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS tours_audience_visibility_idx
  ON public.tours (audience_segment, visibility, deleted_at);
CREATE INDEX IF NOT EXISTS partner_castings_audience_status_idx
  ON public.partner_castings (audience_segment, status, closes_at);

COMMENT ON COLUMN public.global_events.audience_segment IS 'all = all residents; elite = Elite-only (visible as teaser to Working); working = Working-only.';
COMMENT ON COLUMN public.global_events.minimum_level IS 'Minimum profile level (1..6) required to apply.';
COMMENT ON COLUMN public.tours.audience_segment IS 'Audience access gate. Existing records default to Working.';
COMMENT ON COLUMN public.partner_castings.audience_segment IS 'Audience access gate. Existing records default to Working.';

-- ---------------------------------------------------------------------------
-- 2. Secure event feed. Residents read teasers through this SECURITY DEFINER
-- RPC; direct table SELECT excludes cross-segment events so teaser rows never
-- expose the event's private description/conditions through PostgREST.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_resident_global_event_feed()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_segment text;
  v_events jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT p.segment INTO v_segment
    FROM public.profiles p
   WHERE p.id = v_uid
     AND p.role::text = 'resident'
     AND COALESCE(p.status::text, 'approved') = 'approved'
     AND NOT COALESCE(p.ban_permanent, false)
     AND (p.banned_until IS NULL OR p.banned_until <= now());
  IF NOT FOUND THEN RAISE EXCEPTION 'not a resident' USING ERRCODE = '42501'; END IF;

  SELECT COALESCE(jsonb_agg(feed.item ORDER BY feed.created_at DESC), '[]'::jsonb)
    INTO v_events
    FROM (
      SELECT e.created_at,
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'region', e.region,
          'description', CASE WHEN v_segment = 'working' AND e.audience_segment = 'elite' THEN NULL ELSE e.description END,
          'conditions', CASE WHEN v_segment = 'working' AND e.audience_segment = 'elite' THEN NULL ELSE e.conditions END,
          'is_active', e.is_active,
          'audience_segment', e.audience_segment,
          'minimum_level', COALESCE(e.minimum_level, 1),
          'minimum_kyc_level', COALESCE(e.minimum_kyc_level, 0),
          'is_teaser', (v_segment = 'working' AND e.audience_segment = 'elite'),
          'created_at', e.created_at
        ) AS item
      FROM public.global_events e
      WHERE e.is_active = true
        AND (
          e.audience_segment = 'all'
          OR e.audience_segment = v_segment
          OR (v_segment = 'working' AND e.audience_segment = 'elite')
        )
    ) feed;
  RETURN v_events;
END;
$function$;
-- Grants are applied in the final permissions section below.

-- ---------------------------------------------------------------------------
-- 3. Event eligibility used both by RLS and UI-independent direct INSERTs.
-- A Working resident may SEE an Elite teaser, but cannot apply.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_apply_to_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.global_events e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = p_event_id
      AND e.is_active = true
      AND (e.application_closes_at IS NULL OR e.application_closes_at > now())
      AND (e.audience_segment = 'all' OR e.audience_segment = p.segment)
      AND p.role::text = 'resident'
      AND p.segment IN ('working', 'elite')
      AND COALESCE(p.status, 'approved') = 'approved'
      AND COALESCE(p.level, 1) >= COALESCE(e.minimum_level, 1)
      AND COALESCE(p.kyc_level, 0) >= COALESCE(e.minimum_kyc_level, 0)
      AND NOT COALESCE(p.ban_permanent, false)
      AND (p.banned_until IS NULL OR p.banned_until <= now())
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_applications a
    WHERE a.user_id = auth.uid()
      AND a.event_id = p_event_id
      AND a.status = 'rejected'
      AND a.updated_at > now() - interval '1 month'
  );
$function$;

-- Server-side application RPC also validates the same rules, including level.
CREATE OR REPLACE FUNCTION public.submit_global_event_application(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_event public.global_events%rowtype;
  v_application public.event_applications%rowtype;
  v_active_count integer;
  v_latest_rejection timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO v_profile
    FROM public.profiles p
   WHERE p.id = v_uid
   FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
  END IF;
  IF v_profile.role::text <> 'resident' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'resident_only');
  END IF;
  IF v_profile.status::text IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_approved');
  END IF;
  IF COALESCE(v_profile.ban_permanent, false)
     OR v_profile.banned_until = 'infinity'::timestamptz
     OR (v_profile.banned_until IS NOT NULL AND v_profile.banned_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'banned');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_event_id::text));
  SELECT * INTO v_event FROM public.global_events e WHERE e.id = p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found'); END IF;
  IF NOT v_event.is_active THEN RETURN jsonb_build_object('ok', false, 'reason', 'event_closed'); END IF;
  IF v_event.application_closes_at IS NOT NULL AND v_event.application_closes_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'application_closed');
  END IF;
  IF COALESCE(v_profile.level, 1) < COALESCE(v_event.minimum_level, 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'level_required',
      'required_level', COALESCE(v_event.minimum_level, 1), 'actual_level', COALESCE(v_profile.level, 1));
  END IF;
  IF COALESCE(v_profile.kyc_level, 0) < COALESCE(v_event.minimum_kyc_level, 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'kyc_required',
      'required_level', COALESCE(v_event.minimum_kyc_level, 0), 'actual_level', COALESCE(v_profile.kyc_level, 0));
  END IF;
  IF v_event.audience_segment IS NOT NULL AND v_event.audience_segment <> 'all'
     AND v_event.audience_segment <> v_profile.segment THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'segment_not_eligible');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_applications a
    WHERE a.event_id = p_event_id AND a.user_id = v_uid AND a.status IN ('pending', 'approved')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_applied');
  END IF;

  SELECT max(a.updated_at) INTO v_latest_rejection
  FROM public.event_applications a
  WHERE a.event_id = p_event_id AND a.user_id = v_uid AND a.status = 'rejected';
  IF v_latest_rejection IS NOT NULL AND v_latest_rejection > now() - interval '1 month' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rejection_cooldown',
      'available_at', v_latest_rejection + interval '1 month');
  END IF;

  IF v_event.capacity IS NOT NULL THEN
    SELECT count(*)::integer INTO v_active_count
    FROM public.event_applications a
    WHERE a.event_id = p_event_id AND a.status IN ('pending', 'approved');
    IF v_active_count >= v_event.capacity THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'event_full');
    END IF;
  END IF;

  INSERT INTO public.event_applications(user_id, event_id, status)
  VALUES (v_uid, p_event_id, 'pending')
  RETURNING * INTO v_application;
  RETURN jsonb_build_object('ok', true, 'application', to_jsonb(v_application));
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'already_applied');
END;
$function$;

-- Defense in depth: a resident cannot bypass application eligibility using a
-- direct PostgREST INSERT. Staff retains existing operational overrides.
CREATE OR REPLACE FUNCTION public.enforce_event_application_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text := COALESCE(public.current_user_role()::text, '');
  v_capacity integer;
  v_active_count integer;
  v_latest_rejection timestamptz;
BEGIN
  IF v_role IN ('owner', 'admin', 'manager') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'event_application_user_mismatch' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'resident_application_must_start_pending' USING ERRCODE = '42501';
  END IF;

  -- Serialize concurrent RPC and direct PostgREST attempts for the same event.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.event_id::text));
  SELECT e.capacity INTO v_capacity
    FROM public.global_events e
   WHERE e.id = NEW.event_id AND e.is_active = true
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_application_event_closed' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_apply_to_event(NEW.event_id) THEN
    RAISE EXCEPTION 'event_application_not_eligible' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.event_applications a
    WHERE a.event_id = NEW.event_id AND a.user_id = NEW.user_id
      AND a.id <> NEW.id AND a.status IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'event_application_already_exists' USING ERRCODE = '23505';
  END IF;

  SELECT max(a.updated_at) INTO v_latest_rejection
    FROM public.event_applications a
   WHERE a.event_id = NEW.event_id AND a.user_id = NEW.user_id
     AND a.id <> NEW.id AND a.status = 'rejected';
  IF v_latest_rejection IS NOT NULL AND v_latest_rejection > now() - interval '1 month' THEN
    RAISE EXCEPTION 'event_application_rejection_cooldown' USING ERRCODE = '42501';
  END IF;

  IF v_capacity IS NOT NULL THEN
    SELECT count(*)::integer INTO v_active_count
      FROM public.event_applications a
     WHERE a.event_id = NEW.event_id AND a.id <> NEW.id
       AND a.status IN ('pending', 'approved');
    IF v_active_count >= v_capacity THEN
      RAISE EXCEPTION 'event_application_event_full' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS event_applications_eligibility_guard ON public.event_applications;
CREATE TRIGGER event_applications_eligibility_guard
BEFORE INSERT OR UPDATE OF event_id, user_id, status ON public.event_applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_application_eligibility();

-- RLS INSERT uses the same eligibility function. Drop/recreate to make the
-- policy definition deterministic while preserving staff policies.
DROP POLICY IF EXISTS event_applications_insert_own ON public.event_applications;
CREATE POLICY event_applications_insert_own
ON public.event_applications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND public.can_apply_to_event(event_id)
);

-- Owner/Admin/Manager can continue to read and manage all event applications.
DROP POLICY IF EXISTS event_applications_staff_all ON public.event_applications;
CREATE POLICY event_applications_staff_all
ON public.event_applications FOR ALL TO authenticated
USING (COALESCE(public.current_user_role()::text, '') IN ('owner', 'admin', 'manager'))
WITH CHECK (COALESCE(public.current_user_role()::text, '') IN ('owner', 'admin', 'manager'));

-- ---------------------------------------------------------------------------
-- 3. Resident event feed visibility: Elite sees All/Elite; Working sees
-- Working/All plus Elite teaser cards. The UI hides Elite details for teasers.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS global_events_stage4_staff_all ON public.global_events;
CREATE POLICY global_events_stage4_staff_all
ON public.global_events FOR ALL TO authenticated
USING (COALESCE(public.current_user_role()::text, '') IN ('owner', 'admin', 'manager'))
WITH CHECK (COALESCE(public.current_user_role()::text, '') IN ('owner', 'admin', 'manager'));

DROP POLICY IF EXISTS global_events_select_authenticated ON public.global_events;
CREATE POLICY global_events_select_authenticated
ON public.global_events FOR SELECT TO authenticated
USING (
  public.is_voyage_admin()
  OR COALESCE(public.current_user_role()::text, '') = 'manager'
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role::text = 'resident'
        AND (
          global_events.audience_segment = 'all'
          OR global_events.audience_segment = p.segment
        )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 4. Ordinary tours: old data is Working by default. Elite can only see rows
-- explicitly marked Elite or All. Admin/owner/manager access is preserved.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tours_select ON public.tours;
CREATE POLICY tours_select
ON public.tours FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_owner()
  OR (public.is_manager() AND deleted_at IS NULL AND public.manages_location(location_id))
  OR (
    deleted_at IS NULL
    AND visibility = 'public'::public.tour_visibility
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'resident'
        AND COALESCE(p.status, 'approved') = 'approved'
        AND (tours.audience_segment = 'all' OR tours.audience_segment = p.segment)
    )
  )
  OR (
    deleted_at IS NULL
    AND visibility = 'members'::public.tour_visibility
    AND public.is_approved_member()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'resident'
        AND COALESCE(p.status, 'approved') = 'approved'
        AND (tours.audience_segment = 'all' OR tours.audience_segment = p.segment)
    )
  )
);

-- ---------------------------------------------------------------------------
-- 5. Partner casting feed and direct eligibility: filter by target segment.
-- Elite-only castings can be created intentionally; legacy castings default
-- to Working and therefore never leak into an Elite resident feed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.partner_me_can_respond(p_casting uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text = 'resident'
      AND COALESCE(p.kyc_level, 0) >= 3
      AND COALESCE(p.status, 'approved') = 'approved'
      AND NOT COALESCE(p.ban_permanent, false)
      AND (p.banned_until IS NULL OR p.banned_until <= now())
  )
  AND EXISTS (
    SELECT 1 FROM public.partner_resident_settings s
    WHERE s.resident_id = auth.uid() AND s.open_to_tours = true
  )
  AND NOT public.partner_is_blacklisted(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.partner_castings c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = p_casting
      AND c.status = 'open'
      AND c.closes_at > now()
      AND (c.audience_segment = 'all' OR c.audience_segment = p.segment)
  );
$function$;

CREATE OR REPLACE FUNCTION public.partner_resident_feed()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_height numeric;
  v_kyc integer;
  v_segment text;
  v_status text;
  v_ban_permanent boolean;
  v_banned_until timestamptz;
  v_open boolean;
  v_languages text[];
  v_seen timestamptz;
  v_eligible boolean;
  v_castings jsonb := '[]'::jsonb;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT p.height, COALESCE(p.kyc_level, 0), p.segment,
         COALESCE(p.status::text, 'approved'), COALESCE(p.ban_permanent, false), p.banned_until
    INTO v_height, v_kyc, v_segment, v_status, v_ban_permanent, v_banned_until
    FROM public.profiles p
   WHERE p.id = v_me AND p.role::text = 'resident';
  IF NOT FOUND THEN RAISE EXCEPTION 'not a resident' USING ERRCODE = '42501'; END IF;

  SELECT COALESCE(s.open_to_tours, false), COALESCE(s.languages, '{}'), s.castings_seen_at
    INTO v_open, v_languages, v_seen
    FROM (SELECT 1) AS one
    LEFT JOIN public.partner_resident_settings s ON s.resident_id = v_me;

  v_eligible := v_kyc >= 3
    AND v_status = 'approved'
    AND NOT v_ban_permanent
    AND (v_banned_until IS NULL OR v_banned_until <= now())
    AND v_open
    AND NOT public.partner_is_blacklisted(v_me);

  IF v_eligible THEN
    SELECT COALESCE(jsonb_agg(x.item ORDER BY x.closes_at), '[]'::jsonb)
      INTO v_castings
      FROM (
        SELECT c.closes_at,
          jsonb_build_object(
            'id', c.id,
            'city', c.city,
            'project', c.project_type,
            'audience_segment', c.audience_segment,
            'starts_on', c.starts_on,
            'ends_on', c.ends_on,
            'slots', c.slots,
            'closes_at', c.closes_at,
            'fee_amount', c.fee_amount,
            'fee_currency', c.fee_currency,
            'flight_paid_by', c.flight_paid_by,
            'hotel_paid_by', c.hotel_paid_by,
            'height_min', c.height_min,
            'languages', to_jsonb(c.languages),
            'brief', c.brief,
            'fresh', c.created_at > COALESCE(v_seen, '-infinity'::timestamptz),
            'manager', jsonb_build_object('tier', st.tier, 'rating', st.rating, 'tours', st.tours_done),
            'response', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
              'status', r.status, 'at', r.updated_at, 'option_until', r.option_expires_at
            ) END
          ) AS item
        FROM public.partner_castings c
        LEFT JOIN public.partner_casting_responses r ON r.casting_id = c.id AND r.resident_id = v_me
        CROSS JOIN LATERAL public.partner_manager_stats(c.manager_id) st
        WHERE (c.audience_segment = 'all' OR c.audience_segment = v_segment)
          AND (r.status IS DISTINCT FROM 'declined')
          AND (
            (c.status = 'open' AND c.closes_at > now())
            OR r.status IN ('ready', 'option', 'selected')
          )
      ) x;
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'me', jsonb_build_object('height', v_height, 'languages', to_jsonb(v_languages), 'open_to_tours', v_open, 'segment', v_segment),
    'castings', v_castings
  );
END;
$function$;

-- Resident-facing SECURITY DEFINER RPCs require an authenticated identity.
-- Explicit authenticated grants are set below; PUBLIC/anon do not need to call them.
REVOKE ALL ON FUNCTION public.can_apply_to_event(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_resident_global_event_feed() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_global_event_application(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_me_can_respond(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.partner_resident_feed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_apply_to_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_resident_global_event_feed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_global_event_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_me_can_respond(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_resident_feed() TO authenticated;

COMMIT;
