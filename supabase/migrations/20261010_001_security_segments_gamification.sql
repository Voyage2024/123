-- VOYAGE: role-gated segmentation, completion ledger and level metrics.
-- Compatible with the schema dump dated 2026-10-10.
-- Apply in a staging project first. No user rows are deleted.

begin;

-- ---------------------------------------------------------------------
-- 1. Extend existing profile model without replacing legacy columns.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists level smallint not null default 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_level_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_level_range CHECK (level BETWEEN 1 AND 6) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_reliability_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_reliability_range CHECK (reliability BETWEEN 0 AND 100) NOT VALID;
  END IF;
END $$;

-- Normalize legacy data before validating the new numeric range.
UPDATE public.profiles
SET reliability = GREATEST(0, LEAST(100, COALESCE(reliability, 100)))
WHERE reliability IS NULL OR reliability < 0 OR reliability > 100;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_level_range;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_reliability_range;
COMMENT ON COLUMN public.profiles.segment IS 'Access segment: working or elite. Enforced by RLS and server policy.';
COMMENT ON COLUMN public.profiles.level IS 'Cached VOYAGE influence level 1..6, recalculated from resident_metrics.';
COMMENT ON COLUMN public.profiles.reliability IS 'Reliability percentage 0..100, used as a server-side scoring input.';

-- Existing status checks exclude completed. Replace only their CHECK constraints.
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status = ANY (ARRAY['pending','approved','rejected','completed'])) NOT VALID;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_status_check;

ALTER TABLE public.event_applications DROP CONSTRAINT IF EXISTS event_applications_status_check;
ALTER TABLE public.event_applications
  ADD CONSTRAINT event_applications_status_check
  CHECK (status = ANY (ARRAY['pending','approved','rejected','completed'])) NOT VALID;
ALTER TABLE public.event_applications VALIDATE CONSTRAINT event_applications_status_check;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complexity_score numeric(4,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completion_country_code text;

ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complexity_score numeric(4,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completion_country_code text;

ALTER TABLE public.global_events
  ADD COLUMN IF NOT EXISTS audience_segment text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS country_code text;

-- Optional country mapping lets an existing destination catalog use human/location
-- codes while passport stamps always use ISO alpha-2 country codes.
ALTER TABLE public.game_destinations
  ADD COLUMN IF NOT EXISTS country_code text;

UPDATE public.game_destinations
SET country_code = upper(code)
WHERE country_code IS NULL AND code ~* '^[A-Z]{2}$';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.global_events'::regclass
      AND conname = 'global_events_audience_segment_check'
  ) THEN
    ALTER TABLE public.global_events
      ADD CONSTRAINT global_events_audience_segment_check
      CHECK (audience_segment IN ('all','working','elite')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.applications'::regclass
      AND conname = 'applications_completion_value_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_completion_value_check
      CHECK (completion_value BETWEEN 0 AND 100000000 AND complexity_score BETWEEN 1 AND 3
        AND (completion_country_code IS NULL OR completion_country_code ~ '^[A-Za-z]{2}$')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_applications'::regclass
      AND conname = 'event_applications_completion_value_check'
  ) THEN
    ALTER TABLE public.event_applications
      ADD CONSTRAINT event_applications_completion_value_check
      CHECK (completion_value BETWEEN 0 AND 100000000 AND complexity_score BETWEEN 1 AND 3
        AND (completion_country_code IS NULL OR completion_country_code ~ '^[A-Za-z]{2}$')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.game_destinations'::regclass
      AND conname = 'game_destinations_country_code_check'
  ) THEN
    ALTER TABLE public.game_destinations
      ADD CONSTRAINT game_destinations_country_code_check
      CHECK (country_code IS NULL OR country_code ~ '^[A-Za-z]{2}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.global_events'::regclass
      AND conname = 'global_events_country_code_check'
  ) THEN
    ALTER TABLE public.global_events
      ADD CONSTRAINT global_events_country_code_check
      CHECK (country_code IS NULL OR country_code ~ '^[A-Za-z]{2}$') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.global_events VALIDATE CONSTRAINT global_events_audience_segment_check;
ALTER TABLE public.applications VALIDATE CONSTRAINT applications_completion_value_check;
ALTER TABLE public.event_applications VALIDATE CONSTRAINT event_applications_completion_value_check;
ALTER TABLE public.global_events VALIDATE CONSTRAINT global_events_country_code_check;
ALTER TABLE public.game_destinations VALIDATE CONSTRAINT game_destinations_country_code_check;

-- ---------------------------------------------------------------------
-- 2. Ledger tables. Legacy score is snapshotted before changing the view.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resident_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('tour','event')),
  source_application_id uuid UNIQUE REFERENCES public.applications(id),
  source_event_application_id uuid UNIQUE REFERENCES public.event_applications(id),
  source_label text NOT NULL,
  destination_code text,
  commercial_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (commercial_value BETWEEN 0 AND 100000000),
  complexity_score numeric(4,2) NOT NULL DEFAULT 1 CHECK (complexity_score BETWEEN 1 AND 3),
  reliability_snapshot numeric(5,2) NOT NULL DEFAULT 100 CHECK (reliability_snapshot BETWEEN 0 AND 100),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resident_activities_one_source_check CHECK (
    (CASE WHEN source_application_id IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN source_event_application_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  CONSTRAINT resident_activities_destination_code_check CHECK (
    destination_code IS NULL OR destination_code ~ '^[A-Z]{2}$'
  )
);

CREATE TABLE IF NOT EXISTS public.resident_score_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.resident_activities(id) ON DELETE SET NULL,
  event_key text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('tour','event','stamp','combo','achievement','adjustment')),
  points integer NOT NULL CHECK (points <> 0),
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.resident_passport_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  country_title text NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.resident_activities(id) ON DELETE CASCADE,
  points_awarded integer NOT NULL DEFAULT 25 CHECK (points_awarded >= 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, country_code),
  UNIQUE (activity_id)
);

