-- VOYAGE: Admin-only gamification mutations.
-- Run once in Supabase SQL Editor as a database administrator.
-- All functions re-check the authenticated profile role (owner/admin); UI checks are not trusted.

-- Keep the score event attached to each manually issued achievement instance.
-- Automatic legacy/system achievements keep their established deterministic keys.
ALTER TABLE public.resident_achievements
  ADD COLUMN IF NOT EXISTS score_event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS resident_achievements_score_event_key_uidx
  ON public.resident_achievements(score_event_key)
  WHERE score_event_key IS NOT NULL;

ALTER TABLE public.resident_passport_stamps
  ADD COLUMN IF NOT EXISTS score_event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS resident_passport_stamps_score_event_key_uidx
  ON public.resident_passport_stamps(score_event_key)
  WHERE score_event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resident_process_achievement_award() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_category text;
  v_event_key text;
  v_metadata jsonb;
BEGIN
  IF NEW.points_awarded > 0 THEN
    IF NEW.achievement_key LIKE 'combo:%' THEN
      v_category := 'combo';
      v_event_key := COALESCE(
        NEW.score_event_key,
        'combo:' || NEW.profile_id::text || ':' || substring(NEW.achievement_key FROM 7)
      );
      v_metadata := jsonb_build_object('combo_id', substring(NEW.achievement_key FROM 7), 'achievement_key', NEW.achievement_key, 'source', 'resident_achievements');
    ELSE
      v_category := 'achievement';
      v_event_key := COALESCE(
        NEW.score_event_key,
        'achievement:' || NEW.profile_id::text || ':' || NEW.achievement_key
      );
      v_metadata := jsonb_build_object('achievement_key', NEW.achievement_key, 'source', 'resident_achievements');
    END IF;

    INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata)
    VALUES (NEW.profile_id, NEW.activity_id, v_event_key, v_category, NEW.points_awarded, NEW.title, v_metadata)
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  PERFORM public.resident_refresh_metrics(NEW.profile_id);
  RETURN NEW;
END;
$function$;

