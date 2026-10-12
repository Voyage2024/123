-- VOYAGE join form hardening: separate contacts, server-verified Turnstile,
-- atomic IP fingerprint rate limiting, and no direct anonymous table inserts.

BEGIN;

ALTER TABLE public.guest_applications
  ADD COLUMN IF NOT EXISTS telegram text,
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- The field is already nullable in the current schema; keep this migration safe
-- for deployments whose older schema accidentally made it NOT NULL.
ALTER TABLE public.guest_applications
  ALTER COLUMN portfolio_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS guest_applications_telegram_idx
  ON public.guest_applications (lower(telegram))
  WHERE telegram IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_applications_telegram_length_chk'
  ) THEN
    ALTER TABLE public.guest_applications
      ADD CONSTRAINT guest_applications_telegram_length_chk
      CHECK (telegram IS NULL OR char_length(btrim(telegram)) BETWEEN 5 AND 120) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guest_applications_whatsapp_length_chk'
  ) THEN
    ALTER TABLE public.guest_applications
      ADD CONSTRAINT guest_applications_whatsapp_length_chk
      CHECK (whatsapp IS NULL OR char_length(btrim(whatsapp)) BETWEEN 7 AND 32) NOT VALID;
  END IF;
END $$;

-- Application-level inserts must go through the Server Action, which validates
-- Turnstile and consumes the rate limit before it uses the service-role client.
-- Keeping a public INSERT policy would let clients bypass the CAPTCHA entirely.
DROP POLICY IF EXISTS guest_applications_insert ON public.guest_applications;
REVOKE INSERT ON TABLE public.guest_applications FROM PUBLIC, anon, authenticated;
REVOKE INSERT (full_name, contact, instagram, portfolio_url, about, consent, lang)
  ON TABLE public.guest_applications FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.guest_applications TO service_role;

CREATE TABLE IF NOT EXISTS public.guest_application_rate_limits (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_application_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guest_application_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_application_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_guest_application_rate_limit(
  p_fingerprint text,
  p_max_requests integer DEFAULT 5,
  p_window_seconds integer DEFAULT 3600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_max_requests < 1 OR p_max_requests > 20
     OR p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid guest application rate-limit parameters'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.guest_application_rate_limits AS current_limit
    (fingerprint, window_started_at, request_count, updated_at)
  VALUES (p_fingerprint, now(), 1, now())
  ON CONFLICT (fingerprint) DO UPDATE
    SET request_count = CASE
          WHEN current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN 1
          ELSE current_limit.request_count + 1
        END,
        window_started_at = CASE
          WHEN current_limit.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN now()
          ELSE current_limit.window_started_at
        END,
        updated_at = now()
  RETURNING request_count INTO v_count;

  -- Opportunistic cleanup; the HMAC fingerprints are not raw IP addresses.
  IF mod(abs(hashtext(p_fingerprint)::bigint), 32) = 0 THEN
    DELETE FROM public.guest_application_rate_limits
      WHERE updated_at < now() - interval '7 days';
  END IF;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_guest_application_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_application_rate_limit(text, integer, integer)
  TO service_role;

COMMIT;