CREATE TABLE IF NOT EXISTS public.resident_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  title text NOT NULL,
  activity_id uuid REFERENCES public.resident_activities(id) ON DELETE SET NULL,
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS public.resident_scoring_rules (
  key text PRIMARY KEY,
  value numeric(12,2) NOT NULL CHECK (value BETWEEN 0 AND 1000000),
  note text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Keep the six canonical levels available when deploying into an empty or
-- partially seeded game_circles table. Existing level rules are not overwritten.
INSERT INTO public.game_circles(level, key, title, min_influence) VALUES
  (1, 'voyager', 'Voyager', 0),
  (2, 'resident', 'Resident', 1000),
  (3, 'preferred', 'Preferred', 3000),
  (4, 'inner', 'Inner Circle', 7500),
  (5, 'private', 'Private Circle', 15000),
  (6, 'black', 'Black Circle', 30000)
ON CONFLICT DO NOTHING;

-- Legacy baselines keep pre-existing stamps, combos, tours and patronage intact.
CREATE TABLE IF NOT EXISTS public.resident_metrics (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  legacy_total_points integer NOT NULL DEFAULT 0,
  legacy_tour_points integer NOT NULL DEFAULT 0,
  legacy_stamp_points integer NOT NULL DEFAULT 0,
  legacy_stamps_count integer NOT NULL DEFAULT 0,
  legacy_destinations_count integer NOT NULL DEFAULT 0,
  legacy_combo_points integer NOT NULL DEFAULT 0,
  legacy_combos_completed integer NOT NULL DEFAULT 0,
  legacy_patronage_points integer NOT NULL DEFAULT 0,
  legacy_proteges_count integer NOT NULL DEFAULT 0,
  legacy_tours_count integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  tour_points integer NOT NULL DEFAULT 0,
  event_points integer NOT NULL DEFAULT 0,
  stamp_points integer NOT NULL DEFAULT 0,
  achievement_points integer NOT NULL DEFAULT 0,
  stamps_count integer NOT NULL DEFAULT 0,
  destinations_count integer NOT NULL DEFAULT 0,
  combo_points integer NOT NULL DEFAULT 0,
  combos_completed integer NOT NULL DEFAULT 0,
  patronage_points integer NOT NULL DEFAULT 0,
  proteges_count integer NOT NULL DEFAULT 0,
  tours_count integer NOT NULL DEFAULT 0,
  completed_activities integer NOT NULL DEFAULT 0,
  achievements_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.resident_scoring_rules(key, value, note) VALUES
  ('base_tour_points', 100, 'Base score for a completed regular tour'),
  ('base_event_points', 150, 'Base score for a completed elite/club event'),
  ('commercial_points_per_100', 10, 'Extra points for each 100 units of completion_value'),
  ('reliability_points_per_10_percent', 5, 'Extra points for each 10 percent reliability'),
  ('first_stamp_points', 25, 'Bonus for the first completed visit to a country'),
  ('achievement_first_activity', 20, 'Achievement bonus: first completed activity'),
  ('achievement_first_stamp', 25, 'Achievement bonus: first country stamp'),
  ('achievement_five_countries', 100, 'Achievement bonus: five unique country stamps')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.resident_metrics(profile_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (profile_id) DO NOTHING;

-- Copy the pre-migration score snapshot only to profiles not yet initialized.
UPDATE public.resident_metrics rm
SET legacy_total_points = COALESCE(lb.total_influence, 0),
    legacy_tour_points = COALESCE(lb.tour_points, 0),
    legacy_stamp_points = COALESCE(lb.stamp_points, 0),
    legacy_stamps_count = COALESCE(lb.stamps_count, 0),
    legacy_destinations_count = COALESCE(lb.destinations_count, 0),
    legacy_combo_points = COALESCE(lb.combo_points, 0),
    legacy_combos_completed = COALESCE(lb.combos_completed, 0),
    legacy_patronage_points = COALESCE(lb.patronage_points, 0),
    legacy_proteges_count = COALESCE(lb.proteges_count, 0),
    legacy_tours_count = COALESCE(lb.tours_count, 0),
    total_points = COALESCE(lb.total_influence, 0),
    tour_points = COALESCE(lb.tour_points, 0),
    stamp_points = COALESCE(lb.stamp_points, 0),
    stamps_count = COALESCE(lb.stamps_count, 0),
    destinations_count = COALESCE(lb.destinations_count, 0),
    combo_points = COALESCE(lb.combo_points, 0),
    combos_completed = COALESCE(lb.combos_completed, 0),
    patronage_points = COALESCE(lb.patronage_points, 0),
    proteges_count = COALESCE(lb.proteges_count, 0),
    tours_count = COALESCE(lb.tours_count, 0)
FROM public.profiles p
LEFT JOIN public.v_global_leaderboard lb ON lb.profile_id = p.id
WHERE rm.profile_id = p.id
  AND rm.total_points = 0
  AND rm.tour_points = 0
  AND rm.stamp_points = 0
  AND NOT EXISTS (SELECT 1 FROM public.resident_score_events se WHERE se.profile_id = p.id);

CREATE INDEX IF NOT EXISTS resident_activities_profile_completed_idx
  ON public.resident_activities(profile_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS resident_score_events_profile_created_idx
  ON public.resident_score_events(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resident_score_events_category_idx
  ON public.resident_score_events(profile_id, category);
CREATE INDEX IF NOT EXISTS resident_passport_stamps_profile_idx
  ON public.resident_passport_stamps(profile_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS resident_achievements_profile_idx
  ON public.resident_achievements(profile_id, earned_at DESC);

-- ---------------------------------------------------------------------
-- 3. Server-owned scoring, achievement awarding and metric refresh.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resident_refresh_metrics(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total integer;
  v_tours integer;
  v_events integer;
  v_stamps integer;
  v_achievements integer;
  v_stamp_count integer;
  v_destinations integer;
  v_activity_count integer;
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
      stamp_points = rm.legacy_stamp_points + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'stamp'), 0)::integer,
      achievement_points = COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'achievement'), 0)::integer,
      stamps_count = rm.legacy_stamps_count + (SELECT count(*)::integer FROM public.resident_passport_stamps s WHERE s.profile_id = p_profile_id),
      destinations_count = rm.legacy_destinations_count + (SELECT count(*)::integer FROM public.resident_passport_stamps s WHERE s.profile_id = p_profile_id),
      combo_points = rm.legacy_combo_points + COALESCE((SELECT sum(se.points) FROM public.resident_score_events se WHERE se.profile_id = p_profile_id AND se.category = 'combo'), 0)::integer,
      combos_completed = rm.legacy_combos_completed + (SELECT count(*)::integer FROM public.resident_achievements ach WHERE ach.profile_id = p_profile_id AND ach.achievement_key LIKE 'combo:%'),
      patronage_points = rm.legacy_patronage_points,
      proteges_count = rm.legacy_proteges_count,
      tours_count = rm.legacy_tours_count + (SELECT count(*)::integer FROM public.resident_activities a WHERE a.profile_id = p_profile_id AND a.activity_type = 'tour'),
      completed_activities = (SELECT count(*)::integer FROM public.resident_activities a WHERE a.profile_id = p_profile_id),
      achievements_count = (SELECT count(*)::integer FROM public.resident_achievements a WHERE a.profile_id = p_profile_id),
      updated_at = now()
  WHERE rm.profile_id = p_profile_id
  RETURNING total_points INTO v_total;

  SELECT rm.tour_points, rm.event_points, rm.stamp_points, rm.stamps_count,
         rm.destinations_count, rm.achievements_count, rm.completed_activities
  INTO v_tours, v_events, v_stamps, v_stamp_count, v_destinations, v_achievements, v_activity_count
  FROM public.resident_metrics rm WHERE rm.profile_id = p_profile_id;

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
    v_circle := CASE v_level
      WHEN 6 THEN 'black'
      WHEN 5 THEN 'private'
      WHEN 4 THEN 'inner'
      WHEN 3 THEN 'preferred'
      WHEN 2 THEN 'resident'
      ELSE 'voyager'
    END;
  END IF;

  -- Only this server-owned calculation may update cached influence/level fields.
  PERFORM set_config('voyage.gamification_internal', 'on', true);
  UPDATE public.profiles
  SET influence_index = GREATEST(COALESCE(v_total, 0), 0),
      level = v_level,
      circle = COALESCE(v_circle, 'voyager')
  WHERE id = p_profile_id AND role = 'resident';
  PERFORM set_config('voyage.gamification_internal', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.resident_award_achievement(
  p_profile_id uuid,
  p_key text,
  p_title text,
  p_activity_id uuid,
  p_rule_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_points integer;
BEGIN
  IF p_profile_id IS NULL OR p_key IS NULL THEN RETURN; END IF;

  SELECT round(r.value)::integer INTO v_points
  FROM public.resident_scoring_rules r WHERE r.key = p_rule_key;
  v_points := GREATEST(COALESCE(v_points, 0), 0);

  INSERT INTO public.resident_achievements(profile_id, achievement_key, title, activity_id, points_awarded)
  VALUES (p_profile_id, p_key, p_title, p_activity_id, v_points)
  ON CONFLICT (profile_id, achievement_key) DO NOTHING;

  IF FOUND AND v_points > 0 THEN
    INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata)
    VALUES (
      p_profile_id, p_activity_id, 'achievement:' || p_profile_id::text || ':' || p_key,
      'achievement', v_points, p_title,
      jsonb_build_object('achievement_key', p_key)
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resident_process_activity(p_activity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    INSERT INTO public.resident_passport_stamps(profile_id, country_code, country_title, activity_id, points_awarded)
    VALUES (a.profile_id, v_country, v_country_title, a.id, GREATEST(COALESCE(v_stamp_bonus,25),0))
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_stamp_id;

    IF v_stamp_id IS NOT NULL THEN
      IF COALESCE(v_stamp_bonus,25) > 0 THEN
        INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
        VALUES (a.profile_id, a.id, 'stamp:' || a.profile_id::text || ':' || v_country,
                'stamp', COALESCE(v_stamp_bonus,25), 'First completed visit to ' || v_country,
                jsonb_build_object('country_code', v_country), a.completed_by)
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
          INSERT INTO public.resident_achievements(profile_id, achievement_key, title, activity_id, points_awarded)
          VALUES (a.profile_id, 'combo:' || v_combo.id, COALESCE(v_combo.title, 'Legendary Combo'), a.id, v_combo.bonus)
          ON CONFLICT (profile_id, achievement_key) DO NOTHING;

          IF FOUND AND v_combo.bonus > 0 THEN
            INSERT INTO public.resident_score_events(profile_id, activity_id, event_key, category, points, reason, metadata, created_by)
            VALUES (
              a.profile_id, a.id, 'combo:' || a.profile_id::text || ':' || v_combo.id,
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
$$;

-- Completion is one-way. Values are frozen once completed.
CREATE OR REPLACE FUNCTION public.resident_guard_completion_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'Completed activity status is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'completed' AND (
      NEW.completed_at IS DISTINCT FROM OLD.completed_at OR
      NEW.completed_by IS DISTINCT FROM OLD.completed_by OR
      NEW.completion_value IS DISTINCT FROM OLD.completion_value OR
      NEW.complexity_score IS DISTINCT FROM OLD.complexity_score OR
      NEW.completion_country_code IS DISTINCT FROM OLD.completion_country_code
    ) THEN
      RAISE EXCEPTION 'Completion scoring inputs are immutable after completion' USING ERRCODE = '23514';
    END IF;
    IF OLD.status IS DISTINCT FROM 'completed' AND (
      NEW.completed_at IS DISTINCT FROM OLD.completed_at OR
      NEW.completed_by IS DISTINCT FROM OLD.completed_by
    ) AND NOT (NEW.status = 'completed' AND OLD.status = 'approved') THEN
      RAISE EXCEPTION 'Completion metadata is server-managed' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND OLD.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Only an approved application can be completed' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    RAISE EXCEPTION 'An application cannot be inserted as completed' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
    NEW.completion_country_code := NULLIF(upper(btrim(NEW.completion_country_code)), '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resident_handle_completed_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id uuid;
  v_reliability numeric(5,2);
  v_code text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT COALESCE(p.reliability, 100) INTO v_reliability
  FROM public.profiles p WHERE p.id = NEW.user_id;

  INSERT INTO public.resident_activities(
    profile_id, activity_type, source_application_id, source_label, destination_code,
    commercial_value, complexity_score, reliability_snapshot, completed_by, completed_at
  ) VALUES (
    NEW.user_id, 'tour', NEW.id, NEW.hub_id, upper(NULLIF(btrim(NEW.completion_country_code), '')),
    NEW.completion_value, NEW.complexity_score, COALESCE(v_reliability,100), NEW.completed_by, COALESCE(NEW.completed_at, now())
  )
  ON CONFLICT (source_application_id) DO NOTHING
  RETURNING id INTO v_activity_id;

  IF v_activity_id IS NOT NULL THEN PERFORM public.resident_process_activity(v_activity_id); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resident_handle_completed_event_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id uuid;
  v_reliability numeric(5,2);
  v_title text;
  v_event_code text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT COALESCE(p.reliability,100) INTO v_reliability
  FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT e.title, e.country_code INTO v_title, v_event_code
  FROM public.global_events e WHERE e.id = NEW.event_id;

  INSERT INTO public.resident_activities(
    profile_id, activity_type, source_event_application_id, source_label, destination_code,
    commercial_value, complexity_score, reliability_snapshot, completed_by, completed_at
  ) VALUES (
    NEW.user_id, 'event', NEW.id, COALESCE(v_title, 'Club event'),
    upper(NULLIF(btrim(COALESCE(NEW.completion_country_code, v_event_code)), '')),
    NEW.completion_value, NEW.complexity_score, COALESCE(v_reliability,100), NEW.completed_by, COALESCE(NEW.completed_at, now())
  )
  ON CONFLICT (source_event_application_id) DO NOTHING
  RETURNING id INTO v_activity_id;

  IF v_activity_id IS NOT NULL THEN PERFORM public.resident_process_activity(v_activity_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resident_guard_completion_applications ON public.applications;
CREATE TRIGGER resident_guard_completion_applications
BEFORE INSERT OR UPDATE OF status, completion_value, complexity_score, completion_country_code, completed_at, completed_by
ON public.applications FOR EACH ROW EXECUTE FUNCTION public.resident_guard_completion_fields();

DROP TRIGGER IF EXISTS resident_guard_completion_event_applications ON public.event_applications;
CREATE TRIGGER resident_guard_completion_event_applications
BEFORE INSERT OR UPDATE OF status, completion_value, complexity_score, completion_country_code, completed_at, completed_by
ON public.event_applications FOR EACH ROW EXECUTE FUNCTION public.resident_guard_completion_fields();

DROP TRIGGER IF EXISTS resident_process_completed_application ON public.applications;
CREATE TRIGGER resident_process_completed_application
AFTER UPDATE OF status ON public.applications
FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION public.resident_handle_completed_application();

DROP TRIGGER IF EXISTS resident_process_completed_event_application ON public.event_applications;
CREATE TRIGGER resident_process_completed_event_application
AFTER UPDATE OF status ON public.event_applications
FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION public.resident_handle_completed_event_application();

-- ---------------------------------------------------------------------
-- 4. Enforce segmentation in RLS, not only in the rendered menu.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS admin_full_access ON public.game_attendance;

-- Residents may not self-promote, self-assign levels, alter reliability, or edit
-- cached scores. The ledger refresh is the only writer for cached level fields.
CREATE OR REPLACE FUNCTION public.voyage_guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.voyage_is_staff() THEN
      NEW.role := 'resident';
      NEW.kyc_level := 0;
      NEW.achievements := '{}';
      NEW.status := NULL;
      NEW.usdt_wallet := NULL;
      NEW.segment := 'working';
      NEW.level := 1;
      NEW.reliability := 100;
      NEW.influence_index := 0;
      NEW.circle := 'voyager';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.voyage_is_founder() THEN
    RAISE EXCEPTION 'Voyage: role can only be changed by the founder' USING ERRCODE = '42501';
  END IF;

  IF NEW.segment IS DISTINCT FROM OLD.segment AND NOT public.club_is_admin() THEN
    RAISE EXCEPTION 'Voyage: only owner/admin can change resident segment' USING ERRCODE = '42501';
  END IF;

  IF current_setting('voyage.gamification_internal', true) IS DISTINCT FROM 'on'
     AND (
       NEW.level IS DISTINCT FROM OLD.level
       OR NEW.influence_index IS DISTINCT FROM OLD.influence_index
       OR NEW.circle IS DISTINCT FROM OLD.circle
     ) THEN
    RAISE EXCEPTION 'Voyage: level and influence are computed by the server' USING ERRCODE = '42501';
  END IF;

  IF NEW.reliability IS DISTINCT FROM OLD.reliability AND NOT public.club_is_admin() THEN
    RAISE EXCEPTION 'Voyage: only owner/admin can change reliability' USING ERRCODE = '42501';
  END IF;

  IF NOT public.voyage_is_staff() AND (
       NEW.kyc_level IS DISTINCT FROM OLD.kyc_level
    OR NEW.achievements IS DISTINCT FROM OLD.achievements
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.usdt_wallet IS DISTINCT FROM OLD.usdt_wallet
  ) THEN
    RAISE EXCEPTION 'Voyage: verification, awards, status and wallet are managed by club staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON TABLE public.v_global_leaderboard FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.v_global_leaderboard TO authenticated;

DROP POLICY IF EXISTS tours_select ON public.tours;
CREATE POLICY tours_select ON public.tours FOR SELECT TO authenticated
USING (
  (public.is_admin())
  OR (public.is_manager() AND deleted_at IS NULL AND public.manages_location(location_id))
  OR (
    deleted_at IS NULL
    AND visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'resident' AND p.segment = 'working'
        AND COALESCE(p.status, 'approved') = 'approved'
    )
  )
  OR (
    deleted_at IS NULL
    AND visibility = 'members'
    AND public.is_approved_member()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'resident' AND p.segment = 'working'
        AND COALESCE(p.status, 'approved') = 'approved'
    )
  )
);

-- Elite residents may not submit new applications for ordinary tours even
-- if they call the table API directly instead of using the menu.
DROP POLICY IF EXISTS applications_resident_insert_own ON public.applications;
CREATE POLICY applications_resident_insert_own ON public.applications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'resident' AND p.segment = 'working'
  )
);

DROP POLICY IF EXISTS global_events_select_authenticated ON public.global_events;
CREATE POLICY global_events_select_authenticated ON public.global_events FOR SELECT TO authenticated
USING (
  public.is_voyage_admin()
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (global_events.audience_segment = 'all' OR global_events.audience_segment = p.segment)
    )
  )
);

CREATE OR REPLACE FUNCTION public.can_apply_to_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.global_events e
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE e.id = p_event_id
      AND e.is_active = true
      AND (e.audience_segment = 'all' OR e.audience_segment = p.segment)
      AND p.role = 'resident'
      AND (p.segment = 'elite' OR COALESCE(p.level,1) >= 3)
      AND COALESCE(p.status, 'approved') = 'approved'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.event_applications a
    WHERE a.user_id = auth.uid()
      AND a.event_id = p_event_id
      AND a.status = 'rejected'
      AND a.updated_at > now() - interval '1 month'
  );
$$;

-- Only authorized staff can update scoring configuration.
ALTER TABLE public.resident_scoring_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resident_scoring_rules_admin_read ON public.resident_scoring_rules;
CREATE POLICY resident_scoring_rules_admin_read ON public.resident_scoring_rules
FOR SELECT TO authenticated USING (public.is_voyage_admin());
DROP POLICY IF EXISTS resident_scoring_rules_admin_update ON public.resident_scoring_rules;
CREATE POLICY resident_scoring_rules_admin_update ON public.resident_scoring_rules
FOR UPDATE TO authenticated USING (public.is_voyage_admin()) WITH CHECK (public.is_voyage_admin());
GRANT UPDATE ON public.resident_scoring_rules TO authenticated;

ALTER TABLE public.resident_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_passport_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resident_activities_read_own_or_staff ON public.resident_activities;
CREATE POLICY resident_activities_read_own_or_staff ON public.resident_activities
FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.game_is_staff());
DROP POLICY IF EXISTS resident_score_events_read_own_or_staff ON public.resident_score_events;
CREATE POLICY resident_score_events_read_own_or_staff ON public.resident_score_events
FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.game_is_staff());
DROP POLICY IF EXISTS resident_metrics_read_own_or_staff ON public.resident_metrics;
CREATE POLICY resident_metrics_read_own_or_staff ON public.resident_metrics
FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.game_is_staff());
DROP POLICY IF EXISTS resident_passport_stamps_read_own_or_staff ON public.resident_passport_stamps;
CREATE POLICY resident_passport_stamps_read_own_or_staff ON public.resident_passport_stamps
FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.game_is_staff());
DROP POLICY IF EXISTS resident_achievements_read_own_or_staff ON public.resident_achievements;
CREATE POLICY resident_achievements_read_own_or_staff ON public.resident_achievements
FOR SELECT TO authenticated USING (profile_id = auth.uid() OR public.game_is_staff());