-- If an automatic basic achievement was revoked and later legitimately earned
-- again, give that new row a fresh ledger key rather than colliding with its
-- immutable historical event. First-time awards retain the legacy deterministic key.
CREATE OR REPLACE FUNCTION public.resident_award_achievement(
  p_profile_id uuid,
  p_key text,
  p_title text,
  p_activity_id uuid,
  p_rule_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_points integer;
  v_canonical_event_key text;
  v_score_event_key text;
BEGIN
  IF p_profile_id IS NULL OR p_key IS NULL THEN RETURN; END IF;

  SELECT round(r.value)::integer INTO v_points
  FROM public.resident_scoring_rules r
  WHERE r.key = p_rule_key;
  v_points := GREATEST(COALESCE(v_points, 0), 0);

  v_canonical_event_key := 'achievement:' || p_profile_id::text || ':' || p_key;
  IF EXISTS (
    SELECT 1 FROM public.resident_score_events se WHERE se.event_key = v_canonical_event_key
  ) THEN
    v_score_event_key := 'achievement-reissue:' || p_profile_id::text || ':' || p_key || ':' || gen_random_uuid()::text;
  ELSE
    v_score_event_key := NULL;
  END IF;

  INSERT INTO public.resident_achievements(profile_id, achievement_key, title, activity_id, points_awarded, score_event_key)
  VALUES (p_profile_id, p_key, p_title, p_activity_id, v_points, v_score_event_key)
  ON CONFLICT (profile_id, achievement_key) DO NOTHING;

  IF FOUND AND v_points > 0 THEN
    INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata)
    VALUES (
      p_profile_id, p_activity_id, COALESCE(v_score_event_key, v_canonical_event_key),
      'achievement', v_points, p_title,
      jsonb_build_object('achievement_key', p_key)
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resident_process_passport_stamp() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_country_count integer;
  v_canonical_event_key text;
  v_event_key text;
BEGIN
  -- Activity completion writes its passport points in resident_process_activity().
  IF NEW.activity_id IS NOT NULL THEN RETURN NEW; END IF;

  v_canonical_event_key := 'stamp:' || NEW.profile_id::text || ':' || upper(NEW.country_code);
  v_event_key := COALESCE(NEW.score_event_key, v_canonical_event_key);
  IF NEW.score_event_key IS NULL AND EXISTS (
    SELECT 1 FROM public.resident_score_events se WHERE se.event_key = v_canonical_event_key
  ) THEN
    v_event_key := 'passport-stamp-reissue:' || NEW.profile_id::text || ':' || upper(NEW.country_code) || ':' || gen_random_uuid()::text;
  END IF;

  UPDATE public.resident_passport_stamps ps
  SET score_event_key = v_event_key
  WHERE ps.id = NEW.id AND ps.score_event_key IS DISTINCT FROM v_event_key;

  IF COALESCE(NEW.points_awarded,0) > 0 THEN
    INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata)
    VALUES (
      NEW.profile_id, NULL, v_event_key, 'stamp', NEW.points_awarded,
      'First passport stamp: ' || COALESCE(NULLIF(NEW.country_title,''), upper(NEW.country_code)),
      jsonb_build_object('source','resident_passport_stamps','stamp_id',NEW.id,'country_code',upper(NEW.country_code))
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  PERFORM public.resident_award_achievement(
    NEW.profile_id, 'first_country_stamp', 'First Passport Stamp', NULL, 'achievement_first_stamp'
  );

  SELECT count(*)::integer INTO v_country_count
  FROM public.resident_passport_stamps s WHERE s.profile_id = NEW.profile_id;
  IF v_country_count >= 5 THEN
    PERFORM public.resident_award_achievement(
      NEW.profile_id, 'five_countries', 'Five Countries', NULL, 'achievement_five_countries'
    );
  END IF;

  PERFORM public.resident_refresh_metrics(NEW.profile_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resident_process_activity(p_activity_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $function$
DECLARE
  a public.resident_activities%ROWTYPE;
  v_base numeric;
  v_commercial_weight numeric;
  v_reliability_weight numeric;
  v_stamp_bonus integer;
  v_points integer;
  v_stamp_id uuid;
  v_country text;
  v_country_title text;
  v_stamp_count integer;
  v_combo record;
  v_combo_count integer;
  v_combo_event_key text;
  v_combo_score_event_key text;
  v_stamp_event_key text;
  v_stamp_canonical_event_key text;
BEGIN
  SELECT * INTO a FROM public.resident_activities WHERE id = p_activity_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT value INTO v_base FROM public.resident_scoring_rules
  WHERE key = CASE WHEN a.activity_type = 'event' THEN 'base_event_points' ELSE 'base_tour_points' END;
  SELECT value INTO v_commercial_weight FROM public.resident_scoring_rules WHERE key = 'commercial_points_per_100';
  SELECT value INTO v_reliability_weight FROM public.resident_scoring_rules WHERE key = 'reliability_points_per_10_percent';
  SELECT round(value)::integer INTO v_stamp_bonus FROM public.resident_scoring_rules WHERE key = 'first_stamp_points';

  v_points := GREATEST(1, round((
    COALESCE(v_base, CASE WHEN a.activity_type = 'event' THEN 150 ELSE 100 END)
    + floor(COALESCE(a.commercial_value, 0) / 100) * COALESCE(v_commercial_weight, 10)
    + round(COALESCE(a.reliability_snapshot, 100) / 10.0) * COALESCE(v_reliability_weight, 5)
  ) * GREATEST(1, LEAST(3, COALESCE(a.complexity_score, 1))))::integer);

  UPDATE public.resident_activities SET points_awarded = v_points WHERE id = a.id;
  INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
  VALUES (
    a.profile_id, a.id, 'activity:' || a.id::text, a.activity_type, v_points,
    CASE WHEN a.activity_type = 'event' THEN 'Completed club event' ELSE 'Completed tour' END,
    jsonb_build_object('source_label', a.source_label, 'commercial_value', a.commercial_value,
                       'reliability_snapshot', a.reliability_snapshot, 'complexity_score', a.complexity_score),
    a.completed_by
  )
  ON CONFLICT (event_key) DO NOTHING;

  PERFORM public.resident_award_achievement(
    a.profile_id, 'first_completed_activity', 'First Completed Activity', a.id,
    'achievement_first_activity'
  );

  v_country := upper(nullif(btrim(a.destination_code), ''));
  IF v_country IS NOT NULL AND v_country ~ '^[A-Z]{2}$' THEN
    v_country_title := v_country;
    v_stamp_canonical_event_key := 'stamp:' || a.profile_id::text || ':' || v_country;
    v_stamp_event_key := v_stamp_canonical_event_key;
    IF EXISTS (SELECT 1 FROM public.resident_score_events se WHERE se.event_key = v_stamp_canonical_event_key) THEN
      v_stamp_event_key := 'passport-stamp-reissue:' || a.profile_id::text || ':' || v_country || ':' || gen_random_uuid()::text;
    END IF;

    INSERT INTO public.resident_passport_stamps(profile_id, country_code, country_title, activity_id, points_awarded, score_event_key)
    VALUES (a.profile_id, v_country, v_country_title, a.id, GREATEST(COALESCE(v_stamp_bonus,25),0), v_stamp_event_key)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_stamp_id;

    IF v_stamp_id IS NOT NULL THEN
      IF COALESCE(v_stamp_bonus,25) > 0 THEN
        INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
        VALUES (a.profile_id, a.id, v_stamp_event_key,
                'stamp', COALESCE(v_stamp_bonus,25), 'First completed visit to ' || v_country,
                jsonb_build_object('country_code', v_country, 'passport_stamp_id', v_stamp_id), a.completed_by)
        ON CONFLICT (event_key) DO NOTHING;
      END IF;

      PERFORM public.resident_award_achievement(
        a.profile_id, 'first_country_stamp', 'First Passport Stamp', a.id,
        'achievement_first_stamp'
      );

      -- Evaluate the existing legendary-combo definitions against the new
      -- passport. game_destinations.code must match the two-letter country code.
      FOR v_combo IN
        SELECT c.id, c.title, c.destination_ids,
               GREATEST(1, LEAST(COALESCE(c.required_count, cardinality(c.destination_ids)), cardinality(c.destination_ids))) AS need,
               GREATEST(COALESCE(NULLIF(c.bonus, 0), c.bonus_points, 0), 0)::integer AS bonus
        FROM public.game_combos c
        WHERE c.active AND cardinality(c.destination_ids) > 0
      LOOP
        SELECT count(DISTINCT upper(btrim(COALESCE(d.country_code, CASE WHEN d.code ~* '^[A-Z]{2}$' THEN d.code END, ''))))::integer
          INTO v_combo_count
        FROM unnest(v_combo.destination_ids) AS required(destination_id)
        JOIN public.game_destinations d ON d.id = required.destination_id AND d.active
        WHERE COALESCE(d.country_code, CASE WHEN d.code ~* '^[A-Z]{2}$' THEN d.code END) IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.resident_passport_stamps s
            WHERE s.profile_id = a.profile_id
              AND upper(btrim(s.country_code)) = upper(btrim(COALESCE(d.country_code, d.code)))
          );

        IF v_combo_count >= v_combo.need THEN
          v_combo_event_key := 'combo:' || a.profile_id::text || ':' || v_combo.id;
          v_combo_score_event_key := NULL;
          IF EXISTS (SELECT 1 FROM public.resident_score_events se WHERE se.event_key = v_combo_event_key) THEN
            v_combo_score_event_key := 'combo-reissue:' || a.profile_id::text || ':' || v_combo.id::text || ':' || gen_random_uuid()::text;
          END IF;

          INSERT INTO public.resident_achievements(profile_id, achievement_key, title, activity_id, points_awarded, score_event_key)
          VALUES (a.profile_id, 'combo:' || v_combo.id, COALESCE(v_combo.title, 'Legendary Combo'), a.id, v_combo.bonus, v_combo_score_event_key)
          ON CONFLICT (profile_id, achievement_key) DO NOTHING;

          IF FOUND AND v_combo.bonus > 0 THEN
            INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
            VALUES (
              a.profile_id, a.id, COALESCE(v_combo_score_event_key, v_combo_event_key),
              'combo', v_combo.bonus, COALESCE(v_combo.title, 'Legendary Combo'),
              jsonb_build_object('combo_id', v_combo.id), a.completed_by
            )
            ON CONFLICT (event_key) DO NOTHING;
          END IF;
        END IF;
      END LOOP;
    END IF;

    SELECT count(*)::integer INTO v_stamp_count
    FROM public.resident_passport_stamps WHERE profile_id = a.profile_id;
    IF v_stamp_count >= 5 THEN
      PERFORM public.resident_award_achievement(
        a.profile_id, 'five_countries', 'Five Countries', a.id,
        'achievement_five_countries'
      );
    END IF;
  END IF;

  PERFORM public.resident_refresh_metrics(a.profile_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resident_process_game_attendance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $function$
DECLARE
  v_name text;
  v_country text;
  v_points integer;
  v_first_stamp_points integer;
  v_combo record;
  v_need integer;
  v_hit_count integer;
  v_bonus integer;
  v_combo_event_key text;
  v_combo_score_event_key text;
BEGIN
  SELECT d.name,
         upper(COALESCE(NULLIF(d.country_code,''), CASE WHEN d.code ~* '^[A-Z]{2}$' THEN d.code END)),
         GREATEST(0, round(COALESCE(NEW.points, d.points)::numeric * COALESCE(NEW.multiplier, d.multiplier) * public.game_visit_factor(NEW.visit_number)))::integer
    INTO v_name, v_country, v_points
  FROM public.game_destinations d WHERE d.id = NEW.destination_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown game destination %', NEW.destination_id USING ERRCODE = '23503';
  END IF;

  IF v_points > 0 THEN
    INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
    VALUES (
      NEW.profile_id, NULL, 'game-attendance:' || NEW.id::text, 'stamp', v_points,
      'Passport attendance: ' || COALESCE(v_name, NEW.destination_id),
      jsonb_build_object(
        'source','game_attendance', 'game_attendance_id',NEW.id, 'destination_id',NEW.destination_id,
        'visit_number',NEW.visit_number, 'base_points',COALESCE(NEW.points,(SELECT d.points FROM public.game_destinations d WHERE d.id=NEW.destination_id)),
        'multiplier',COALESCE(NEW.multiplier,(SELECT d.multiplier FROM public.game_destinations d WHERE d.id=NEW.destination_id)),
        'backfilled',false
      ),
      auth.uid()
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  IF v_country ~ '^[A-Z]{2}$' THEN
    SELECT GREATEST(0, round(r.value)::integer) INTO v_first_stamp_points
    FROM public.resident_scoring_rules r WHERE r.key = 'first_stamp_points';
    v_first_stamp_points := COALESCE(v_first_stamp_points,25);

    INSERT INTO public.resident_passport_stamps(
      profile_id, country_code, country_title, activity_id, points_awarded, issued_at
    ) VALUES (
      NEW.profile_id, v_country, COALESCE(NULLIF(v_name,''), v_country), NULL,
      v_first_stamp_points, COALESCE(NEW.stamped_at, NEW.created_at, now())
    ) ON CONFLICT (profile_id, country_code) DO NOTHING;
  END IF;

  -- Use the same active destination scope as game_base_influence when deciding legacy combos.
  FOR v_combo IN
    SELECT c.id, c.title, c.destination_ids,
           GREATEST(1, LEAST(COALESCE(c.required_count, cardinality(c.destination_ids)), cardinality(c.destination_ids))) AS needed,
           GREATEST(COALESCE(NULLIF(c.bonus,0), c.bonus_points,0),0)::integer AS bonus_points
    FROM public.game_combos c
    WHERE c.active AND cardinality(c.destination_ids) > 0
  LOOP
    v_need := v_combo.needed;
    SELECT count(DISTINCT ga.destination_id)::integer INTO v_hit_count
    FROM public.game_attendance ga
    JOIN public.game_destinations d ON d.id = ga.destination_id
      AND d.active AND d.region = ANY(ARRAY['mideast','asia','europe','namerica']::text[])
    WHERE ga.profile_id = NEW.profile_id
      AND ga.destination_id = ANY(v_combo.destination_ids);

    IF COALESCE(v_hit_count,0) >= v_need THEN
      v_combo_event_key := 'combo:' || NEW.profile_id::text || ':' || v_combo.id;
      v_combo_score_event_key := NULL;
      IF EXISTS (SELECT 1 FROM public.resident_score_events se WHERE se.event_key = v_combo_event_key) THEN
        v_combo_score_event_key := 'combo-reissue:' || NEW.profile_id::text || ':' || v_combo.id::text || ':' || gen_random_uuid()::text;
      END IF;

      INSERT INTO public.resident_achievements(profile_id, achievement_key, title, activity_id, points_awarded, score_event_key)
      VALUES (NEW.profile_id, 'combo:' || v_combo.id, COALESCE(v_combo.title,'Legendary Combo'), NULL, v_combo.bonus_points, v_combo_score_event_key)
      ON CONFLICT (profile_id, achievement_key) DO NOTHING;

      IF FOUND AND v_combo.bonus_points > 0 THEN
        INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
        VALUES (
          NEW.profile_id, NULL, COALESCE(v_combo_score_event_key, v_combo_event_key),
          'combo', v_combo.bonus_points, COALESCE(v_combo.title,'Legendary Combo'),
          jsonb_build_object('combo_id',v_combo.id,'source','game_attendance','game_attendance_id',NEW.id), auth.uid()
        ) ON CONFLICT (event_key) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  PERFORM public.resident_refresh_metrics(NEW.profile_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_issue_game_stamp(
  p_profile_id uuid,
  p_destination_id text,
  p_points integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_destination_name text;
  v_id uuid;
  v_visit_number integer;
  v_stamped_at timestamptz;
  v_awarded_points integer := 0;
BEGIN
  SELECT p.role::text INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  IF p_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_profile_id AND p.role::text = 'resident'
  ) THEN
    RAISE EXCEPTION 'resident_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_destination_id IS NULL OR length(btrim(p_destination_id)) = 0 THEN
    RAISE EXCEPTION 'destination_required' USING ERRCODE = '22023';
  END IF;
  IF p_points IS NOT NULL AND (p_points < 0 OR p_points > 1000000) THEN
    RAISE EXCEPTION 'invalid_points' USING ERRCODE = '22023';
  END IF;

  SELECT d.name INTO v_destination_name
  FROM public.game_destinations d
  WHERE d.id = p_destination_id AND d.active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'destination_not_found_or_inactive' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.game_attendance(profile_id, destination_id, points)
  VALUES (p_profile_id, p_destination_id, p_points)
  RETURNING id, visit_number, stamped_at INTO v_id, v_visit_number, v_stamped_at;

  SELECT se.points INTO v_awarded_points
  FROM public.resident_score_events se
  WHERE se.event_key = 'game-attendance:' || v_id::text;

  PERFORM public.resident_refresh_metrics(p_profile_id);

  RETURN jsonb_build_object(
    'id', v_id,
    'profile_id', p_profile_id,
    'destination_id', p_destination_id,
    'destination_name', v_destination_name,
    'visit_number', v_visit_number,
    'stamped_at', v_stamped_at,
    'points_awarded', COALESCE(v_awarded_points, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_game_stamp(
  p_attendance_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_stamp record;
  v_country_code text;
  v_original_key text;
  v_points integer;
  v_passport public.resident_passport_stamps%rowtype;
  v_achievement public.resident_achievements%rowtype;
  v_achievement_key text;
  v_achievement_event_key text;
  v_country_count integer;
  v_other_stamped_at timestamptz;
BEGIN
  SELECT p.role::text INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  SELECT ga.id, ga.profile_id, ga.destination_id, ga.stamped_at, ga.visit_number, gd.name,
         upper(COALESCE(NULLIF(gd.country_code, ''), CASE WHEN gd.code ~* '^[A-Z]{2}$' THEN gd.code END)) AS country_code
  INTO v_stamp
  FROM public.game_attendance ga
  JOIN public.game_destinations gd ON gd.id = ga.destination_id
  WHERE ga.id = p_attendance_id
  FOR UPDATE OF ga;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stamp_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_original_key := 'game-attendance:' || v_stamp.id::text;
  SELECT COALESCE(sum(se.points), 0)::integer INTO v_points
  FROM public.resident_score_events se
  WHERE se.event_key = v_original_key
     OR (se.category = 'adjustment' AND se.metadata ->> 'compensates_event_key' = v_original_key);

  IF v_points > 0 THEN
    INSERT INTO public.resident_score_events(profile_id, event_key, category, points, reason, metadata, created_by)
    VALUES (
      v_stamp.profile_id,
      'admin-adjustment:revoke-game-attendance:' || v_stamp.id::text,
      'adjustment',
      -v_points,
      'Admin revoked passport stamp: ' || COALESCE(v_stamp.name, v_stamp.destination_id),
      jsonb_build_object(
        'source', 'admin_revoke_game_stamp',
        'game_attendance_id', v_stamp.id,
        'compensates_event_key', v_original_key,
        'compensated_category', 'stamp',
        'destination_id', v_stamp.destination_id
      ),
      auth.uid()
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  v_country_code := v_stamp.country_code;
  IF v_country_code ~ '^[A-Z]{2}$' THEN
    -- The passport row generated by the attendance trigger is identified by its exact issued_at.
    -- Do not remove a country stamp while another attendance for the same country still exists.
    SELECT ps.* INTO v_passport
    FROM public.resident_passport_stamps ps
    WHERE ps.profile_id = v_stamp.profile_id
      AND ps.country_code = v_country_code
      AND ps.activity_id IS NULL
      AND ps.issued_at = v_stamp.stamped_at
    FOR UPDATE;

    IF FOUND THEN
      -- If this was the attendance that originally produced the country stamp but
      -- another attendance in the same country survives, re-anchor the stamp to it.
      -- This prevents the passport row becoming orphaned when the first of several
      -- country visits is revoked before the last one.
      SELECT other_ga.stamped_at INTO v_other_stamped_at
      FROM public.game_attendance other_ga
      JOIN public.game_destinations other_d ON other_d.id = other_ga.destination_id
      WHERE other_ga.profile_id = v_stamp.profile_id
        AND other_ga.id <> v_stamp.id
        AND upper(COALESCE(NULLIF(other_d.country_code, ''), CASE WHEN other_d.code ~* '^[A-Z]{2}$' THEN other_d.code END)) = v_country_code
      ORDER BY other_ga.stamped_at ASC
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.resident_passport_stamps ps
        SET issued_at = v_other_stamped_at
        WHERE ps.id = v_passport.id;
      ELSE
        v_original_key := COALESCE(v_passport.score_event_key, 'stamp:' || v_stamp.profile_id::text || ':' || v_country_code);
        SELECT COALESCE(sum(se.points), 0)::integer INTO v_points
        FROM public.resident_score_events se
        WHERE se.event_key = v_original_key
           OR (se.category = 'adjustment' AND se.metadata ->> 'compensates_event_key' = v_original_key);

        IF v_points > 0 THEN
          INSERT INTO public.resident_score_events(profile_id, event_key, category, points, reason, metadata, created_by)
          VALUES (
            v_stamp.profile_id,
            'admin-adjustment:revoke-passport-stamp:' || v_passport.id::text,
            'adjustment',
            -v_points,
            'Admin revoked passport country stamp: ' || COALESCE(v_passport.country_title, v_country_code),
            jsonb_build_object(
              'source', 'admin_revoke_passport_stamp',
              'passport_stamp_id', v_passport.id,
              'country_code', v_country_code,
              'compensates_event_key', v_original_key,
              'compensated_category', 'stamp'
            ),
            auth.uid()
          ) ON CONFLICT (event_key) DO NOTHING;
        END IF;

        DELETE FROM public.resident_passport_stamps ps WHERE ps.id = v_passport.id;

        -- Keep threshold achievements consistent with the remaining passport countries.
        SELECT count(*)::integer INTO v_country_count
        FROM public.resident_passport_stamps ps
        WHERE ps.profile_id = v_stamp.profile_id;

        FOR v_achievement IN
          SELECT ra.*
          FROM public.resident_achievements ra
          WHERE ra.profile_id = v_stamp.profile_id
            AND ((ra.achievement_key = 'first_country_stamp' AND v_country_count < 1)
              OR (ra.achievement_key = 'five_countries' AND v_country_count < 5))
          FOR UPDATE
        LOOP
          IF v_achievement.score_event_key IS NOT NULL THEN
            v_achievement_event_key := v_achievement.score_event_key;
          ELSIF v_achievement.achievement_key LIKE 'combo:%' THEN
            v_achievement_event_key := 'combo:' || v_stamp.profile_id::text || ':' || substring(v_achievement.achievement_key FROM 7);
          ELSE
            v_achievement_event_key := 'achievement:' || v_stamp.profile_id::text || ':' || v_achievement.achievement_key;
          END IF;

          SELECT COALESCE(sum(se.points), 0)::integer INTO v_points
          FROM public.resident_score_events se
          WHERE se.event_key = v_achievement_event_key
             OR (se.category = 'adjustment' AND se.metadata ->> 'compensates_event_key' = v_achievement_event_key);

          IF v_points > 0 THEN
            INSERT INTO public.resident_score_events(profile_id, event_key, category, points, reason, metadata, created_by)
            VALUES (
              v_stamp.profile_id,
              'admin-adjustment:revoke-achievement:' || v_achievement.id::text,
              'adjustment',
              -v_points,
              'Achievement no longer qualifies after stamp revocation: ' || v_achievement.title,
              jsonb_build_object(
                'source', 'admin_revoke_game_stamp',
                'achievement_id', v_achievement.id,
                'achievement_key', v_achievement.achievement_key,
                'compensates_event_key', v_achievement_event_key,
                'compensated_category', CASE WHEN v_achievement.achievement_key LIKE 'combo:%' THEN 'combo' ELSE 'achievement' END
              ),
              auth.uid()
            ) ON CONFLICT (event_key) DO NOTHING;
          END IF;

          DELETE FROM public.resident_achievements ra WHERE ra.id = v_achievement.id;
        END LOOP;
      END IF;
    END IF;
  END IF;

  DELETE FROM public.game_attendance ga WHERE ga.id = v_stamp.id;

  -- Remove combinations that no longer qualify after this visit is gone.
  -- The qualification predicate mirrors resident_process_game_attendance().
  FOR v_achievement IN
    SELECT ra.*
    FROM public.resident_achievements ra
    JOIN public.game_combos c ON ra.achievement_key = 'combo:' || c.id
    WHERE ra.profile_id = v_stamp.profile_id
      AND c.active
      AND cardinality(c.destination_ids) > 0
      AND (
        SELECT count(DISTINCT ga.destination_id)::integer
        FROM public.game_attendance ga
        JOIN public.game_destinations d
          ON d.id = ga.destination_id
         AND d.active
         AND d.region = ANY(ARRAY['mideast','asia','europe','namerica']::text[])
        WHERE ga.profile_id = v_stamp.profile_id
          AND ga.destination_id = ANY(c.destination_ids)
      ) < GREATEST(
        1,
        LEAST(COALESCE(c.required_count, cardinality(c.destination_ids)), cardinality(c.destination_ids))
      )
      AND (
        SELECT count(DISTINCT upper(btrim(COALESCE(d.country_code, CASE WHEN d.code ~* '^[A-Z]{2}$' THEN d.code END, ''))))::integer
        FROM unnest(c.destination_ids) AS required(destination_id)
        JOIN public.game_destinations d ON d.id = required.destination_id AND d.active
        WHERE COALESCE(d.country_code, CASE WHEN d.code ~* '^[A-Z]{2}$' THEN d.code END) IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.resident_passport_stamps ps
            WHERE ps.profile_id = v_stamp.profile_id
              AND upper(btrim(ps.country_code)) = upper(btrim(COALESCE(d.country_code, d.code)))
          )
      ) < GREATEST(
        1,
        LEAST(COALESCE(c.required_count, cardinality(c.destination_ids)), cardinality(c.destination_ids))
      )
    FOR UPDATE OF ra
  LOOP
    IF v_achievement.score_event_key IS NOT NULL THEN
      v_achievement_event_key := v_achievement.score_event_key;
    ELSE
      v_achievement_event_key := 'combo:' || v_stamp.profile_id::text || ':' || substring(v_achievement.achievement_key FROM 7);
    END IF;
    SELECT COALESCE(sum(se.points), 0)::integer INTO v_points
    FROM public.resident_score_events se
    WHERE se.event_key = v_achievement_event_key
       OR (se.category = 'adjustment' AND se.metadata ->> 'compensates_event_key' = v_achievement_event_key);

    IF v_points > 0 THEN
      INSERT INTO public.resident_score_events(profile_id, event_key, category, points, reason, metadata, created_by)
      VALUES (
        v_stamp.profile_id,
        'admin-adjustment:revoke-achievement:' || v_achievement.id::text,
        'adjustment',
        -v_points,
        'Combo no longer qualifies after stamp revocation: ' || v_achievement.title,
        jsonb_build_object(
          'source', 'admin_revoke_game_stamp',
          'achievement_id', v_achievement.id,
          'achievement_key', v_achievement.achievement_key,
          'compensates_event_key', v_achievement_event_key,
          'compensated_category', 'combo'
        ),
        auth.uid()
      ) ON CONFLICT (event_key) DO NOTHING;
    END IF;

    DELETE FROM public.resident_achievements ra WHERE ra.id = v_achievement.id;
  END LOOP;

  PERFORM public.resident_refresh_metrics(v_stamp.profile_id);

  RETURN jsonb_build_object(
    'id', v_stamp.id,
    'profile_id', v_stamp.profile_id,
    'destination_id', v_stamp.destination_id,
    'country_code', v_country_code,
    'revoked', true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_issue_resident_achievement(
  p_profile_id uuid,
  p_achievement_key text,
  p_title text,
  p_points integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_id uuid;
  v_inserted_id uuid;
  v_score_event_key text;
  v_earned_at timestamptz;
BEGIN
  SELECT p.role::text INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  IF p_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_profile_id AND p.role::text = 'resident'
  ) THEN
    RAISE EXCEPTION 'resident_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_achievement_key IS NULL OR p_achievement_key !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{1,99}$'
     OR p_achievement_key LIKE 'combo:%' THEN
    RAISE EXCEPTION 'invalid_achievement_key' USING ERRCODE = '22023';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) = 0 OR length(p_title) > 160 THEN
    RAISE EXCEPTION 'invalid_achievement_title' USING ERRCODE = '22023';
  END IF;
  IF p_points IS NULL OR p_points < 0 OR p_points > 1000000 THEN
    RAISE EXCEPTION 'invalid_points' USING ERRCODE = '22023';
  END IF;

  v_id := gen_random_uuid();
  v_score_event_key := 'admin-achievement:' || p_profile_id::text || ':' || v_id::text;

  INSERT INTO public.resident_achievements(id, profile_id, achievement_key, title, points_awarded, score_event_key)
  VALUES (v_id, p_profile_id, btrim(p_achievement_key), btrim(p_title), p_points, v_score_event_key)
  ON CONFLICT (profile_id, achievement_key) DO NOTHING
  RETURNING id, earned_at INTO v_inserted_id, v_earned_at;

  IF v_inserted_id IS NULL THEN
    RAISE EXCEPTION 'achievement_already_exists' USING ERRCODE = '23505';
  END IF;

  PERFORM public.resident_refresh_metrics(p_profile_id);

  RETURN jsonb_build_object(
    'id', v_id,
    'profile_id', p_profile_id,
    'achievement_key', btrim(p_achievement_key),
    'title', btrim(p_title),
    'points_awarded', p_points,
    'earned_at', v_earned_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_resident_achievement(
  p_achievement_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role text;
  v_achievement public.resident_achievements%rowtype;
  v_event_key text;
  v_points integer;
BEGIN
  SELECT p.role::text INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  SELECT ra.* INTO v_achievement
  FROM public.resident_achievements ra
  WHERE ra.id = p_achievement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'achievement_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_achievement.score_event_key IS NOT NULL THEN
    v_event_key := v_achievement.score_event_key;
  ELSIF v_achievement.achievement_key LIKE 'combo:%' THEN
    v_event_key := 'combo:' || v_achievement.profile_id::text || ':' || substring(v_achievement.achievement_key FROM 7);
  ELSE
    v_event_key := 'achievement:' || v_achievement.profile_id::text || ':' || v_achievement.achievement_key;
  END IF;

  SELECT COALESCE(sum(se.points), 0)::integer INTO v_points
  FROM public.resident_score_events se
  WHERE se.event_key = v_event_key
     OR (se.category = 'adjustment' AND se.metadata ->> 'compensates_event_key' = v_event_key);

  IF v_points > 0 THEN
    INSERT INTO public.resident_score_events(profile_id, event_key, category, points, reason, metadata, created_by)
    VALUES (
      v_achievement.profile_id,
      'admin-adjustment:revoke-achievement:' || v_achievement.id::text,
      'adjustment',
      -v_points,
      'Admin revoked achievement: ' || v_achievement.title,
      jsonb_build_object(
        'source', 'admin_revoke_resident_achievement',
        'achievement_id', v_achievement.id,
        'achievement_key', v_achievement.achievement_key,
        'compensates_event_key', v_event_key,
        'compensated_category', CASE WHEN v_achievement.achievement_key LIKE 'combo:%' THEN 'combo' ELSE 'achievement' END
      ),
      auth.uid()
    ) ON CONFLICT (event_key) DO NOTHING;
  END IF;

  DELETE FROM public.resident_achievements ra WHERE ra.id = v_achievement.id;
  PERFORM public.resident_refresh_metrics(v_achievement.profile_id);

  RETURN jsonb_build_object(
    'id', v_achievement.id,
    'profile_id', v_achievement.profile_id,
    'achievement_key', v_achievement.achievement_key,
    'revoked', true
  );
END;
$function$;

-- Preserve category-specific score totals after compensating adjustments.
-- The total Influence Index sums the immutable ledger as before; stamp/achievement/combo
-- breakdowns also include explicitly tagged reversals.
CREATE OR REPLACE FUNCTION public.resident_refresh_metrics(p_profile_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_total integer;
  v_level smallint;
  v_circle text;
BEGIN
  IF p_profile_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.resident_metrics(profile_id)
  VALUES (p_profile_id)
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE public.resident_metrics rm
  SET total_points = rm.legacy_total_points + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id), 0)::integer,
      tour_points = rm.legacy_tour_points + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'tour'), 0)::integer,
      event_points = COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'event'), 0)::integer,
      stamp_points = rm.legacy_stamp_points
        + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'stamp'), 0)::integer
        + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'adjustment' AND se.metadata ->> 'compensated_category' = 'stamp'), 0)::integer,
      achievement_points = COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'achievement'), 0)::integer
        + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'adjustment' AND se.metadata ->> 'compensated_category' = 'achievement'), 0)::integer,
      stamps_count = rm.legacy_stamps_count
        + (SELECT count(*)::integer FROM public.game_attendance ga WHERE ga.profile_id = p_profile_id)
        + (SELECT count(*)::integer FROM public.resident_passport_stamps s WHERE s.profile_id = p_profile_id AND s.activity_id IS NOT NULL),
      destinations_count = rm.legacy_destinations_count
        + (SELECT count(DISTINCT ga.destination_id)::integer FROM public.game_attendance ga WHERE ga.profile_id = p_profile_id)
        + (SELECT count(*)::integer
           FROM public.resident_passport_stamps s
           WHERE s.profile_id = p_profile_id AND s.activity_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
               FROM public.game_attendance ga
               JOIN public.game_destinations gd ON gd.id = ga.destination_id
               WHERE ga.profile_id = p_profile_id
                 AND upper(COALESCE(NULLIF(gd.country_code, ''), CASE WHEN gd.code ~* '^[A-Z]{2}$' THEN gd.code END)) = upper(s.country_code)
             )),
      combo_points = rm.legacy_combo_points
        + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'combo'), 0)::integer
        + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'adjustment' AND se.metadata ->> 'compensated_category' = 'combo'), 0)::integer,
      combos_completed = rm.legacy_combos_completed + (SELECT count(*)::integer FROM public.resident_achievements ach WHERE ach.profile_id = p_profile_id AND ach.achievement_key LIKE 'combo:%'),
      patronage_points = rm.legacy_patronage_points,
      proteges_count = rm.legacy_proteges_count,
      tours_count = rm.legacy_tours_count + (SELECT count(*)::integer FROM public.resident_activities a WHERE a.profile_id = p_profile_id AND a.activity_type = 'tour'),
      completed_activities = (SELECT count(*)::integer FROM public.resident_activities a WHERE a.profile_id = p_profile_id),
      achievements_count = (SELECT count(*)::integer FROM public.resident_achievements a WHERE a.profile_id = p_profile_id),
      updated_at = now()
  WHERE rm.profile_id = p_profile_id
  RETURNING total_points INTO v_total;

  SELECT gc.level::smallint, gc.key
    INTO v_level, v_circle
  FROM public.game_circles gc
  WHERE gc.min_influence <= COALESCE(v_total, 0)
  ORDER BY gc.min_influence DESC, gc.level DESC
  LIMIT 1;

  IF v_level IS NULL THEN
    v_level := CASE
      WHEN COALESCE(v_total,0) >= 30000 THEN 6
      WHEN COALESCE(v_total,0) >= 15000 THEN 5
      WHEN COALESCE(v_total,0) >= 7500 THEN 4
      WHEN COALESCE(v_total,0) >= 3000 THEN 3
      WHEN COALESCE(v_total,0) >= 1000 THEN 2
      ELSE 1
    END;
    v_circle := CASE v_level WHEN 6 THEN 'black' WHEN 5 THEN 'private' WHEN 4 THEN 'inner' WHEN 3 THEN 'preferred' WHEN 2 THEN 'resident' ELSE 'voyager' END;
  END IF;

  PERFORM set_config('voyage.gamification_internal', 'on', true);
  UPDATE public.profiles
  SET influence_index = GREATEST(COALESCE(v_total, 0), 0),
      level = v_level,
      circle = COALESCE(v_circle, 'voyager')
  WHERE id = p_profile_id AND role = 'resident';
  PERFORM set_config('voyage.gamification_internal', 'off', true);
END;
$function$;

ALTER FUNCTION public.resident_refresh_metrics(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.admin_issue_game_stamp(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_game_stamp(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_issue_resident_achievement(uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_resident_achievement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_issue_game_stamp(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_game_stamp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_resident_achievement(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_resident_achievement(uuid) TO authenticated;
