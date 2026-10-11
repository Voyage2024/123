-- VOYAGE Concierge serverless webhook runtime.
-- Apply after 20261011090000_telegram_concierge.sql and the existing access-control migrations.
BEGIN;

-- These columns existed in the planned access-control/gamification model. Keep this migration
-- safe for installations where some of them are not yet present.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS ban_permanent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_language text NOT NULL DEFAULT 'RU',
  ADD COLUMN IF NOT EXISTS credential_issue_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_level_range_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_level_range_check CHECK (level BETWEEN 1 AND 6) NOT VALID;
  END IF;
END $$;
UPDATE public.profiles SET level = 1 WHERE level IS NULL OR level NOT BETWEEN 1 AND 6;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_level_range_check;

-- Conversation state is persisted in Postgres; no in-memory conversation state is required
-- between serverless invocations.
CREATE TABLE IF NOT EXISTS public.telegram_conversations (
  telegram_id text PRIMARY KEY CHECK (telegram_id ~ '^[0-9]{4,20}$'),
  telegram_username text,
  telegram_language text NOT NULL DEFAULT 'RU' CHECK (telegram_language IN ('EN', 'RU', 'ES', 'PT')),
  stage text NOT NULL CHECK (stage IN ('email', 'full_name', 'birth_date', 'location', 'measurements', 'photos', 'submitting')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object'),
  photo_urls text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours')
);
CREATE INDEX IF NOT EXISTS telegram_conversations_expiry_idx
  ON public.telegram_conversations (expires_at);

CREATE TABLE IF NOT EXISTS public.telegram_preferences (
  telegram_id text PRIMARY KEY CHECK (telegram_id ~ '^[0-9]{4,20}$'),
  language text NOT NULL DEFAULT 'RU' CHECK (language IN ('EN', 'RU', 'ES', 'PT')),
  telegram_username text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Persist webhook receipts so Telegram retries do not run the same update twice.
CREATE TABLE IF NOT EXISTS public.telegram_webhook_updates (
  update_id bigint PRIMARY KEY CHECK (update_id >= 0),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'failed')),
  lease_until timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_webhook_updates_created_idx
  ON public.telegram_webhook_updates (created_at);

ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_webhook_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_conversations, public.telegram_preferences, public.telegram_webhook_updates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_webhook_updates TO service_role;

CREATE OR REPLACE FUNCTION public.voyage_claim_telegram_webhook_update(p_update_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer;
  v_status text;
  v_lease_until timestamptz;
BEGIN
  IF p_update_id IS NULL OR p_update_id < 0 THEN
    RAISE EXCEPTION 'invalid_telegram_update_id' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.telegram_webhook_updates(update_id, status, lease_until, attempts)
  VALUES (p_update_id, 'processing', now() + interval '2 minutes', 1)
  ON CONFLICT (update_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted > 0 THEN RETURN 'claimed'; END IF;

  SELECT status, lease_until
    INTO v_status, v_lease_until
  FROM public.telegram_webhook_updates
  WHERE update_id = p_update_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'unavailable'; END IF;
  IF v_status = 'done' THEN RETURN 'done'; END IF;
  IF v_status = 'processing' AND v_lease_until > now() THEN RETURN 'busy'; END IF;

  UPDATE public.telegram_webhook_updates
  SET status = 'processing',
      lease_until = now() + interval '2 minutes',
      attempts = attempts + 1,
      last_error = NULL,
      updated_at = now()
  WHERE update_id = p_update_id;
  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.voyage_finish_telegram_webhook_update(
  p_update_id bigint,
  p_status text,
  p_error_code text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_status NOT IN ('done', 'failed') THEN
    RAISE EXCEPTION 'invalid_telegram_webhook_status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.telegram_webhook_updates
  SET status = p_status,
      last_error = CASE WHEN p_status = 'failed' THEN left(coalesce(p_error_code, 'processing_failed'), 80) ELSE NULL END,
      lease_until = CASE WHEN p_status = 'done' THEN now() ELSE now() - interval '1 second' END,
      updated_at = now()
  WHERE update_id = p_update_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'telegram_webhook_receipt_not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.voyage_claim_telegram_webhook_update(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voyage_finish_telegram_webhook_update(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voyage_claim_telegram_webhook_update(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.voyage_finish_telegram_webhook_update(bigint, text, text) TO service_role;

COMMENT ON TABLE public.telegram_conversations IS 'Persistent serverless Telegram onboarding state; payload is private to service_role.';
COMMENT ON TABLE public.telegram_preferences IS 'Persistent language preferences for VOYAGE Concierge.';
COMMENT ON TABLE public.telegram_webhook_updates IS 'Idempotency/lease ledger for Telegram webhook update processing.';

COMMIT;
