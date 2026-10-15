-- VOYAGE Master Blueprint · Stage 3
-- Segmented leaderboard projection + resident ledger read access.
-- Idempotent: appends view columns, recreates the RPC result contract, and refreshes cached metrics.

BEGIN;

-- The legacy columns stay in the exact same order. New columns are appended so existing
-- callers selecting known columns keep working.
CREATE OR REPLACE VIEW public.v_global_leaderboard AS
WITH legacy AS (
  SELECT
    p.id AS profile_id,
    p.full_name,
    p.avatar_url,
    COALESCE(rm.stamp_points, COALESCE(b.stamp_points, 0)) AS stamp_points,
    COALESCE(rm.combo_points, COALESCE(b.combo_points, 0)) AS combo_points,
    COALESCE(rm.total_points, (COALESCE(b.base_influence, 0) + COALESCE(pt.patronage_points, 0))) AS total_influence,
    COALESCE(rm.stamps_count, COALESCE(b.stamps_count, 0)) AS stamps_count,
    COALESCE(rm.destinations_count, COALESCE(b.destinations_count, 0)) AS destinations_count,
    COALESCE(rm.combos_completed, COALESCE(b.combos_completed, 0)) AS combos_completed,
    COALESCE(rm.patronage_points, COALESCE(pt.patronage_points, 0)) AS patronage_points,
    COALESCE(rm.proteges_count, COALESCE(pt.proteges_count, 0)) AS proteges_count,
    COALESCE(rm.tour_points, COALESCE(b.tour_points, 0)) AS tour_points,
    COALESCE(rm.tours_count, COALESCE(b.tours_count, 0)) AS tours_count,
    COALESCE(p.segment, 'working')::text AS segment,
    COALESCE(p.reliability, 100)::numeric(5,2) AS reliability,
    COALESCE(p.level, 1)::smallint AS profile_level,
    COALESCE(NULLIF(p.circle, ''), 'voyager')::text AS profile_circle
  FROM public.profiles p
  LEFT JOIN public.resident_metrics rm ON rm.profile_id = p.id
  LEFT JOIN public.game_base_influence b ON b.profile_id = p.id
  LEFT JOIN (
    SELECT
      cip.patron_id AS profile_id,
      sum(cip.dividends)::integer AS patronage_points,
      count(*) FILTER (WHERE cip.status = 'approved')::integer AS proteges_count
    FROM public.club_invite_progress cip
    WHERE cip.patron_id IS NOT NULL
    GROUP BY cip.patron_id
  ) pt ON pt.profile_id = p.id
  WHERE p.role = 'resident'::public.app_role
)
SELECT
  l.profile_id,
  l.total_influence,
  COALESCE(cur.title, 'Voyager') AS rank_title,
  COALESCE(cur.level, 1) AS level,
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
  l.tours_count,
  l.segment,
  l.reliability,
  l.profile_level,
  l.profile_circle,
  rank() OVER (PARTITION BY l.segment ORDER BY l.total_influence DESC)::integer AS segment_position
FROM legacy l
LEFT JOIN LATERAL (
  SELECT gc.level, gc.key, gc.title
  FROM public.game_circles gc
  WHERE gc.min_influence <= l.total_influence
  ORDER BY gc.min_influence DESC, gc.level DESC
  LIMIT 1
) cur ON true
LEFT JOIN LATERAL (
  SELECT gc.min_influence
  FROM public.game_circles gc
  WHERE gc.min_influence > l.total_influence
  ORDER BY gc.min_influence
  LIMIT 1
) nxt ON true;

ALTER VIEW public.v_global_leaderboard OWNER TO postgres;
GRANT SELECT ON public.v_global_leaderboard TO authenticated;
GRANT SELECT ON public.v_global_leaderboard TO service_role;