REVOKE ALL ON public.resident_activities, public.resident_score_events, public.resident_metrics,
  public.resident_passport_stamps, public.resident_achievements, public.resident_scoring_rules FROM anon, PUBLIC;
GRANT SELECT ON public.resident_activities, public.resident_score_events, public.resident_metrics,
  public.resident_passport_stamps, public.resident_achievements, public.resident_scoring_rules TO authenticated;

REVOKE ALL ON FUNCTION public.resident_refresh_metrics(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resident_award_achievement(uuid,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resident_process_activity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resident_handle_completed_application() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resident_handle_completed_event_application() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resident_guard_completion_fields() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Seed old levels onto profiles, then expose current metrics via legacy view.
-- ---------------------------------------------------------------------
UPDATE public.profiles p
SET level = COALESCE(lb.level, 1)::smallint,
    circle = COALESCE(lb.circle_key, p.circle, 'voyager'),
    influence_index = COALESCE(lb.total_influence, p.influence_index, 0)
FROM public.resident_metrics rm
LEFT JOIN public.v_global_leaderboard lb ON lb.profile_id = rm.profile_id
WHERE p.id = rm.profile_id AND p.role = 'resident';

CREATE OR REPLACE VIEW public.v_global_leaderboard AS
WITH legacy AS (
  SELECT p.id AS profile_id, p.full_name, p.avatar_url,
         COALESCE(rm.stamp_points, COALESCE(b.stamp_points,0))::integer AS stamp_points,
         COALESCE(rm.combo_points, COALESCE(b.combo_points,0))::integer AS combo_points,
         COALESCE(rm.total_points, COALESCE(b.base_influence,0) + COALESCE(pt.patronage_points,0))::integer AS total_influence,
         COALESCE(rm.stamps_count, COALESCE(b.stamps_count,0))::integer AS stamps_count,
         COALESCE(rm.destinations_count, COALESCE(b.destinations_count,0))::integer AS destinations_count,
         COALESCE(rm.combos_completed, COALESCE(b.combos_completed,0))::integer AS combos_completed,
         COALESCE(rm.patronage_points, COALESCE(pt.patronage_points,0))::integer AS patronage_points,
         COALESCE(rm.proteges_count, COALESCE(pt.proteges_count,0))::integer AS proteges_count,
         COALESCE(rm.tour_points, COALESCE(b.tour_points,0))::integer AS tour_points,
         COALESCE(rm.tours_count, COALESCE(b.tours_count,0))::integer AS tours_count
  FROM public.profiles p
  LEFT JOIN public.resident_metrics rm ON rm.profile_id = p.id
  LEFT JOIN public.game_base_influence b ON b.profile_id = p.id
  LEFT JOIN (
    SELECT cip.patron_id AS profile_id,
           sum(cip.dividends)::integer AS patronage_points,
           count(*) FILTER (WHERE cip.status = 'approved')::integer AS proteges_count
    FROM public.club_invite_progress cip
    WHERE cip.patron_id IS NOT NULL
    GROUP BY cip.patron_id
  ) pt ON pt.profile_id = p.id
  WHERE p.role = 'resident'
)
SELECT l.profile_id,
       l.total_influence,
       COALESCE(cur.title, 'Voyager') AS rank_title,
       COALESCE(cur.level, 1)::integer AS level,
       COALESCE(cur.key, 'voyager') AS circle_key,
       nxt.min_influence AS next_level_at,
       l.stamp_points,
       l.combo_points,
       l.stamps_count,
       l.destinations_count,
       l.combos_completed,
       rank() OVER (ORDER BY l.total_influence DESC)::integer AS position,
       l.full_name,
       l.avatar_url,
       l.patronage_points,
       l.proteges_count,
       l.tour_points,
       l.tours_count
FROM legacy l
LEFT JOIN LATERAL (
  SELECT gc.level, gc.key, gc.title
  FROM public.game_circles gc
  WHERE gc.min_influence <= l.total_influence
  ORDER BY gc.min_influence DESC, gc.level DESC LIMIT 1
) cur ON true
LEFT JOIN LATERAL (
  SELECT gc.min_influence FROM public.game_circles gc
  WHERE gc.min_influence > l.total_influence
  ORDER BY gc.min_influence LIMIT 1
) nxt ON true;

CREATE OR REPLACE FUNCTION public.get_segmented_tour_leaderboard(
  p_segment text DEFAULT 'working',
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  "position" integer,
  full_name text,
  avatar_url text,
  tour_points integer,
  is_me boolean,
  profile_id uuid,
  circle_key text,
  circle_title text,
  influence integer,
  index_points integer,
  tour_id text,
  tour_title text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit,50),1),100);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'voyage:not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_segment NOT IN ('working','elite') THEN
    RAISE EXCEPTION 'invalid_segment' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT p.id, p.full_name, p.avatar_url,
           CASE WHEN p_segment = 'elite' THEN COALESCE(rm.event_points,0) ELSE COALESCE(rm.tour_points,0) END::integer AS points,
           COALESCE(rm.total_points,0)::integer AS influence_score,
           p.level::integer AS resident_level,
           row_number() OVER (ORDER BY CASE WHEN p_segment = 'elite' THEN COALESCE(rm.event_points,0) ELSE COALESCE(rm.tour_points,0) END DESC, p.full_name ASC NULLS LAST, p.id)::integer AS pos
    FROM public.profiles p
    LEFT JOIN public.resident_metrics rm ON rm.profile_id = p.id
    WHERE p.role = 'resident' AND p.segment = p_segment
  )
  SELECT r.pos, r.full_name, r.avatar_url, r.points, r.id = auth.uid(), r.id,
         COALESCE(gc.key, 'voyager'),
         COALESCE(gc.title, CASE r.resident_level
           WHEN 6 THEN 'Black Circle' WHEN 5 THEN 'Private Circle'
           WHEN 4 THEN 'Inner Circle' WHEN 3 THEN 'Preferred'
           WHEN 2 THEN 'Resident' ELSE 'Voyager' END),
         r.influence_score, r.points, NULL::text, NULL::text
  FROM ranked r
  LEFT JOIN public.game_circles gc ON gc.level = r.resident_level
  WHERE r.pos <= v_limit OR r.id = auth.uid()
  ORDER BY r.pos;
END;
$$;

REVOKE ALL ON FUNCTION public.get_segmented_tour_leaderboard(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_segmented_tour_leaderboard(text,integer) TO authenticated;

-- Update metrics and cached profile level once to establish a consistent snapshot.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.id FROM public.profiles p WHERE p.role = 'resident' LOOP
    PERFORM public.resident_refresh_metrics(r.id);
  END LOOP;
END $$;

COMMIT;
