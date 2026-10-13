-- VOYAGE: Telegram-only registration/referrals and persistent Concierge conversation history.
-- Built against the 2026-10-13 PostgreSQL dump: profiles, club_invites,
-- telegram_conversations and partner_concierge_requests already exist.

BEGIN;

-- 1. Persist referral attribution across the serverless Telegram onboarding flow.
ALTER TABLE public.telegram_conversations
  ADD COLUMN IF NOT EXISTS referral_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'telegram_conversations_referral_code_check'
      AND conrelid = 'public.telegram_conversations'::regclass
  ) THEN
    ALTER TABLE public.telegram_conversations
      ADD CONSTRAINT telegram_conversations_referral_code_check
      CHECK (referral_code IS NULL OR referral_code ~ '^VYG-[A-Z0-9]{4}-[A-Z0-9]{4}$') NOT VALID;
  END IF;
END $$;

-- Service-role-only redemption for Telegram onboarding. The existing
-- club_redeem_invite(text,text) expects auth.uid() and remains unchanged for web sessions.
CREATE OR REPLACE FUNCTION public.club_redeem_invite_from_telegram(
  p_code text,
  p_guest_profile_id uuid,
  p_telegram_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.club_invites%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_code text := upper(btrim(coalesce(p_code, '')));
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_code !~ '^VYG-[A-Z0-9]{4}-[A-Z0-9]{4}$'
     OR p_guest_profile_id IS NULL
     OR p_telegram_id IS NULL
     OR p_telegram_id !~ '^[0-9]{4,20}$' THEN
    RAISE EXCEPTION 'voyage:invalid_invite_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_guest_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:profile_missing' USING ERRCODE = 'P0002';
  END IF;
  IF v_profile.role::text <> 'resident'
     OR v_profile.status IS DISTINCT FROM 'pending'
     OR v_profile.telegram_id IS DISTINCT FROM p_telegram_id THEN
    RAISE EXCEPTION 'voyage:telegram_profile_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite
  FROM public.club_invites
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'voyage:not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_invite.patron_id = p_guest_profile_id THEN
    RAISE EXCEPTION 'voyage:self_invite' USING ERRCODE = '22023';
  END IF;
  IF v_invite.status = 'sealed' AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'voyage:key_expired' USING ERRCODE = '22023';
  END IF;
  IF v_invite.status <> 'sealed' THEN
    RAISE EXCEPTION 'voyage:key_used' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.club_invites
    WHERE guest_id = p_guest_profile_id
      AND status IN ('pending', 'approved', 'burned')
  ) THEN
    RAISE EXCEPTION 'voyage:already_linked' USING ERRCODE = '23505';
  END IF;

  UPDATE public.club_invites
  SET guest_id = p_guest_profile_id,
      status = 'pending',
      redeemed_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  UPDATE public.profiles
  SET invited_by = v_invite.patron_id,
      registration_source = 'referral',
      source_metadata = coalesce(source_metadata, '{}'::jsonb) || jsonb_build_object(
        'referral_code', v_invite.code,
        'referrer_profile_id', v_invite.patron_id,
        'referral_channel', 'telegram'
      ),
      updated_at = now()
  WHERE id = p_guest_profile_id;

  RETURN v_invite.id;
END;
$$;

REVOKE ALL ON FUNCTION public.club_redeem_invite_from_telegram(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_redeem_invite_from_telegram(text, uuid, text)
  TO service_role;

-- 2. Conversation table for existing Concierge requests.
CREATE TABLE IF NOT EXISTS public.partner_concierge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.partner_concierge_requests(id) ON DELETE CASCADE,
  sender_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('resident', 'staff', 'system')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_concierge_messages_request_created_idx
  ON public.partner_concierge_messages (request_id, created_at ASC);

ALTER TABLE public.partner_concierge_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partner_concierge_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.partner_concierge_messages TO authenticated;
GRANT ALL ON TABLE public.partner_concierge_messages TO service_role;

DROP POLICY IF EXISTS partner_concierge_messages_read_related ON public.partner_concierge_messages;
CREATE POLICY partner_concierge_messages_read_related
  ON public.partner_concierge_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partner_concierge_requests r
      WHERE r.id = partner_concierge_messages.request_id
        AND (
          r.resident_id = public.voyage_current_profile_id()
          OR public.game_is_staff()
        )
    )
  );

-- Preserve existing admin_feedback as the first historical response in the new thread.
INSERT INTO public.partner_concierge_messages
  (request_id, sender_profile_id, sender_role, body, created_at)
SELECT r.id, r.resolved_by, 'staff', btrim(r.admin_feedback), coalesce(r.resolved_at, r.updated_at, r.created_at)
FROM public.partner_concierge_requests r
WHERE nullif(btrim(r.admin_feedback), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.partner_concierge_messages m
    WHERE m.request_id = r.id
      AND m.sender_role = 'staff'
      AND m.body = btrim(r.admin_feedback)
  );

-- A guarded RPC makes the message insert and ticket-status change atomic.
-- The caller is still checked against public.profiles, despite using service_role.
CREATE OR REPLACE FUNCTION public.voyage_concierge_reply(
  p_request_id uuid,
  p_sender_profile_id uuid,
  p_body text,
  p_status text DEFAULT 'in_progress'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_role text;
  v_resident_id uuid;
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_closed boolean := coalesce(p_status, '') IN ('done', 'impossible');
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_sender_profile_id IS NULL
     OR char_length(v_body) < 1 OR char_length(v_body) > 4000
     OR coalesce(p_status, '') NOT IN ('open', 'in_progress', 'done', 'impossible') THEN
    RAISE EXCEPTION 'invalid concierge reply arguments' USING ERRCODE = '22023';
  END IF;

  SELECT role::text INTO v_actor_role
  FROM public.profiles
  WHERE id = p_sender_profile_id;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('manager', 'admin', 'owner') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT resident_id INTO v_resident_id
  FROM public.partner_concierge_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'concierge request not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.partner_concierge_messages
    (request_id, sender_profile_id, sender_role, body)
  VALUES (p_request_id, p_sender_profile_id, 'staff', v_body)
  RETURNING id INTO v_message_id;

  UPDATE public.partner_concierge_requests
  SET status = p_status,
      admin_feedback = v_body,
      resolved_by = CASE WHEN v_closed THEN p_sender_profile_id ELSE NULL END,
      resolved_at = CASE WHEN v_closed THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_request_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.voyage_concierge_reply(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voyage_concierge_reply(uuid, uuid, text, text)
  TO service_role;

COMMIT;