-- The return type must be dropped/recreated because PostgreSQL does not permit changing
-- a TABLE-returning function's OUT columns with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.get_segmented_tour_leaderboard(text, integer);
CREATE FUNCTION public.get_segmented_tour_leaderboard(
  p_segment text DEFAULT 'working',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  "position" integer,
  full_name text,
  avatar_url text,
  tour_points integer,
  is_me boolean,
  profile_id uuid,
  segment text,
  level integer,
  circle_key text,
  circle_title text,
  reliability numeric,
  influence integer,
  influence_index integer,
  index_points integer,
  tour_id text,
  tour_title text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_segment text := lower(COALESCE(NULLIF(btrim(p_segment), ''), 'working'));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'voyage:not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_segment NOT IN ('working', 'elite') THEN
    RAISE EXCEPTION 'invalid_segment' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      p.id,
      p.full_name,
      p.avatar_url,
      p.segment::text AS resident_segment,
      p.level::integer AS resident_level,
      COALESCE(NULLIF(p.circle, ''), 'voyager')::text AS resident_circle,
      COALESCE(p.reliability, 100)::numeric(5,2) AS resident_reliability,
      CASE WHEN v_segment = 'elite'
        THEN COALESCE(rm.event_points, 0)
        ELSE COALESCE(rm.tour_points, 0)
      END::integer AS segment_points,
      GREATEST(COALESCE(rm.total_points, p.influence_index, 0), 0)::integer AS influence_score,
      row_number() OVER (
        ORDER BY
          CASE WHEN v_segment = 'elite' THEN COALESCE(rm.event_points, 0) ELSE COALESCE(rm.tour_points, 0) END DESC,
          p.full_name ASC NULLS LAST,
          p.id
      )::integer AS pos
    FROM public.profiles p
    LEFT JOIN public.resident_metrics rm ON rm.profile_id = p.id
    WHERE p.role = 'resident'::public.app_role
      AND p.segment = v_segment
  )
  SELECT
    r.pos,
    r.full_name,
    r.avatar_url,
    r.segment_points,
    r.id = auth.uid(),
    r.id,
    r.resident_segment,
    r.resident_level,
    COALESCE(gc.key, r.resident_circle, 'voyager'),
    COALESCE(gc.title, CASE r.resident_level
      WHEN 6 THEN 'Black Circle'
      WHEN 5 THEN 'Private Circle'
      WHEN 4 THEN 'Inner Circle'
      WHEN 3 THEN 'Preferred'
      WHEN 2 THEN 'Resident'
      ELSE 'Voyager'
    END),
    r.resident_reliability,
    r.influence_score,
    r.influence_score,
    r.segment_points,
    NULL::text,
    NULL::text
  FROM ranked r
  LEFT JOIN public.game_circles gc ON gc.level = r.resident_level
  WHERE r.pos <= v_limit OR r.id = auth.uid()
  ORDER BY r.pos;
END;
$function$;

ALTER FUNCTION public.get_segmented_tour_leaderboard(text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_segmented_tour_leaderboard(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_segmented_tour_leaderboard(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_segmented_tour_leaderboard(text, integer) TO service_role;

-- Existing dump policies already allow each resident to read their own rows and staff to read all.
-- Ensure those select policies and grants exist after this migration without duplicating policies.
DO $policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'resident_metrics'
      AND policyname = 'resident_metrics_read_own_or_staff'
  ) THEN
    CREATE POLICY resident_metrics_read_own_or_staff ON public.resident_metrics
      FOR SELECT TO authenticated
      USING (profile_id = auth.uid() OR public.game_is_staff());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'resident_score_events'
      AND policyname = 'resident_score_events_read_own_or_staff'
  ) THEN
    CREATE POLICY resident_score_events_read_own_or_staff ON public.resident_score_events
      FOR SELECT TO authenticated
      USING (profile_id = auth.uid() OR public.game_is_staff());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'resident_passport_stamps'
      AND policyname = 'resident_passport_stamps_read_own_or_staff'
  ) THEN
    CREATE POLICY resident_passport_stamps_read_own_or_staff ON public.resident_passport_stamps
      FOR SELECT TO authenticated
      USING (profile_id = auth.uid() OR public.game_is_staff());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'resident_achievements'
      AND policyname = 'resident_achievements_read_own_or_staff'
  ) THEN
    CREATE POLICY resident_achievements_read_own_or_staff ON public.resident_achievements
      FOR SELECT TO authenticated
      USING (profile_id = auth.uid() OR public.game_is_staff());
  END IF;
END;
$policies$;

GRANT SELECT ON public.resident_metrics TO authenticated;
GRANT SELECT ON public.resident_score_events TO authenticated;
GRANT SELECT ON public.resident_passport_stamps TO authenticated;
GRANT SELECT ON public.resident_achievements TO authenticated;

-- Synchronize cached profile fields from the canonical server-side ledger snapshot.
DO $refresh$
DECLARE
  resident_row record;
BEGIN
  FOR resident_row IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = 'resident'::public.app_role
  LOOP
    PERFORM public.resident_refresh_metrics(resident_row.id);
  END LOOP;
END;
$refresh$;

NOTIFY pgrst, 'reload schema';
COMMIT;
