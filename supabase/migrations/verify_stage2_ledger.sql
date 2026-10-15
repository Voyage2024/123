-- Run after 20261015_voyage_stage2_ledger_engine.sql.
-- Every query should return zero rows for the first four checks, and the last query should show installed triggers.

-- 1. Attendance rows that should have an award but do not have a ledger event.
SELECT ga.profile_id, ga.id AS attendance_id, ga.destination_id
FROM public.game_attendance ga
JOIN public.game_destinations gd ON gd.id = ga.destination_id
LEFT JOIN public.resident_score_events se
  ON se.event_key = 'game-attendance:' || ga.id::text
WHERE GREATEST(0, round(
        COALESCE(ga.points, gd.points)::numeric
        * COALESCE(ga.multiplier, gd.multiplier)
        * public.game_visit_factor(ga.visit_number)
      ))::integer > 0
  AND se.id IS NULL;

-- 2. Completed tours without a normalized activity record.
SELECT a.id AS application_id, a.user_id AS profile_id, a.completed_at
FROM public.applications a
LEFT JOIN public.resident_activities ra ON ra.source_application_id = a.id
WHERE a.status = 'completed' AND ra.id IS NULL;

-- 3. Completed event applications without a normalized activity record.
SELECT ea.id AS event_application_id, ea.user_id AS profile_id, ea.completed_at
FROM public.event_applications ea
LEFT JOIN public.resident_activities ra ON ra.source_event_application_id = ea.id
WHERE ea.status = 'completed' AND ra.id IS NULL;

-- 4. Attendance with an ISO-2 destination country that has no passport record.
WITH attendance_countries AS (
  SELECT DISTINCT ga.profile_id,
         upper(COALESCE(NULLIF(gd.country_code, ''), CASE WHEN gd.code ~* '^[A-Z]{2}$' THEN gd.code END)) AS country_code
  FROM public.game_attendance ga
  JOIN public.game_destinations gd ON gd.id = ga.destination_id
)
SELECT ac.profile_id, ac.country_code
FROM attendance_countries ac
LEFT JOIN public.resident_passport_stamps s
  ON s.profile_id = ac.profile_id AND s.country_code = ac.country_code
WHERE ac.country_code ~ '^[A-Z]{2}$' AND s.id IS NULL;

-- 5. Profile influence cache mismatches.
SELECT p.id AS profile_id, p.influence_index, rm.total_points
FROM public.profiles p
JOIN public.resident_metrics rm ON rm.profile_id = p.id
WHERE p.role = 'resident'
  AND p.influence_index IS DISTINCT FROM GREATEST(rm.total_points, 0);

-- 6. Trigger inventory for the repaired paths.
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'resident_process_game_attendance',
    'resident_passport_stamp_score',
    'resident_achievement_score',
    'resident_score_event_adjustment_refresh',
    'resident_process_completed_application',
    'resident_process_completed_event_application',
    'resident_score_events_immutable'
  )
ORDER BY event_object_table, trigger_name;
